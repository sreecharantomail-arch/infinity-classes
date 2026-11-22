import mongoose from 'mongoose';

const examSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    submittingAt: {
      type: Date,
      default: null,
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

// Unique partial index: strictly at most ONE 'in_progress' session per student at the database level!
// Explicitly named to avoid index conflict with any existing standard index.
examSessionSchema.index(
  { userId: 1 },
  {
    name: 'unique_active_user_session',
    unique: true,
    partialFilterExpression: { status: 'in_progress' },
  }
);

const ExamSession = mongoose.model('ExamSession', examSessionSchema);
export default ExamSession;
