import mongoose from 'mongoose';

const attemptAnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  selectedOptionIndex: {
    type: Number,
    default: null, // null if left unattempted
  },
  correctOptionIndex: {
    type: Number,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  explanation: {
    type: String,
    default: '',
  },
});

const attemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      unique: true,
      sparse: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: 10,
    },
    correctAnswersCount: {
      type: Number,
      required: true,
    },
    incorrectAnswersCount: {
      type: Number,
      required: true,
    },
    unattemptedCount: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    timeSpentSeconds: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['completed', 'timed_out'],
      default: 'completed',
    },
    answers: [attemptAnswerSchema],
  },
  {
    timestamps: true,
  }
);

const Attempt = mongoose.model('Attempt', attemptSchema);
export default Attempt;

