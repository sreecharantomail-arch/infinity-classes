import express from 'express';
import Attempt from '../models/Attempt.js';
import Question from '../models/Question.js';
import ExamSession from '../models/ExamSession.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Recovery timeout: if a session is stuck in 'submitting' for > 30s without an Attempt, allow recovery
const STUCK_SUBMITTING_THRESHOLD_MS = 30000;

// @route   POST /api/attempts/submit
// @desc    Submit test answers, enforce server session & deadline, strict validation, and idempotent recovery
// @access  Protected (Student/Admin)
router.post('/submit', verifyToken, async (req, res) => {
  let acquiredLock = false;
  let attemptCreated = false;
  const { sessionId, answers = [] } = req.body;

  try {
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

    // 1. Check if an Attempt ALREADY exists for this session (Idempotent Recovery)
    const existingAttempt = await Attempt.findOne({ sessionId });
    if (existingAttempt) {
      return res.status(200).json({
        success: true,
        message: 'Test session was already submitted successfully.',
        attemptId: existingAttempt._id,
        attempt: existingAttempt,
      });
    }

    // 2. Verify examination session exists
    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Examination session not found or invalid.',
      });
    }

    // 3. Ownership verification: session must belong to the authenticated student
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Examination session belongs to a different student.',
      });
    }

    // 4. Check if session was already completed or expired
    if (session.status === 'completed' || session.status === 'timed_out') {
      if (session.attemptId) {
        const finishedAttempt = await Attempt.findById(session.attemptId);
        if (finishedAttempt) {
          return res.status(200).json({
            success: true,
            message: 'Test session was already submitted.',
            attemptId: finishedAttempt._id,
            attempt: finishedAttempt,
          });
        }
      }
      return res.status(400).json({
        success: false,
        message: 'This examination session has already been finalized.',
      });
    }

    if (session.status === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Submission rejected: The examination session has expired.',
      });
    }

    // 5. Atomic Lock Acquisition with Stuck-Session Recovery:
    // Matches if status is 'in_progress', OR if it was stuck in 'submitting' past the recovery threshold
    const now = Date.now();
    const stuckThresholdDate = new Date(now - STUCK_SUBMITTING_THRESHOLD_MS);

    const lockedSession = await ExamSession.findOneAndUpdate(
      {
        _id: sessionId,
        $or: [
          { status: 'in_progress' },
          { status: 'submitting', submittingAt: { $lt: stuckThresholdDate } },
        ],
      },
      {
        $set: {
          status: 'submitting',
          submittingAt: new Date(now),
        },
      },
      { new: false }
    );

    if (!lockedSession) {
      // Could not acquire lock: check if active concurrent submission is underway
      return res.status(409).json({
        success: false,
        message: 'A submission is currently being processed for this session. Please wait a moment.',
      });
    }

    acquiredLock = true;

    // 6. Server-Side 10-Minute Deadline Enforcement:
    // 15 seconds grace period allowed for network latency on automatic timeout submission
    const GRACE_PERIOD_MS = 15000;
    const expiryTimestamp = new Date(session.expiresAt).getTime();
    const isPastDeadline = now > expiryTimestamp + GRACE_PERIOD_MS;

    if (isPastDeadline) {
      await ExamSession.findByIdAndUpdate(sessionId, { status: 'expired' });
      return res.status(400).json({
        success: false,
        message: 'Submission rejected: The 10-minute examination deadline has expired.',
      });
    }

    // 7. Strict Question Count & Payload Structure Validation
    if (answers.length !== session.questionIds.length) {
      await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
      return res.status(400).json({
        success: false,
        message: `Submission must include all ${session.questionIds.length} assigned questions.`,
      });
    }

    const assignedIdSet = new Set(session.questionIds.map((id) => id.toString()));
    const seenSubmittedIds = new Set();

    // 8. Strict Answer Item & Option Validation (No permissive parseInt! No decimals, strings, booleans, or objects!)
    for (const ans of answers) {
      if (!ans || typeof ans !== 'object' || Array.isArray(ans)) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
        return res.status(400).json({
          success: false,
          message: 'Invalid answer item format. Must be an object.',
        });
      }

      if (!ans.questionId) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
        return res.status(400).json({
          success: false,
          message: 'Malformed answer: questionId is missing.',
        });
      }

      const qIdStr = ans.questionId.toString();

      // Reject duplicate question IDs in payload
      if (seenSubmittedIds.has(qIdStr)) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
        return res.status(400).json({
          success: false,
          message: `Duplicate question ID detected in submission: ${qIdStr}`,
        });
      }
      seenSubmittedIds.add(qIdStr);

      // Reject unknown question IDs not assigned to this session
      if (!assignedIdSet.has(qIdStr)) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
        return res.status(400).json({
          success: false,
          message: `Unknown question ID not assigned to this session: ${qIdStr}`,
        });
      }

      // Strict Option Validation: Must strictly be null/undefined OR an integer in [0, 1, 2, 3]
      const opt = ans.selectedOptionIndex;
      const isStrictNull = opt === null || opt === undefined;
      const isStrictValidInt =
        typeof opt === 'number' &&
        Number.isInteger(opt) &&
        !Number.isNaN(opt) &&
        Number.isFinite(opt) &&
        opt >= 0 &&
        opt <= 3;

      if (!isStrictNull && !isStrictValidInt) {
        await ExamSession.findByIdAndUpdate(sessionId, { status: 'in_progress', submittingAt: null });
        return res.status(400).json({
          success: false,
          message: `Strict validation failed for question ${qIdStr}: selectedOptionIndex must be either null or an integer between 0 and 3. Invalid value: ${typeof opt} (${JSON.stringify(opt)})`,
        });
      }
    }

    // 9. Server-Side Score & Time Calculation:
    // Client-provided scores, timeSpentSeconds, or timeout flags are completely disregarded
    const startedTimestamp = new Date(session.startedAt).getTime();
    const serverTimeSpentSeconds = Math.min(
      600,
      Math.max(1, Math.round((now - startedTimestamp) / 1000))
    );
    const isTimedOut = now >= expiryTimestamp;

    // Fetch questions from DB
    const dbQuestions = await Question.find({ _id: { $in: session.questionIds } });
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
        typeof sub.selectedOptionIndex === 'number';

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

    // 10. Create persistent Attempt record (protected by unique sessionId constraint)
    let attempt;
    try {
      attempt = await Attempt.create({
        userId: req.user._id,
        sessionId: session._id,
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
      attemptCreated = true;
    } catch (createAttemptErr) {
      // If duplicate key error on sessionId occurs (race or recovery retry), find existing attempt
      if (createAttemptErr.code === 11000) {
        const recoveredAttempt = await Attempt.findOne({ sessionId });
        if (recoveredAttempt) {
          await ExamSession.findByIdAndUpdate(sessionId, {
            status: recoveredAttempt.status || 'completed',
            attemptId: recoveredAttempt._id,
            submittedAt: recoveredAttempt.createdAt || new Date(),
          }).catch(() => {});

          return res.status(200).json({
            success: true,
            message: 'Test session was already submitted successfully.',
            attemptId: recoveredAttempt._id,
            attempt: recoveredAttempt,
          });
        }
      }
      throw createAttemptErr;
    }

    // 11. Finalize ExamSession to completed/timed_out
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
    console.error('Error during test submission:', error);

    // If duplicate attempt key error on recovery
    if (error.code === 11000 && sessionId) {
      try {
        const recoveredAttempt = await Attempt.findOne({ sessionId });
        if (recoveredAttempt) {
          await ExamSession.findByIdAndUpdate(sessionId, {
            status: recoveredAttempt.status || 'completed',
            attemptId: recoveredAttempt._id,
            submittedAt: recoveredAttempt.createdAt || new Date(),
          });
          return res.status(200).json({
            success: true,
            message: 'Test session was already submitted successfully.',
            attemptId: recoveredAttempt._id,
            attempt: recoveredAttempt,
          });
        }
      } catch (recErr) {
        console.error('Error during attempt recovery:', recErr);
      }
    }

    // Submission Recovery: If an error happened before Attempt was created, rollback lock!
    if (acquiredLock && !attemptCreated && sessionId) {
      await ExamSession.findByIdAndUpdate(sessionId, {
        status: 'in_progress',
        submittingAt: null,
      }).catch((rbErr) => console.error('Failed to rollback session status:', rbErr));
    }

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
