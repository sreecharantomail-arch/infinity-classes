import express from 'express';
import Question from '../models/Question.js';
import ExamSession from '../models/ExamSession.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { defaultQuestions } from '../seed/questionsData.js';

const router = express.Router();

// Helper to auto-seed questions if collection is empty
const ensureQuestionsExist = async () => {
  const count = await Question.countDocuments();
  if (count === 0) {
    console.log('Question bank empty. Auto-seeding 15 initial questions...');
    await Question.insertMany(defaultQuestions);
  }
};

// @route   POST /api/questions/start-session
// @desc    Start or resume a server-side 10-minute examination session
// @access  Protected (Student/Admin)
router.post('/start-session', verifyToken, async (req, res) => {
  try {
    await ensureQuestionsExist();

    const now = Date.now();

    // 1. Check if the user already has an active, unexpired session in progress
    const existingSession = await ExamSession.findOne({
      userId: req.user._id,
      status: 'in_progress',
      expiresAt: { $gt: new Date(now) },
    });

    if (existingSession) {
      // Fetch the exact 10 questions assigned to this active session
      const questions = await Question.find({
        _id: { $in: existingSession.questionIds },
      });

      // Maintain the order of questionIds
      const questionMap = new Map();
      questions.forEach((q) => questionMap.set(q._id.toString(), q));
      const orderedQuestions = existingSession.questionIds
        .map((id) => questionMap.get(id.toString()))
        .filter(Boolean);

      const sanitizedQuestions = orderedQuestions.map((q) => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
        category: q.category,
        difficulty: q.difficulty,
      }));

      return res.status(200).json({
        success: true,
        message: 'Resuming active examination session.',
        sessionId: existingSession._id,
        startedAt: existingSession.startedAt,
        expiresAt: existingSession.expiresAt,
        durationSeconds: 600,
        questions: sanitizedQuestions,
      });
    }

    // 2. No active session exists: sample 10 random questions from MongoDB
    let questions = await Question.aggregate([{ $sample: { size: 10 } }]);
    if (questions.length < 10) {
      questions = await Question.find().limit(10);
    }

    const questionIds = questions.map((q) => q._id);
    const startedAt = new Date(now);
    const expiresAt = new Date(now + 10 * 60 * 1000); // exactly 10 minutes

    // Create persistent ExamSession
    const newSession = await ExamSession.create({
      userId: req.user._id,
      questionIds,
      startedAt,
      expiresAt,
      status: 'in_progress',
    });

    const sanitizedQuestions = questions.map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty,
    }));

    res.status(201).json({
      success: true,
      message: 'New examination session started.',
      sessionId: newSession._id,
      startedAt: newSession.startedAt,
      expiresAt: newSession.expiresAt,
      durationSeconds: 600,
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error('Error starting examination session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start examination session.',
    });
  }
});

// @route   GET /api/questions/test
// @desc    Backward compatible wrapper that returns test session questions
// @access  Protected (Student/Admin)
router.get('/test', verifyToken, async (req, res) => {
  try {
    await ensureQuestionsExist();

    // Delegate to start-session logic
    const now = Date.now();
    const existingSession = await ExamSession.findOne({
      userId: req.user._id,
      status: 'in_progress',
      expiresAt: { $gt: new Date(now) },
    });

    if (existingSession) {
      const questions = await Question.find({
        _id: { $in: existingSession.questionIds },
      });
      const questionMap = new Map();
      questions.forEach((q) => questionMap.set(q._id.toString(), q));
      const orderedQuestions = existingSession.questionIds
        .map((id) => questionMap.get(id.toString()))
        .filter(Boolean);

      const sanitizedQuestions = orderedQuestions.map((q) => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
        category: q.category,
        difficulty: q.difficulty,
      }));

      return res.status(200).json({
        success: true,
        sessionId: existingSession._id,
        startedAt: existingSession.startedAt,
        expiresAt: existingSession.expiresAt,
        count: sanitizedQuestions.length,
        questions: sanitizedQuestions,
      });
    }

    let questions = await Question.aggregate([{ $sample: { size: 10 } }]);
    if (questions.length < 10) {
      questions = await Question.find().limit(10);
    }

    const questionIds = questions.map((q) => q._id);
    const startedAt = new Date(now);
    const expiresAt = new Date(now + 10 * 60 * 1000);

    const newSession = await ExamSession.create({
      userId: req.user._id,
      questionIds,
      startedAt,
      expiresAt,
      status: 'in_progress',
    });

    const sanitizedQuestions = questions.map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty,
    }));

    res.status(200).json({
      success: true,
      sessionId: newSession._id,
      startedAt: newSession.startedAt,
      expiresAt: newSession.expiresAt,
      count: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load test questions.',
    });
  }
});

// @route   GET /api/questions/all
// @desc    Get all questions for Admin view (includes answers & explanations)
// @access  Protected (Admin only)
router.get('/all', verifyToken, requireAdmin, async (req, res) => {
  try {
    await ensureQuestionsExist();
    const questions = await Question.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('Error fetching all questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch question bank.',
    });
  }
});

// @route   POST /api/questions
// @desc    Add a new question
// @access  Protected (Admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      questionText,
      options,
      correctOptionIndex,
      category,
      difficulty,
      explanation,
    } = req.body;

    if (!questionText || !options || correctOptionIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Question text, 4 options, and correct option index are required.',
      });
    }

    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Exactly 4 options are required.',
      });
    }

    const parsedIndex = parseInt(correctOptionIndex, 10);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex > 3) {
      return res.status(400).json({
        success: false,
        message: 'Correct option index must be between 0 and 3.',
      });
    }

    const question = await Question.create({
      questionText: questionText.trim(),
      options: options.map((opt) => opt.trim()),
      correctOptionIndex: parsedIndex,
      category: category ? category.trim() : 'General',
      difficulty: difficulty || 'medium',
      explanation: explanation ? explanation.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: 'Question added successfully!',
      question,
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create question.',
    });
  }
});

// @route   PUT /api/questions/:id
// @desc    Update a question
// @access  Protected (Admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      questionText,
      options,
      correctOptionIndex,
      category,
      difficulty,
      explanation,
    } = req.body;

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    if (questionText) question.questionText = questionText.trim();
    if (options && Array.isArray(options) && options.length === 4) {
      question.options = options.map((opt) => opt.trim());
    }
    if (correctOptionIndex !== undefined) {
      const idx = parseInt(correctOptionIndex, 10);
      if (!isNaN(idx) && idx >= 0 && idx <= 3) {
        question.correctOptionIndex = idx;
      }
    }
    if (category) question.category = category.trim();
    if (difficulty) question.difficulty = difficulty;
    if (explanation !== undefined) question.explanation = explanation.trim();

    await question.save();

    res.status(200).json({
      success: true,
      message: 'Question updated successfully!',
      question,
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update question.',
    });
  }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question
// @access  Protected (Admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    await Question.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully!',
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question.',
    });
  }
});

// @route   POST /api/questions/reset-seed
// @desc    Reset question bank to default questions
// @access  Protected (Admin only)
router.post('/reset-seed', verifyToken, requireAdmin, async (req, res) => {
  try {
    await Question.deleteMany({});
    await Question.insertMany(defaultQuestions);

    res.status(200).json({
      success: true,
      message: `Reset complete! ${defaultQuestions.length} standard questions loaded.`,
    });
  } catch (error) {
    console.error('Error resetting questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset question bank.',
    });
  }
});

export default router;
