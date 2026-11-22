import mongoose from 'mongoose';

const examSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
      },
    ],
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitting', 'completed', 'timed_out', 'expired'],
      default: 'in_progress',
      index: true,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookup of a user's active session
examSessionSchema.index({ userId: 1, status: 1 });

const ExamSession = mongoose.model('ExamSession', examSessionSchema);
export default ExamSession;
