import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: [true, 'Four options are required'],
      validate: [
        (val) => val.length === 4,
        'Exactly 4 options must be provided',
      ],
    },
    correctOptionIndex: {
      type: Number,
      required: [true, 'Correct option index (0-3) is required'],
      min: 0,
      max: 3,
    },
    category: {
      type: String,
      default: 'Computer Science & Web Development',
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    explanation: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Question = mongoose.model('Question', questionSchema);
export default Question;
