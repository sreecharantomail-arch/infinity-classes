import http from 'http';

const BASE_URL = 'http://127.0.0.1:5000/api';

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

async function runSecuritySuite() {
  console.log('===============================================================');
  console.log('   ADVANCED MERN SECURITY VERIFICATION & PEN-TEST SUITE        ');
  console.log('===============================================================\n');

  const tests = [];

  // 1. Password validation check (< 8 chars or no numbers)
  try {
    const short = await request('/auth/register', 'POST', {
      name: 'Weak Pass',
      email: `weak_${Date.now()}@test.com`,
      password: 'password', // no numbers
    });
    tests.push({
      name: 'Security 1: Password Complexity Enforcement (Min 8 chars, letters & numbers)',
      pass: short.status === 400 && short.data?.message?.includes('8 characters'),
      detail: short.data?.message,
    });
  } catch (e) {
    tests.push({ name: 'Security 1: Password Complexity', pass: false, error: e.message });
  }

  // 2. Admin secret protection on registration
  try {
    const attemptAdmin = await request('/auth/register', 'POST', {
      name: 'Hacker Admin',
      email: `hacker_${Date.now()}@test.com`,
      password: 'StrongPassword123',
      adminSecret: 'guessed_or_old_fallback_secret',
    });
    // Role must be student, NOT admin!
    tests.push({
      name: 'Security 2: Prevent Public Admin Role Escalation (Invalid secret defaults to student)',
      pass: attemptAdmin.status === 201 && attemptAdmin.data?.user?.role === 'student',
      detail: { roleAssigned: attemptAdmin.data?.user?.role },
    });
  } catch (e) {
    tests.push({ name: 'Security 2: Admin Escalation', pass: false, error: e.message });
  }

  // 3. Register valid student
  const student1Email = `student1_${Date.now()}@test.com`;
  let student1Token = null;
  let student1Id = null;
  try {
    const reg = await request('/auth/register', 'POST', {
      name: 'Verified Student 1',
      email: student1Email,
      password: 'StudentPassword123',
    });
    student1Token = reg.data?.token;
    student1Id = reg.data?.user?.id;
    tests.push({
      name: 'Security 3: Valid Student Registration with Enforced Password Policy',
      pass: reg.status === 201 && !!student1Token,
      detail: { email: student1Email, role: reg.data?.user?.role },
    });
  } catch (e) {
    tests.push({ name: 'Security 3: Student Registration', pass: false, error: e.message });
  }

  // 4. Server-Side Examination Session Initialization
  let sessionData = null;
  try {
    const sessionRes = await request('/questions/start-session', 'POST', null, student1Token);
    sessionData = sessionRes.data;
    const hasSessionId = !!sessionData?.sessionId;
    const countIs10 = sessionData?.questions?.length === 10;
    const answersStripped = sessionData?.questions?.every(
      (q) => q.correctOptionIndex === undefined && q.explanation === undefined
    );
    const hasExpiresAt = !!sessionData?.expiresAt;

    tests.push({
      name: 'Security 4: Server-Side Examination Session Created with 10 Questions',
      pass: sessionRes.status === 201 && hasSessionId && countIs10 && answersStripped && hasExpiresAt,
      detail: {
        sessionId: sessionData?.sessionId,
        startedAt: sessionData?.startedAt,
        expiresAt: sessionData?.expiresAt,
        questionCount: sessionData?.questions?.length,
        answersStripped,
      },
    });
  } catch (e) {
    tests.push({ name: 'Security 4: Start Session', pass: false, error: e.message });
  }

  // 5. Multi-Tab & Refresh Session Consistency
  try {
    // Simulate user refreshing or opening second tab: call start-session again
    const secondCall = await request('/questions/start-session', 'POST', null, student1Token);
    const sameSessionId = secondCall.data?.sessionId === sessionData?.sessionId;
    const sameDeadline = secondCall.data?.expiresAt === sessionData?.expiresAt;

    tests.push({
      name: 'Security 5: Server-Enforced Session Lock across Browser Refresh & Multi-Tab',
      pass: secondCall.status === 200 && sameSessionId && sameDeadline,
      detail: {
        isSameSession: sameSessionId,
        resumedStatus: secondCall.status,
        deadlineRetained: sameDeadline,
      },
    });
  } catch (e) {
    tests.push({ name: 'Security 5: Multi-Tab Session Lock', pass: false, error: e.message });
  }

  // 6. Cross-Student Session Protection: Student 2 cannot submit Student 1's session
  let student2Token = null;
  try {
    const reg2 = await request('/auth/register', 'POST', {
      name: 'Impostor Student 2',
      email: `student2_${Date.now()}@test.com`,
      password: 'StudentPassword123',
    });
    student2Token = reg2.data?.token;

    const fakePayload = sessionData.questions.map((q) => ({
      questionId: q._id,
      selectedOptionIndex: 1,
    }));

    const unauthorizedSubmit = await request(
      '/attempts/submit',
      'POST',
      { sessionId: sessionData.sessionId, answers: fakePayload },
      student2Token
    );

    tests.push({
      name: 'Security 6: Cross-Student Session Isolation (Student 2 cannot hijack Student 1 session)',
      pass: unauthorizedSubmit.status === 403,
      detail: { status: unauthorizedSubmit.status, message: unauthorizedSubmit.data?.message },
    });
  } catch (e) {
    tests.push({ name: 'Security 6: Cross-Student Hijack Test', pass: false, error: e.message });
  }

  // 7. Submission Question ID Validation (Duplicate question IDs rejection)
  try {
    const duplicateIdsPayload = [
      { questionId: sessionData.questions[0]._id, selectedOptionIndex: 1 },
      { questionId: sessionData.questions[0]._id, selectedOptionIndex: 2 }, // DUPLICATE!
      ...sessionData.questions.slice(2).map((q) => ({ questionId: q._id, selectedOptionIndex: 1 })),
    ];

    const dupRes = await request(
      '/attempts/submit',
      'POST',
      { sessionId: sessionData.sessionId, answers: duplicateIdsPayload },
      student1Token
    );

    tests.push({
      name: 'Security 7: Reject Duplicate Question IDs in Submission Payload',
      pass: dupRes.status === 400 && dupRes.data?.message?.includes('Duplicate question ID'),
      detail: { status: dupRes.status, message: dupRes.data?.message },
    });
  } catch (e) {
    tests.push({ name: 'Security 7: Duplicate Question Check', pass: false, error: e.message });
  }

  // 8. Submission Question ID Validation (Unknown / Foreign question ID rejection)
  try {
    const foreignIdsPayload = [
      { questionId: '65f123456789abcdef012345', selectedOptionIndex: 1 }, // FOREIGN ID
      ...sessionData.questions.slice(1).map((q) => ({ questionId: q._id, selectedOptionIndex: 1 })),
    ];

    const foreignRes = await request(
      '/attempts/submit',
      'POST',
      { sessionId: sessionData.sessionId, answers: foreignIdsPayload },
      student1Token
    );

    tests.push({
      name: 'Security 8: Reject Unknown / Foreign Question IDs in Submission Payload',
      pass: foreignRes.status === 400 && foreignRes.data?.message?.includes('Unknown question ID'),
      detail: { status: foreignRes.status, message: foreignRes.data?.message },
    });
  } catch (e) {
    tests.push({ name: 'Security 8: Foreign Question Check', pass: false, error: e.message });
  }

  // 9. Valid First-Time Submission & Score Calculation
  let attemptId = null;
  try {
    const validAnswers = sessionData.questions.map((q, idx) => ({
      questionId: q._id,
      selectedOptionIndex: idx % 3, // vary options
    }));

    const submitRes = await request(
      '/attempts/submit',
      'POST',
      {
        sessionId: sessionData.sessionId,
        answers: validAnswers,
        // Attempt tampering: sending fake score & time
        score: 100,
        timeSpentSeconds: 1,
      },
      student1Token
    );

    attemptId = submitRes.data?.attemptId;
    const computedScore = submitRes.data?.attempt?.score;

    tests.push({
      name: 'Security 9: Server-Calculated Score & Atomic Session Submission',
      pass: submitRes.status === 201 && !!attemptId && computedScore <= 10 && computedScore !== 100,
      detail: {
        status: submitRes.status,
        attemptId,
        serverComputedScore: computedScore,
        clientAttemptedScore: 100,
      },
    });
  } catch (e) {
    tests.push({ name: 'Security 9: Valid Submission', pass: false, error: e.message });
  }

  // 10. Atomic Duplicate Submission Prevention
  try {
    const validAnswers = sessionData.questions.map((q) => ({
      questionId: q._id,
      selectedOptionIndex: 1,
    }));

    // Submit the EXACT same session second time!
    const resubmit = await request(
      '/attempts/submit',
      'POST',
      { sessionId: sessionData.sessionId, answers: validAnswers },
      student1Token
    );

    tests.push({
      name: 'Security 10: Atomic Race Condition & Duplicate Submission Prevention',
      pass: resubmit.status === 400 && resubmit.data?.message?.includes('already been submitted'),
      detail: { status: resubmit.status, message: resubmit.data?.message },
    });
  } catch (e) {
    tests.push({ name: 'Security 10: Duplicate Submission Prevention', pass: false, error: e.message });
  }

  // 11. Login Rate Limiting (5 failed attempts trigger 429)
  try {
    let rateLimited = false;
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const failed = await request('/auth/login', 'POST', {
        email: 'attacker@test.com',
        password: `wrong_pass_${i}`,
      });
      lastStatus = failed.status;
      if (failed.status === 429) {
        rateLimited = true;
        break;
      }
    }

    tests.push({
      name: 'Security 11: Login Brute-Force Rate Limiting (Returns HTTP 429 after 5 failures)',
      pass: rateLimited,
      detail: { triggerStatus: lastStatus, rateLimitedTriggered: rateLimited },
    });
  } catch (e) {
    tests.push({ name: 'Security 11: Rate Limiting', pass: false, error: e.message });
  }

  console.log('\n===============================================================');
  console.log('                 VERIFICATION RESULTS                          ');
  console.log('===============================================================\n');

  let passed = 0;
  tests.forEach((t, idx) => {
    const icon = t.pass ? '✅ PASS' : '❌ FAIL';
    if (t.pass) passed++;
    console.log(`${idx + 1}. [${icon}] ${t.name}`);
    if (t.detail) console.log(`   Details:`, JSON.stringify(t.detail));
    if (t.error) console.log(`   Error:`, t.error);
  });

  console.log(`\nTOTAL PASSED: ${passed} / ${tests.length}`);
}

runSecuritySuite();
