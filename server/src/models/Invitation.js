import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  tokenHash: { type: String, required: true, unique: true, select: false },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null }
}, { timestamps: true });

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ project: 1, email: 1, acceptedAt: 1 });
export default mongoose.model('Invitation', invitationSchema);
