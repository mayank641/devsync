import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Project from './models/Project.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import collaborationRoutes from './routes/collaboration.js';

const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL.split(',').map((s) => s.trim()), methods: ['GET', 'POST', 'PATCH', 'DELETE'] } });
app.set('io', io);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'devsync-api', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', collaborationRoutes);
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  if (error?.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier.' });
  if (error?.code === 11000) return res.status(409).json({ message: 'A record with this value already exists.' });
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id name email');
    if (!user) return next(new Error('Invalid account'));
    socket.user = user;
    next();
  } catch { next(new Error('Invalid or expired token')); }
});
io.on('connection', (socket) => {
  socket.on('project:join', async (projectId) => {
    if (typeof projectId !== 'string' || !/^[a-f\d]{24}$/i.test(projectId)) return;
    const project = await Project.findById(projectId).select('owner members');
    if (!project) return;
    const allowed = project.owner.toString() === socket.user._id.toString() || project.members.some((id) => id.toString() === socket.user._id.toString());
    if (allowed) socket.join(`project:${projectId}`);
  });
  socket.on('project:leave', (projectId) => { if (typeof projectId === 'string') socket.leave(`project:${projectId}`); });
});

const port = Number(process.env.PORT || 5000);
await mongoose.connect(process.env.MONGODB_URI);
server.listen(port, () => console.log(`DevSync API listening on port ${port}`));
