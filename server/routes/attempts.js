import express from 'express';
import Attempt from '../models/Attempt.js';
import Question from '../models/Question.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/attempts/submit
// @desc    Submit test answers, evaluate score securely on server, save attempt
// @access  Protected (Student/Admin)
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { answers = [], timeSpentSeconds = 0, isTimedOut = false } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No answers provided for submission.',
      });
    }

    // Extract question IDs from answers
    const questionIds = answers.map((a) => a.questionId);

    // Fetch the actual questions from database
    const dbQuestions = await Question.find({ _id: { $in: questionIds } });
    const questionMap = new Map();
    dbQuestions.forEach((q) => {
      questionMap.set(q._id.toString(), q);
    });

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const evaluatedAnswers = answers.map((sub) => {
      const q = questionMap.get(sub.questionId?.toString());
      if (!q) {
        return {
          questionId: sub.questionId,
          questionText: 'Question information unavailable',
          options: [],
          selectedOptionIndex: sub.selectedOptionIndex ?? null,
          correctOptionIndex: 0,
          isCorrect: false,
          explanation: '',
        };
      }

      const isAttempted =
        sub.selectedOptionIndex !== null &&
        sub.selectedOptionIndex !== undefined &&
        sub.selectedOptionIndex >= 0 &&
        sub.selectedOptionIndex <= 3;

      const isCorrect = isAttempted && sub.selectedOptionIndex === q.correctOptionIndex;

      if (!isAttempted) {
        unattemptedCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      return {
        questionId: q._id,
        questionText: q.questionText,
        options: q.options,
        selectedOptionIndex: isAttempted ? sub.selectedOptionIndex : null,
        correctOptionIndex: q.correctOptionIndex,
        isCorrect,
        explanation: q.explanation || '',
      };
    });

    const totalQuestions = evaluatedAnswers.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const attempt = await Attempt.create({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      score: correctCount,
      totalQuestions,
      correctAnswersCount: correctCount,
      incorrectAnswersCount: incorrectCount,
      unattemptedCount,
      percentage,
      timeSpentSeconds: Math.max(0, parseInt(timeSpentSeconds, 10) || 0),
      status: isTimedOut ? 'timed_out' : 'completed',
      answers: evaluatedAnswers,
    });

    res.status(201).json({
      success: true,
      message: isTimedOut
        ? 'Time expired! Test auto-submitted successfully.'
        : 'Test submitted successfully!',
      attemptId: attempt._id,
      attempt,
    });
  } catch (error) {
    console.error('Error submitting test attempt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit test attempt.',
    });
  }
});

// @route   GET /api/attempts/my-history
// @desc    Get all past test attempts for the logged-in student
// @access  Protected
router.get('/my-history', verifyToken, async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user._id })
      .select('-answers') // Exclude full question array for fast list loading
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve past test attempts.',
    });
  }
});

// @route   GET /api/attempts/:id
// @desc    Get detailed review for a specific test attempt
// @access  Protected
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found.',
      });
    }

    // Verify ownership unless user is admin
    if (
      attempt.userId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this test attempt.',
      });
    }

    res.status(200).json({
      success: true,
      attempt,
    });
  } catch (error) {
    console.error('Error retrieving attempt details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load attempt details.',
    });
  }
});

export default router;

