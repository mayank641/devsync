import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true });

chatMessageSchema.index({ project: 1, createdAt: -1 });
export default mongoose.model('ChatMessage', chatMessageSchema);
