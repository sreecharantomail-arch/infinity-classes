import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Requirement: Use a SEPARATE test database for testing
const AUDIT_TEST_DB_URI = 'mongodb://127.0.0.1:27017/online_test_adversarial_audit_db';
const JWT_SECRET = process.env.JWT_SECRET || 'adversarial_test_secret_key_123';
process.env.JWT_SECRET = JWT_SECRET;

const results = [];
function recordResult(caseNumber, name, status, details) {
  results.push({ caseNumber, name, status, details });
  const icon = status === 'PASS' ? '✅ PASS' : status === 'FAIL' ? '❌ FAIL' : '⚠️ NOT TESTED';
  console.log(`[Case ${caseNumber}] ${icon}: ${name}\n   Details: ${details}\n`);
}

async function runAdversarialAudit() {
  console.log('================================================================');
  console.log('  STARTING ADVERSARIAL RELIABILITY & SECURITY AUDIT TEST SUITE');
  console.log(`  Target DB: ${AUDIT_TEST_DB_URI}`);
  console.log('================================================================\n');

  // Connect to the isolated test database
  await mongoose.connect(AUDIT_TEST_DB_URI);
  console.log('Connected to isolated audit test database:', mongoose.connection.name);

  // Dynamically import models & routes after mongoose is connected
  const User = (await import('../server/models/User.js')).default;
  const Question = (await import('../server/models/Question.js')).default;
  const ExamSession = (await import('../server/models/ExamSession.js')).default;
  const Attempt = (await import('../server/models/Attempt.js')).default;
  const LoginRateLimit = (await import('../server/models/LoginRateLimit.js')).default;

  // Sync schema indexes on the test database
  await ExamSession.syncIndexes();
  await Attempt.syncIndexes();
  await LoginRateLimit.syncIndexes();

  // Reset isolated test database collections
  await User.deleteMany({});
  await Question.deleteMany({});
  await ExamSession.deleteMany({});
  await Attempt.deleteMany({});
  await LoginRateLimit.deleteMany({});

  // 1. Seed 10 standard test questions
  const createdQuestions = [];
  for (let i = 1; i <= 10; i++) {
    createdQuestions.push({
      questionText: `Audit Question #${i}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: (i % 4),
      category: 'Audit',
      difficulty: 'medium',
    });
  }
  const seededQuestions = await Question.insertMany(createdQuestions);
  const questionIds = seededQuestions.map((q) => q._id);

  // 2. Create Student A and Student B
  const passwordHash = await bcrypt.hash('StrongPass123', 10);
  const studentA = await User.create({
    name: 'Student Alice',
    email: 'alice@audit-test.com',
    password: passwordHash,
    role: 'student',
  });

  const studentB = await User.create({
    name: 'Student Bob',
    email: 'bob@audit-test.com',
    password: passwordHash,
    role: 'student',
  });

  const tokenA = jwt.sign({ id: studentA._id, role: studentA.role }, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign({ id: studentB._id, role: studentB.role }, JWT_SECRET, { expiresIn: '1h' });

  // 3. Spin up Express app instance
  const { default: express } = await import('express');
  const authRoutes = (await import('../server/routes/auth.js')).default;
  const questionRoutes = (await import('../server/routes/questions.js')).default;
  const attemptRoutes = (await import('../server/routes/attempts.js')).default;

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
      return { status: res.status, headers: res.headers, data };
    },
    get: async (endpoint, headers = {}) => {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, headers: res.headers, data };
    },
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Simultaneous examination session creation
    // -------------------------------------------------------------------------
    console.log('Running Test 1: Simultaneous examination session creation...');
    const startPromises = Array.from({ length: 6 }, () =>
      client.post('/api/questions/start-session', {}, { Authorization: `Bearer ${tokenA}` })
    );
    const startResponses = await Promise.all(startPromises);
    const sessionIds = startResponses.map((r) => r.data.sessionId).filter(Boolean);
    const uniqueSessionIds = new Set(sessionIds);
    const activeSessionsCount = await ExamSession.countDocuments({
      userId: studentA._id,
      status: 'in_progress',
    });

    if (uniqueSessionIds.size === 1 && activeSessionsCount === 1) {
      recordResult(
        1,
        'Simultaneous Examination Session Creation',
        'PASS',
        `6 concurrent requests resolved to exact same session (${sessionIds[0]}); exactly 1 in_progress session in MongoDB.`
      );
    } else {
      recordResult(
        1,
        'Simultaneous Examination Session Creation',
        'FAIL',
        `Expected 1 unique session, got ${uniqueSessionIds.size}. Active sessions in DB: ${activeSessionsCount}.`
      );
    }
    const aliceSessionId = sessionIds[0];

    // -------------------------------------------------------------------------
    // TEST 2: Simultaneous examination submissions
    // -------------------------------------------------------------------------
    console.log('Running Test 2: Simultaneous examination submissions...');
    const validAnswers = seededQuestions.map((q) => ({
      questionId: q._id,
      selectedOptionIndex: q.correctOptionIndex,
    }));

    // Send 4 simultaneous submissions for the same session
    const submitPromises = Array.from({ length: 4 }, () =>
      client.post(
        '/api/attempts/submit',
        { sessionId: aliceSessionId, answers: validAnswers },
        { Authorization: `Bearer ${tokenA}` }
      )
    );
    const submitResponses = await Promise.all(submitPromises);
    const statuses = submitResponses.map((r) => r.status);
    const createdAttemptsCount = await Attempt.countDocuments({ sessionId: aliceSessionId });

    // Expect: exactly one 201 Created (or 200 OK idempotent), other concurrent calls get 409 or 200, strictly 1 Attempt in DB
    const successCount = submitResponses.filter((r) => r.status === 201 || r.status === 200).length;
    if (createdAttemptsCount === 1 && successCount >= 1) {
      recordResult(
        2,
        'Simultaneous Examination Submissions',
        'PASS',
        `Statuses: [${statuses.join(', ')}]. Exactly 1 Attempt created in MongoDB without race collisions.`
      );
    } else {
      recordResult(
        2,
        'Simultaneous Examination Submissions',
        'FAIL',
        `Created attempts in DB: ${createdAttemptsCount}. Statuses: [${statuses.join(', ')}].`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 3: Interrupted submission recovery
    // -------------------------------------------------------------------------
    console.log('Running Test 3: Interrupted submission recovery...');
    // Create a new session for Student A that gets stuck in 'submitting'
    const stuckSession = await ExamSession.create({
      userId: studentA._id,
      questionIds,
      startedAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() + 500000),
      status: 'submitting',
      submittingAt: new Date(Date.now() - 40000), // 40 seconds ago (> 30s threshold)
    });

    const recoveryRes = await client.post(
      '/api/attempts/submit',
      { sessionId: stuckSession._id, answers: validAnswers },
      { Authorization: `Bearer ${tokenA}` }
    );

    const recoveredAttempt = await Attempt.findOne({ sessionId: stuckSession._id });
    if (recoveryRes.status === 201 && recoveredAttempt) {
      recordResult(
        3,
        'Interrupted Submission Recovery',
        'PASS',
        `Session stuck in 'submitting' for >30s successfully unlocked, evaluated, and saved (Status: ${recoveryRes.status}, AttemptId: ${recoveryRes.data.attemptId}).`
      );
    } else {
      recordResult(
        3,
        'Interrupted Submission Recovery',
        'FAIL',
        `Recovery returned status ${recoveryRes.status}: ${JSON.stringify(recoveryRes.data)}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate result prevention
    // -------------------------------------------------------------------------
    console.log('Running Test 4: Duplicate result prevention...');
    const reSubmitRes = await client.post(
      '/api/attempts/submit',
      { sessionId: stuckSession._id, answers: validAnswers },
      { Authorization: `Bearer ${tokenA}` }
    );
    const attemptCountForStuck = await Attempt.countDocuments({ sessionId: stuckSession._id });

    if (reSubmitRes.status === 200 && attemptCountForStuck === 1) {
      recordResult(
        4,
        'Duplicate Result Prevention',
        'PASS',
        `Re-submission returned HTTP 200 with existing attempt. Attempt count in DB remains strictly 1.`
      );
    } else {
      recordResult(
        4,
        'Duplicate Result Prevention',
        'FAIL',
        `Status: ${reSubmitRes.status}, Attempt count in DB: ${attemptCountForStuck}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 5: Invalid answer values
    // -------------------------------------------------------------------------
    console.log('Running Test 5: Invalid answer values...');
    // Create fresh session
    const test5Session = await ExamSession.create({
      userId: studentA._id,
      questionIds,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      status: 'in_progress',
    });

    const badTypes = [
      { name: 'String Option ("2")', val: '2' },
      { name: 'Float Option (1.5)', val: 1.5 },
      { name: 'Boolean Option (true)', val: true },
      { name: 'Array Option ([1])', val: [1] },
      { name: 'Negative Option (-1)', val: -1 },
      { name: 'Out-of-range Option (4)', val: 4 },
    ];

    let allBadTypesRejected = true;
    for (const b of badTypes) {
      const payload = {
        sessionId: test5Session._id,
        answers: questionIds.map((qId) => ({ questionId: qId, selectedOptionIndex: b.val })),
      };
      const res = await client.post('/api/attempts/submit', payload, {
        Authorization: `Bearer ${tokenA}`,
      });
      if (res.status !== 400) {
        allBadTypesRejected = false;
        console.log(`Failed to reject bad value: ${b.name}, got status ${res.status}`);
      }
    }

    if (allBadTypesRejected) {
      recordResult(
        5,
        'Invalid Answer Values',
        'PASS',
        'Strings, floats, booleans, arrays, negative numbers, and out-of-range options were all strictly rejected with HTTP 400.'
      );
    } else {
      recordResult(
        5,
        'Invalid Answer Values',
        'FAIL',
        'One or more invalid answer types were not rejected with HTTP 400.'
      );
    }

    // -------------------------------------------------------------------------
    // TEST 6: Cross-student result access restrictions
    // -------------------------------------------------------------------------
    console.log('Running Test 6: Cross-student result access restrictions...');
    // Bob attempts to submit or retrieve Alice's completed session
    const crossStudentSubmit = await client.post(
      '/api/attempts/submit',
      { sessionId: aliceSessionId, answers: validAnswers },
      { Authorization: `Bearer ${tokenB}` } // Bob's token
    );

    // In commit 26d7140, line 36 check: Attempt.findOne({ sessionId }) returned HTTP 200 without checking userId!
    if (crossStudentSubmit.status === 403) {
      recordResult(
        6,
        'Cross-Student Result Access Restrictions',
        'PASS',
        `Bob was rejected with HTTP 403 Forbidden when attempting to access Alice's session.`
      );
    } else if (crossStudentSubmit.status === 200) {
      recordResult(
        6,
        'Cross-Student Result Access Restrictions',
        'FAIL',
        `CRITICAL: Bob received Alice's attempt data with HTTP 200! Student ownership was not verified on the idempotent return path.`
      );
    } else {
      recordResult(
        6,
        'Cross-Student Result Access Restrictions',
        'FAIL',
        `Unexpected response status: ${crossStudentSubmit.status}.`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7: Expired examination sessions
    // -------------------------------------------------------------------------
    console.log('Running Test 7: Expired examination sessions...');
    const expiredSession = await ExamSession.create({
      userId: studentB._id,
      questionIds,
      startedAt: new Date(Date.now() - 700000),
      expiresAt: new Date(Date.now() - 100000), // Expired >15s ago
      status: 'in_progress',
    });

    const expiredSubmitRes = await client.post(
      '/api/attempts/submit',
      { sessionId: expiredSession._id, answers: validAnswers },
      { Authorization: `Bearer ${tokenB}` }
    );

    if (expiredSubmitRes.status === 400 && expiredSubmitRes.data.message.includes('expired')) {
      recordResult(
        7,
        'Expired Examination Sessions',
        'PASS',
        `Submission for expired session rejected with HTTP 400: "${expiredSubmitRes.data.message}".`
      );
    } else {
      recordResult(
        7,
        'Expired Examination Sessions',
        'FAIL',
        `Status: ${expiredSubmitRes.status}, Message: ${expiredSubmitRes.data.message}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 8: Multiple login requests
    // -------------------------------------------------------------------------
    console.log('Running Test 8: Multiple login requests...');
    // Create victim user
    await User.create({
      name: 'Victim User',
      email: 'victim@audit-test.com',
      password: passwordHash,
      role: 'student',
    });

    let lockedAccount = false;
    for (let i = 1; i <= 6; i++) {
      const res = await client.post('/api/auth/login', {
        email: 'victim@audit-test.com',
        password: 'WrongPassword',
      });
      if (res.status === 429) {
        lockedAccount = true;
        break;
      }
    }

    if (lockedAccount) {
      recordResult(
        8,
        'Multiple Login Requests (Rate Limiting)',
        'PASS',
        'Repeated failed login requests triggered HTTP 429 account lockout after 5 attempts.'
      );
    } else {
      recordResult(
        8,
        'Multiple Login Requests (Rate Limiting)',
        'FAIL',
        'Account was not locked after 6 consecutive failed login attempts.'
      );
    }

    // -------------------------------------------------------------------------
    // TEST 9: Rate-limit persistence
    // -------------------------------------------------------------------------
    console.log('Running Test 9: Rate-limit persistence...');
    const dbRateLimitRecord = await LoginRateLimit.findOne({ key: 'account:victim@audit-test.com' });
    const hasTtlIndex = (await LoginRateLimit.collection.indexes()).some(
      (idx) => idx.expireAfterSeconds === 900 || idx.name === 'firstAttemptTime_1'
    );

    if (dbRateLimitRecord && dbRateLimitRecord.count >= 5 && hasTtlIndex) {
      recordResult(
        9,
        'Rate-Limit Persistence & TTL Index',
        'PASS',
        `Rate limit record persisted in MongoDB (count: ${dbRateLimitRecord.count}). MongoDB TTL index confirmed.`
      );
    } else {
      recordResult(
        9,
        'Rate-Limit Persistence & TTL Index',
        'FAIL',
        `Record in DB: ${Boolean(dbRateLimitRecord)}, TTL index found: ${hasTtlIndex}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 10: Database connection failure resilience
    // -------------------------------------------------------------------------
    console.log('Running Test 10: Database connection failure resilience...');
    // Disconnect MongoDB and test API error response handling
    await mongoose.disconnect();

    const dbDownRes = await client.post('/api/auth/login', {
      email: 'alice@audit-test.com',
      password: 'StrongPass123',
    });

    if (dbDownRes.status === 500 && dbDownRes.data.success === false) {
      recordResult(
        10,
        'Database Connection Failure Resilience',
        'PASS',
        `Server gracefully returned HTTP 500 JSON without process termination/crash when MongoDB is disconnected.`
      );
    } else {
      recordResult(
        10,
        'Database Connection Failure Resilience',
        'FAIL',
        `Unexpected response on DB failure: Status ${dbDownRes.status}`
      );
    }

  } finally {
    server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('\n================================================================');
  console.log('  ADVERSARIAL AUDIT TEST SUMMARY:');
  console.log('================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('================================================================\n');
}

runAdversarialAudit().catch((err) => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
