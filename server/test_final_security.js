import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Question from './models/Question.js';
import ExamSession from './models/ExamSession.js';
import Attempt from './models/Attempt.js';
import LoginRateLimit from './models/LoginRateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/online_test_app';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_1234567890';
process.env.JWT_SECRET = JWT_SECRET;

const results = [];
function report(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runSecurityAudit() {
  console.log('=== STARTING FINAL SECURITY REFINEMENT VERIFICATION SUITE ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  // Ensure indexes are built
  await ExamSession.syncIndexes();
  await Attempt.syncIndexes();
  await LoginRateLimit.syncIndexes();

  // Clean test artifacts
  await User.deleteMany({ email: /@test-security-refine\.com$/ });
  await LoginRateLimit.deleteMany({});

  // 1. Setup Questions in DB if fewer than 10
  const questionCount = await Question.countDocuments();
  if (questionCount < 10) {
    const toCreate = [];
    for (let i = 1; i <= 15; i++) {
      toCreate.push({
        questionText: `Audit Question #${i}`,
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctOptionIndex: (i % 4),
        category: 'Security',
        difficulty: 'medium',
      });
    }
    await Question.insertMany(toCreate);
  }

  // 2. Setup Test Student
  const studentPasswordHash = await bcrypt.hash('TestPass123', 10);
  const testStudent = await User.create({
    name: 'Security Test Student',
    email: 'student@test-security-refine.com',
    password: studentPasswordHash,
    role: 'student',
  });

  const studentToken = jwt.sign(
    { id: testStudent._id, role: testStudent.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Express test app
  const { default: express } = await import('express');
  const authRoutes = (await import('./routes/auth.js')).default;
  const questionRoutes = (await import('./routes/questions.js')).default;
  const attemptRoutes = (await import('./routes/attempts.js')).default;

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/attempts', attemptRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const client = {
    post: async (endpoint, body, headers = {}) => {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    get: async (endpoint, headers = {}) => {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
  };

  try {
    // =========================================================================
    // ISSUE 2: CONCURRENT EXAMINATION SESSION CREATION
    // =========================================================================
    console.log('\n--- 1. Testing Concurrent Examination Session Creation ---');

    // Fire 6 simultaneous start-session calls for the same student
    const concurrentResponses = await Promise.all([
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${studentToken}` }),
    ]);

    const sessionIds = concurrentResponses.map((r) => r.data.sessionId);
    const allSuccessful = concurrentResponses.every((r) => r.status === 200 || r.status === 201);
    const uniqueSessionIds = new Set(sessionIds);

    report(
      'Concurrent Start-Session Handling',
      allSuccessful && uniqueSessionIds.size === 1,
      `Responses: ${concurrentResponses.length}, Unique Session IDs: ${uniqueSessionIds.size}`
    );

    const activeSessionsInDb = await ExamSession.countDocuments({
      userId: testStudent._id,
      status: 'in_progress',
    });
    report(
      'DB Enforced Single Active Session',
      activeSessionsInDb === 1,
      `Active sessions in MongoDB: ${activeSessionsInDb} (must strictly be 1)`
    );

    const sharedSessionId = sessionIds[0];
    const sessionQuestions = concurrentResponses[0].data.questions;
    const sessionQuestionIds = sessionQuestions.map((q) => q._id);

    // =========================================================================
    // ISSUE 3: STRICT ANSWER VALIDATION
    // =========================================================================
    console.log('\n--- 2. Testing Strict Answer Validation ---');

    // Test A: String instead of Integer
    const badStringPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: '2' })),
    };
    const stringRes = await client.post('/api/attempts/submit', badStringPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject String Option Index ("2")',
      stringRes.status === 400 && stringRes.data.message.includes('Strict validation failed'),
      `Status: ${stringRes.status}, Message: ${stringRes.data.message}`
    );

    // Test B: Decimal / Float (1.5)
    const badFloatPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: 1.5 })),
    };
    const floatRes = await client.post('/api/attempts/submit', badFloatPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Decimal / Float Option Index (1.5)',
      floatRes.status === 400 && floatRes.data.message.includes('Strict validation failed'),
      `Status: ${floatRes.status}`
    );

    // Test C: Boolean (true)
    const badBoolPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: true })),
    };
    const boolRes = await client.post('/api/attempts/submit', badBoolPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Boolean Option Index (true)',
      boolRes.status === 400 && boolRes.data.message.includes('Strict validation failed'),
      `Status: ${boolRes.status}`
    );

    // Test D: Array ([1])
    const badArrayPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: [1] })),
    };
    const arrayRes = await client.post('/api/attempts/submit', badArrayPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Array Option Index ([1])',
      arrayRes.status === 400 && arrayRes.data.message.includes('Strict validation failed'),
      `Status: ${arrayRes.status}`
    );

    // Test E: Object ({ index: 1 })
    const badObjPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: { index: 1 } })),
    };
    const objRes = await client.post('/api/attempts/submit', badObjPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Object Option Index ({ index: 1 })',
      objRes.status === 400 && objRes.data.message.includes('Strict validation failed'),
      `Status: ${objRes.status}`
    );

    // Test F: Duplicate Question IDs
    const duplicateIdPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId, idx) => ({
        questionId: idx === 0 ? sessionQuestionIds[1] : qId, // duplicate sessionQuestionIds[1]
        selectedOptionIndex: 0,
      })),
    };
    const dupRes = await client.post('/api/attempts/submit', duplicateIdPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Duplicate Question IDs in Submission',
      dupRes.status === 400 && dupRes.data.message.includes('Duplicate question ID'),
      `Status: ${dupRes.status}, Message: ${dupRes.data.message}`
    );

    // Test G: Foreign / Unknown Question ID
    const foreignQuestion = await Question.create({
      questionText: 'Foreign Question Outside Session',
      options: ['1', '2', '3', '4'],
      correctOptionIndex: 0,
    });
    const foreignPayload = {
      sessionId: sharedSessionId,
      answers: sessionQuestionIds.map((qId, idx) => ({
        questionId: idx === 0 ? foreignQuestion._id : qId,
        selectedOptionIndex: 0,
      })),
    };
    const foreignRes = await client.post('/api/attempts/submit', foreignPayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    report(
      'Reject Foreign Question ID not Assigned to Session',
      foreignRes.status === 400 && foreignRes.data.message.includes('Unknown question ID'),
      `Status: ${foreignRes.status}, Message: ${foreignRes.data.message}`
    );

    // Verify session remained in 'in_progress' and not stuck after rejected validations
    const sessionAfterRejections = await ExamSession.findById(sharedSessionId);
    report(
      'Session Status Preserved as in_progress after Validation Rejection',
      sessionAfterRejections.status === 'in_progress',
      `Session status: ${sessionAfterRejections.status}`
    );

    // =========================================================================
    // ISSUE 1: SUBMISSION RECOVERY & IDEMPOTENT PROTECTION
    // =========================================================================
    console.log('\n--- 3. Testing Submission Recovery & Idempotence ---');

    // Simulate session stuck in 'submitting' for 35 seconds (past the 30s threshold)
    await ExamSession.findByIdAndUpdate(sharedSessionId, {
      status: 'submitting',
      submittingAt: new Date(Date.now() - 35000),
    });

    // Fetch the actual questions assigned to this session from DB to know their correct options
    const dbSessionQuestions = await Question.find({ _id: { $in: sessionQuestionIds } });
    const qMap = new Map();
    dbSessionQuestions.forEach((q) => qMap.set(q._id.toString(), q));

    // Valid answers payload (first 5 correct, next 3 incorrect, last 2 unattempted null)
    const validAnswers = sessionQuestionIds.map((qId, idx) => {
      const q = qMap.get(qId.toString());
      let selectedOptionIndex = null;
      if (idx < 5) {
        selectedOptionIndex = q.correctOptionIndex; // correct
      } else if (idx < 8) {
        selectedOptionIndex = (q.correctOptionIndex + 1) % 4; // incorrect
      } else {
        selectedOptionIndex = null; // unattempted
      }
      return {
        questionId: qId,
        selectedOptionIndex,
      };
    });

    const recoverRes = await client.post(
      '/api/attempts/submit',
      { sessionId: sharedSessionId, answers: validAnswers },
      { Authorization: `Bearer ${studentToken}` }
    );

    report(
      'Recovery of Stuck Submitting Session',
      recoverRes.status === 201 && recoverRes.data.success,
      `Status: ${recoverRes.status}, AttemptId: ${recoverRes.data.attemptId}`
    );

    report(
      'Server-Side Score Calculation Accuracy',
      recoverRes.data.attempt?.score === 5 &&
        recoverRes.data.attempt?.correctAnswersCount === 5 &&
        recoverRes.data.attempt?.incorrectAnswersCount === 3 &&
        recoverRes.data.attempt?.unattemptedCount === 2 &&
        recoverRes.data.attempt?.percentage === 50,
      `Score: ${recoverRes.data.attempt?.score}/10 (50%), Correct: 5, Incorrect: 3, Unattempted: 2`
    );

    const firstAttemptId = recoverRes.data.attemptId;

    // Call submit AGAIN on the exact same session (Idempotent replay)
    const secondSubmitRes = await client.post(
      '/api/attempts/submit',
      { sessionId: sharedSessionId, answers: validAnswers },
      { Authorization: `Bearer ${studentToken}` }
    );

    report(
      'Idempotent Replay Returns Status 200 with Same Attempt',
      secondSubmitRes.status === 200 &&
        secondSubmitRes.data.attemptId.toString() === firstAttemptId.toString(),
      `Status: ${secondSubmitRes.status}, Same Attempt ID: ${secondSubmitRes.data.attemptId}`
    );

    const totalAttemptsForSession = await Attempt.countDocuments({ sessionId: sharedSessionId });
    report(
      'Strictly ONE Attempt Created for Session in MongoDB',
      totalAttemptsForSession === 1,
      `Total Attempts: ${totalAttemptsForSession}`
    );

    // =========================================================================
    // ISSUE 4: LOGIN RATE LIMITING (DUAL PER-ACCOUNT AND PER-IP)
    // =========================================================================
    console.log('\n--- 4. Testing Dual-Track Login Rate Limiting ---');

    // Create a target victim account
    const victimUser = await User.create({
      name: 'Victim Student',
      email: 'victim@test-security-refine.com',
      password: studentPasswordHash,
      role: 'student',
    });

    // Create an innocent account
    const innocentUser = await User.create({
      name: 'Innocent Student',
      email: 'innocent@test-security-refine.com',
      password: studentPasswordHash,
      role: 'student',
    });

    // Subtest 4.1: Per-Account Rate Limit (Max 5 failed attempts per account)
    let victimBlocked = false;
    for (let i = 1; i <= 6; i++) {
      const res = await client.post('/api/auth/login', {
        email: 'victim@test-security-refine.com',
        password: 'WrongPassword999',
      });
      if (res.status === 429) {
        victimBlocked = true;
        report(
          'Per-Account Rate Limiter Blocks After 5 Failures',
          true,
          `Blocked on attempt #${i} with HTTP 429: "${res.data.message}"`
        );
        break;
      }
    }
    if (!victimBlocked) {
      report('Per-Account Rate Limiter Blocks After 5 Failures', false, 'Not blocked after 6 attempts');
    }

    // Subtest 4.2: Account Isolation: Successful login of Innocent Student does NOT unblock Victim!
    const innocentLoginRes = await client.post('/api/auth/login', {
      email: 'innocent@test-security-refine.com',
      password: 'TestPass123',
    });
    report(
      'Innocent User Can Login Successfully',
      innocentLoginRes.status === 200 && innocentLoginRes.data.success,
      `Status: ${innocentLoginRes.status}`
    );

    // Now test that victim is STILL locked!
    const victimAfterInnocent = await client.post('/api/auth/login', {
      email: 'victim@test-security-refine.com',
      password: 'TestPass123', // even with correct password!
    });
    report(
      'Account Isolation: Unrelated Account Remains Locked (429)',
      victimAfterInnocent.status === 429,
      `Status: ${victimAfterInnocent.status}, Message: "${victimAfterInnocent.data.message}"`
    );

    // Subtest 4.3: Per-IP Rate Limit (Max 10 failed attempts)
    // Clear account limits, test IP threshold
    await LoginRateLimit.deleteMany({});
    let ipBlocked = false;
    for (let i = 1; i <= 12; i++) {
      const res = await client.post('/api/auth/login', {
        email: `rotating-account-${i}@test-security-refine.com`,
        password: 'WrongPassword',
      });
      if (res.status === 429 && res.data.message.includes('IP address')) {
        ipBlocked = true;
        report(
          'Per-IP Rate Limiter Blocks Spray Attack with HTTP 429',
          true,
          `IP blocked on attempt #${i}: "${res.data.message}"`
        );
        break;
      }
    }
    if (!ipBlocked) {
      report('Per-IP Rate Limiter Blocks Spray Attack with HTTP 429', false, 'Not blocked after 12 attempts');
    }

  } finally {
    server.close();
    // Cleanup
    await User.deleteMany({ email: /@test-security-refine\.com$/ });
    await LoginRateLimit.deleteMany({});
    await mongoose.disconnect();
  }

  console.log('\n=============================================================');
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`AUDIT RESULTS: ${totalPassed} / ${results.length} PASSED`);
  console.log('=============================================================');

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
