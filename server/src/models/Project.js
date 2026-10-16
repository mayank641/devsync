import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate: { type: Date, default: null }
}, { timestamps: true });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 1000 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tasks: [taskSchema]
}, { timestamps: true });

projectSchema.index({ owner: 1, updatedAt: -1 });
export default mongoose.model('Project', projectSchema);
