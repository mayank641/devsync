import { Router } from 'express';
import { z } from 'zod';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const projectInput = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(1000).optional().default('') });
const taskInput = z.object({ title: z.string().trim().min(2).max(160), description: z.string().max(2000).optional().default(''), priority: z.enum(['low', 'medium', 'high']).optional().default('medium'), dueDate: z.string().datetime().optional().nullable(), assignee: z.string().regex(/^[a-f\\d]{24}$/i).nullable().optional() });
const idOf = (value) => (value?._id ?? value)?.toString();
const canAccess = (project, userId) => project && (idOf(project.owner) === userId.toString() || project.members.some((m) => idOf(m) === userId.toString()));

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ $or: [{ owner: req.user._id }, { members: req.user._id }] }).sort({ updatedAt: -1 }).lean();
    res.json({ projects });
  } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try {
    const parsed = projectInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const project = await Project.create({ ...parsed.data, owner: req.user._id, members: [req.user._id] });
    res.status(201).json({ project });
  } catch (error) { next(error); }
});
router.get('/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('owner', 'name email').populate('members', 'name email').populate('tasks.assignee', 'name email');
    if (!canAccess(project, req.user._id)) return res.status(project ? 403 : 404).json({ message: project ? 'You do not have access to this project.' : 'Project not found.' });
    res.json({ project });
  } catch (error) { next(error); }
});
router.post('/:projectId/tasks', async (req, res, next) => {
  try {
    const parsed = taskInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const project = await Project.findById(req.params.projectId);
    if (!canAccess(project, req.user._id)) return res.status(project ? 403 : 404).json({ message: project ? 'Access denied.' : 'Project not found.' });
    if (parsed.data.assignee && ![project.owner, ...project.members].some((m) => idOf(m) === parsed.data.assignee)) return res.status(400).json({ message: 'Assignee must be a member of this project.' });
    project.tasks.push({ ...parsed.data, assignee: parsed.data.assignee || null, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null });
    await project.save();
    const task = project.tasks[project.tasks.length - 1];
    req.app.get('io').to(`project:${project._id}`).emit('task:created', { projectId: project._id.toString(), task });
    res.status(201).json({ task, project });
  } catch (error) { next(error); }
});
router.patch('/:projectId/tasks/:taskId', async (req, res, next) => {
  try {
    const patchSchema = z.object({ title: z.string().trim().min(2).max(160).optional(), description: z.string().max(2000).optional(), status: z.enum(['todo', 'in-progress', 'done']).optional(), priority: z.enum(['low', 'medium', 'high']).optional(), assignee: z.string().regex(/^[a-f\\d]{24}$/i).nullable().optional(), dueDate: z.string().datetime().nullable().optional() }).refine((data) => Object.keys(data).length > 0);
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Provide valid task fields to update.' });
    const project = await Project.findById(req.params.projectId);
    if (!canAccess(project, req.user._id)) return res.status(project ? 403 : 404).json({ message: project ? 'Access denied.' : 'Project not found.' });
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (parsed.data.assignee && ![project.owner, ...project.members].some((m) => idOf(m) === parsed.data.assignee)) return res.status(400).json({ message: 'Assignee must be a member of this project.' });
    const changes = { ...parsed.data };
    if (Object.prototype.hasOwnProperty.call(changes, 'dueDate')) changes.dueDate = changes.dueDate ? new Date(changes.dueDate) : null;
    Object.assign(task, changes);
    await project.save();
    req.app.get('io').to(`project:${project._id}`).emit('task:updated', { projectId: project._id.toString(), task });
    res.json({ task, project });
  } catch (error) { next(error); }
});
router.delete('/:projectId/tasks/:taskId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!canAccess(project, req.user._id)) return res.status(project ? 403 : 404).json({ message: project ? 'Access denied.' : 'Project not found.' });
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    task.deleteOne(); await project.save();
    req.app.get('io').to(`project:${project._id}`).emit('task:deleted', { projectId: project._id.toString(), taskId: req.params.taskId });
    res.json({ message: 'Task deleted.' });
  } catch (error) { next(error); }
});
export default router;
