import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), password: z.string().min(8).max(72) });
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) });
const issueToken = (user) => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const { name, email, password } = parsed.data;
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    return res.status(201).json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' });
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Incorrect email or password.' });
    return res.json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email } }));
export default router;
