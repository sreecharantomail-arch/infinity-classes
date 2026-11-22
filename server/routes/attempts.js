import express from 'express';
import Attempt from '../models/Attempt.js';
import Question from '../models/Question.js';
import ExamSession from '../models/ExamSession.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/attempts/submit
// @desc    Submit test answers, enforce server session & deadline, calculate score securely
// @access  Protected (Student/Admin)
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { sessionId, answers = [] } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Examination session ID is required for submission.',
      });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No answers provided for submission.',
      });
    }

    // 1. Verify examination session exists
    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Examination session not found or invalid.',
      });
    }

    // 2. Ownership verification: session must belong to the authenticated student
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Examination session belongs to a different student.',
      });
    }

    // 3. Atomic race-condition prevention:
    // Only one submission can transition status from 'in_progress' to 'submitting'
    const lockedSession = await ExamSession.findOneAndUpdate(
      { _id: sessionId, status: 'in_progress' },
      { $set: { status: 'submitting' } },
      { new: false }
    );

    if (!lockedSession) {
      return res.status(400).json({
        success: false,
        message:
          'This examination session has already been submitted or is no longer active.',
      });
    }

    // 4. Server-Side 10-Minute Deadline Enforcement:
    // 15 seconds grace period allowed for network latency on automatic timeout submission
    const now = Date.now();
    const GRACE_PERIOD_MS = 15000;
    const expiryTimestamp = new Date(session.expiresAt).getTime();
    const isPastDeadline = now > expiryTimestamp + GRACE_PERIOD_MS;

    if (isPastDeadline) {
      await ExamSession.findByIdAndUpdate(sessionId, { status: 'expired' });
      return res.status(400).json({
        success: false,
        message:
          'Submission rejected: The 10-minute examination deadline has expired.',
      });
    }

    // 5. Question Payload Validation:
    // Verify answer count matches assigned session questions
    if (answers.length !== session.questionIds.length) {
      await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress' });
      return res.status(400).json({
        success: false,
        message: `Submission must include all ${session.questionIds.length} assigned questions.`,
      });
    }

    const assignedIdSet = new Set(
      session.questionIds.map((id) => id.toString())
    );
    const seenSubmittedIds = new Set();

    for (const ans of answers) {
      if (!ans.questionId) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress' });
        return res.status(400).json({
          success: false,
          message: 'Malformed answer: questionId is missing.',
        });
      }

      const qIdStr = ans.questionId.toString();

      // Reject duplicate question IDs in payload
      if (seenSubmittedIds.has(qIdStr)) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress' });
        return res.status(400).json({
          success: false,
          message: `Duplicate question ID detected in submission: ${qIdStr}`,
        });
      }
      seenSubmittedIds.add(qIdStr);

      // Reject unknown question IDs not assigned to this session
      if (!assignedIdSet.has(qIdStr)) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress' });
        return res.status(400).json({
          success: false,
          message: `Unknown question ID not assigned to this session: ${qIdStr}`,
        });
      }

      // Validate selectedOptionIndex format (0, 1, 2, 3 or null)
      if (
        ans.selectedOptionIndex !== null &&
        ans.selectedOptionIndex !== undefined
      ) {
        const idx = parseInt(ans.selectedOptionIndex, 10);
        if (isNaN(idx) || idx < 0 || idx > 3) {
          await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress' });
          return res.status(400).json({
            success: false,
            message: `Invalid option index for question ${qIdStr}. Must be 0, 1, 2, 3, or null.`,
          });
        }
      }
    }

    // 6. Server-Side Score & Time Calculation:
    // Never trust client-provided scores, timeSpentSeconds, or timeout flags
    const startedTimestamp = new Date(session.startedAt).getTime();
    const serverTimeSpentSeconds = Math.min(
      600,
      Math.max(1, Math.round((now - startedTimestamp) / 1000))
    );
    const isTimedOut = now >= expiryTimestamp;

    // Fetch genuine questions from database
    const dbQuestions = await Question.find({
      _id: { $in: session.questionIds },
    });
    const questionMap = new Map();
    dbQuestions.forEach((q) => questionMap.set(q._id.toString(), q));

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const evaluatedAnswers = answers.map((sub) => {
      const q = questionMap.get(sub.questionId.toString());
      const isAttempted =
        sub.selectedOptionIndex !== null &&
        sub.selectedOptionIndex !== undefined &&
        sub.selectedOptionIndex >= 0 &&
        sub.selectedOptionIndex <= 3;

      const isCorrect =
        isAttempted && sub.selectedOptionIndex === q.correctOptionIndex;

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
    const percentage =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    // Create persistent Attempt record
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
      timeSpentSeconds: serverTimeSpentSeconds,
      status: isTimedOut ? 'timed_out' : 'completed',
      answers: evaluatedAnswers,
    });

    // Finalize ExamSession
    await ExamSession.findByIdAndUpdate(sessionId, {
      status: isTimedOut ? 'timed_out' : 'completed',
      attemptId: attempt._id,
      submittedAt: new Date(now),
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
