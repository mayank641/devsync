import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Invitation from '../models/Invitation.js';
import ChatMessage from '../models/ChatMessage.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const idOf = (v) => (v?._id ?? v)?.toString();
const isMember = (p, uid) => p && (idOf(p.owner) === uid.toString() || (p.members || []).some((m) => idOf(m) === uid.toString()));
const isOwner = (p, uid) => p && idOf(p.owner) === uid.toString();
const roleOf = (p, uid) => !p ? null : isOwner(p, uid) ? 'owner' : (p.memberRoles || []).find((m) => idOf(m.user) === uid.toString())?.role || 'member';
const hash = (v) => createHash('sha256').update(v).digest('hex');

router.get('/:projectId/members', async (req, res, next) => {
  try {
    const p = await Project.findById(req.params.projectId).populate('owner', 'name email').populate('members', 'name email').populate('memberRoles.user', 'name email');
    if (!isMember(p, req.user._id)) return res.status(p ? 403 : 404).json({ message: p ? 'Access denied.' : 'Project not found.' });
    const roleMap = new Map((p.memberRoles || []).map((m) => [idOf(m.user), m.role]));
    res.json({ members: [{ user: p.owner, role: 'owner' }, ...p.members.filter((m) => idOf(m) !== idOf(p.owner)).map((user) => ({ user, role: roleMap.get(idOf(user)) || 'member' }))], currentRole: roleOf(p, req.user._id) });
  } catch (e) { next(e); }
});

router.post('/:projectId/invitations', async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email().max(254).transform((v) => v.toLowerCase()), role: z.enum(['admin', 'member']).default('member') }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email address and role.' });
    const p = await Project.findById(req.params.projectId);
    if (!isOwner(p, req.user._id) && roleOf(p, req.user._id) !== 'admin') return res.status(p ? 403 : 404).json({ message: p ? 'Only project owners and admins can invite members.' : 'Project not found.' });
    const target = await User.findOne({ email: parsed.data.email }).select('_id email');
    if (target && isMember(p, target._id)) return res.status(409).json({ message: 'That user is already a project member.' });
    const rawToken = randomBytes(32).toString('hex');
    const invitation = await Invitation.create({ project: p._id, email: parsed.data.email, role: parsed.data.role, tokenHash: hash(rawToken), invitedBy: req.user._id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    const base = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '');
    res.status(201).json({ invitation: { id: invitation._id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt }, inviteLink: `${base}/invitations/accept?token=${rawToken}`, note: target ? 'Share this invitation link with the invited user. Email delivery is not configured.' : 'The recipient must register with this email address, then open the invitation link. Email delivery is not configured.' });
  } catch (e) { next(e); }
});

router.get('/invitations/pending', async (req, res, next) => {
  try {
    const invitations = await Invitation.find({ email: req.user.email, acceptedAt: null, expiresAt: { $gt: new Date() } }).populate('project', 'name description owner').sort({ createdAt: -1 });
    res.json({ invitations });
  } catch (e) { next(e); }
});

router.post('/invitations/accept', async (req, res, next) => {
  try {
    const parsed = z.object({ token: z.string().min(32).max(256) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid invitation token.' });
    const invitation = await Invitation.findOne({ tokenHash: hash(parsed.data.token), acceptedAt: null, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation is invalid, expired, or already accepted.' });
    if (invitation.email !== req.user.email.toLowerCase()) return res.status(403).json({ message: 'Sign in with the email address the invitation was sent to.' });
    const p = await Project.findById(invitation.project);
    if (!p) return res.status(404).json({ message: 'Project no longer exists.' });
    if (!isMember(p, req.user._id)) {
      p.members.addToSet(req.user._id);
      p.memberRoles = (p.memberRoles || []).filter((m) => idOf(m.user) !== idOf(req.user._id));
      p.memberRoles.push({ user: req.user._id, role: invitation.role });
      await p.save();
    }
    invitation.acceptedAt = new Date();
    await invitation.save();
    req.app.get('io').to(`project:${p._id}`).emit('project:members-updated', { projectId: p._id.toString() });
    res.json({ message: 'Invitation accepted.', projectId: p._id.toString() });
  } catch (e) { next(e); }
});

router.patch('/:projectId/members/:userId/role', async (req, res, next) => {
  try {
    const parsed = z.object({ role: z.enum(['admin', 'member']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Role must be admin or member.' });
    const p = await Project.findById(req.params.projectId);
    if (!p) return res.status(404).json({ message: 'Project not found.' });
    if (!isOwner(p, req.user._id)) return res.status(403).json({ message: 'Only the project owner can change roles.' });
    if (!p.members.some((m) => idOf(m) === req.params.userId) || idOf(p.owner) === req.params.userId) return res.status(404).json({ message: 'Project member not found.' });
    p.memberRoles = (p.memberRoles || []).filter((m) => idOf(m.user) !== req.params.userId);
    p.memberRoles.push({ user: req.params.userId, role: parsed.data.role });
    await p.save();
    req.app.get('io').to(`project:${p._id}`).emit('project:members-updated', { projectId: p._id.toString() });
    res.json({ message: 'Member role updated.' });
  } catch (e) { next(e); }
});

router.delete('/:projectId/members/:userId', async (req, res, next) => {
  try {
    const p = await Project.findById(req.params.projectId);
    if (!p) return res.status(404).json({ message: 'Project not found.' });
    const selfLeave = req.params.userId === req.user._id.toString();
    if (!isOwner(p, req.user._id) && !selfLeave) return res.status(403).json({ message: 'Only the owner can remove other members.' });
    if (idOf(p.owner) === req.params.userId) return res.status(400).json({ message: 'The project owner cannot be removed.' });
    p.members = p.members.filter((m) => idOf(m) !== req.params.userId);
    p.memberRoles = (p.memberRoles || []).filter((m) => idOf(m.user) !== req.params.userId);
    await p.save();
    const io = req.app.get('io');
    const room = `project:${p._id}`;
    const sockets = await io.in(room).fetchSockets();
    await Promise.all(sockets.filter((socket) => socket.user?._id?.toString() === req.params.userId).map((socket) => socket.leave(room)));
    io.to(room).emit('project:members-updated', { projectId: p._id.toString() });
    res.json({ message: selfLeave ? 'You left the project.' : 'Member removed.' });
  } catch (e) { next(e); }
});

router.get('/:projectId/messages', async (req, res, next) => {
  try {
    const p = await Project.findById(req.params.projectId).select('owner members');
    if (!isMember(p, req.user._id)) return res.status(p ? 403 : 404).json({ message: p ? 'Access denied.' : 'Project not found.' });
    const messages = await ChatMessage.find({ project: p._id }).populate('sender', 'name email').sort({ createdAt: -1 }).limit(100).lean();
    res.json({ messages: messages.reverse() });
  } catch (e) { next(e); }
});
router.post('/:projectId/messages', async (req, res, next) => {
  try {
    const parsed = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Message must contain 1–2000 characters.' });
    const p = await Project.findById(req.params.projectId);
    if (!isMember(p, req.user._id)) return res.status(p ? 403 : 404).json({ message: p ? 'Access denied.' : 'Project not found.' });
    const message = await ChatMessage.create({ project: p._id, sender: req.user._id, text: parsed.data.text });
    await message.populate('sender', 'name email');
    req.app.get('io').to(`project:${p._id}`).emit('chat:message', { projectId: p._id.toString(), message });
    res.status(201).json({ message });
  } catch (e) { next(e); }
});
export default router;
