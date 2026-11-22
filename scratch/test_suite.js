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
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function runAuditTests() {
  console.log('====================================================');
  console.log('       COMPREHENSIVE BACKEND & SECURITY AUDIT       ');
  console.log('====================================================\n');

  const results = [];

  // 1. Health check
  try {
    const health = await request('/health');
    results.push({ name: 'API Health Check', pass: health.status === 200, detail: health.data });
  } catch (err) {
    results.push({ name: 'API Health Check', pass: false, error: err.message });
  }

  // 2. Register a new student
  const uniqueEmail = `test_student_${Date.now()}@test.com`;
  let student1Token = null;
  let student1Id = null;
  try {
    const reg = await request('/auth/register', 'POST', {
      name: 'Audit Student 1',
      email: uniqueEmail,
      password: 'password123',
    });
    student1Token = reg.data?.token;
    student1Id = reg.data?.user?.id;
    results.push({
      name: 'Scenario 1: Register New Student',
      pass: reg.status === 201 && !!student1Token,
      detail: { status: reg.status, email: uniqueEmail },
    });
  } catch (err) {
    results.push({ name: 'Scenario 1: Register New Student', pass: false, error: err.message });
  }

  // 3. Register using duplicate email
  try {
    const dup = await request('/auth/register', 'POST', {
      name: 'Duplicate Student',
      email: uniqueEmail,
      password: 'password123',
    });
    results.push({
      name: 'Scenario 2: Register Existing Email',
      pass: dup.status === 400 && dup.data?.success === false,
      detail: { status: dup.status, message: dup.data?.message },
    });
  } catch (err) {
    results.push({ name: 'Scenario 2: Register Existing Email', pass: false, error: err.message });
  }

  // 4. Register with invalid password (< 6 chars)
  try {
    const shortPass = await request('/auth/register', 'POST', {
      name: 'Short Pass',
      email: `short_${Date.now()}@test.com`,
      password: '123',
    });
    results.push({
      name: 'Input Validation: Short Password (<6 chars)',
      pass: shortPass.status === 400,
      detail: { status: shortPass.status, message: shortPass.data?.message },
    });
  } catch (err) {
    results.push({ name: 'Input Validation: Short Password', pass: false, error: err.message });
  }

  // 5. Login with valid credentials
  try {
    const login = await request('/auth/login', 'POST', {
      email: uniqueEmail,
      password: 'password123',
    });
    results.push({
      name: 'Scenario 3: Login Valid Credentials',
      pass: login.status === 200 && !!login.data?.token,
      detail: { status: login.status, user: login.data?.user?.email },
    });
  } catch (err) {
    results.push({ name: 'Scenario 3: Login Valid Credentials', pass: false, error: err.message });
  }

  // 6. Login with invalid credentials
  try {
    const badLogin = await request('/auth/login', 'POST', {
      email: uniqueEmail,
      password: 'wrong_password_999',
    });
    results.push({
      name: 'Scenario 4: Login Invalid Credentials',
      pass: badLogin.status === 400 && badLogin.data?.success === false,
      detail: { status: badLogin.status, message: badLogin.data?.message },
    });
  } catch (err) {
    results.push({ name: 'Scenario 4: Login Invalid Credentials', pass: false, error: err.message });
  }

  // 7. Protected route without auth token
  try {
    const noAuth = await request('/questions/test', 'GET');
    results.push({
      name: 'Scenario 5: Access Protected Endpoint Without Token',
      pass: noAuth.status === 401,
      detail: { status: noAuth.status, message: noAuth.data?.message },
    });
  } catch (err) {
    results.push({ name: 'Scenario 5: Access Without Token', pass: false, error: err.message });
  }

  // 8. Fetch 10 questions for examination
  let fetchedQuestions = [];
  try {
    const qRes = await request('/questions/test', 'GET', null, student1Token);
    fetchedQuestions = qRes.data?.questions || [];
    const countIs10 = fetchedQuestions.length === 10;
    const hasOptions = fetchedQuestions.every((q) => q.options?.length === 4);
    const answersStripped = fetchedQuestions.every(
      (q) => q.correctOptionIndex === undefined && q.explanation === undefined
    );

    results.push({
      name: 'Scenario 6: Start Exam (Fetch exactly 10 questions from MongoDB)',
      pass: qRes.status === 200 && countIs10 && hasOptions,
      detail: { count: fetchedQuestions.length, hasOptions },
    });

    results.push({
      name: 'Security Check: Correct answers stripped before submission',
      pass: answersStripped,
      detail: { answersStripped, leakedSample: fetchedQuestions[0]?.correctOptionIndex },
    });
  } catch (err) {
    results.push({ name: 'Scenario 6: Fetch Exam Questions', pass: false, error: err.message });
  }

  // 9. Submit all 10 questions manually
  let attempt1Id = null;
  try {
    const answersPayload = fetchedQuestions.map((q, idx) => ({
      questionId: q._id,
      selectedOptionIndex: idx % 4, // vary chosen options
    }));

    const submitRes = await request(
      '/attempts/submit',
      'POST',
      {
        answers: answersPayload,
        timeSpentSeconds: 245,
        isTimedOut: false,
        // Attempt score injection: frontend sending custom score
        score: 999,
        percentage: 100,
      },
      student1Token
    );

    attempt1Id = submitRes.data?.attemptId;
    const calculatedScore = submitRes.data?.attempt?.score;
    const scoreNotOverridden = calculatedScore !== 999;

    results.push({
      name: 'Scenario 7 & 8: Answer all 10 questions & Manual Submit',
      pass: submitRes.status === 201 && !!attempt1Id,
      detail: {
        status: submitRes.status,
        attemptId: attempt1Id,
        score: calculatedScore,
        percentage: submitRes.data?.attempt?.percentage,
      },
    });

    results.push({
      name: 'Scenario 15 / Security: Backend Score Calculation (Client cannot inject fake score)',
      pass: scoreNotOverridden && calculatedScore <= 10,
      detail: { attemptedScore: 999, actualScore: calculatedScore },
    });
  } catch (err) {
    results.push({ name: 'Scenario 7 & 8: Submit Test', pass: false, error: err.message });
  }

  // 10. Auto-submission scenario (timed out, unanswered questions)
  let attempt2Id = null;
  try {
    const partialAnswers = fetchedQuestions.map((q, idx) => ({
      questionId: q._id,
      selectedOptionIndex: idx < 4 ? 1 : null, // 4 answered, 6 unattempted
    }));

    const autoSub = await request(
      '/attempts/submit',
      'POST',
      {
        answers: partialAnswers,
        timeSpentSeconds: 600,
        isTimedOut: true,
      },
      student1Token
    );

    attempt2Id = autoSub.data?.attemptId;
    const att = autoSub.data?.attempt;

    results.push({
      name: 'Scenario 9 & 10: Auto-submission & Unanswered Questions Handling',
      pass:
        autoSub.status === 201 &&
        att?.status === 'timed_out' &&
        att?.unattemptedCount === 6 &&
        att?.timeSpentSeconds === 600,
      detail: {
        status: att?.status,
        unattempted: att?.unattemptedCount,
        answered: att?.correctAnswersCount + att?.incorrectAnswersCount,
      },
    });
  } catch (err) {
    results.push({ name: 'Scenario 9 & 10: Auto-submission', pass: false, error: err.message });
  }

  // 11. View previous attempts (History)
  try {
    const hist = await request('/attempts/my-history', 'GET', null, student1Token);
    results.push({
      name: 'Scenario 13: View Previous Attempts (History)',
      pass: hist.status === 200 && Array.isArray(hist.data?.attempts) && hist.data.attempts.length >= 2,
      detail: { count: hist.data?.attempts?.length },
    });
  } catch (err) {
    results.push({ name: 'Scenario 13: View Attempts History', pass: false, error: err.message });
  }

  // 12. Register Student 2 and test Cross-Student Data Isolation (IDOR)
  const student2Email = `test_student2_${Date.now()}@test.com`;
  let student2Token = null;
  try {
    const reg2 = await request('/auth/register', 'POST', {
      name: 'Audit Student 2',
      email: student2Email,
      password: 'password123',
    });
    student2Token = reg2.data?.token;

    // Student 2 tries to access Student 1's test result (attempt1Id)
    const unauthorizedAccess = await request(
      `/attempts/${attempt1Id}`,
      'GET',
      null,
      student2Token
    );

    results.push({
      name: 'Scenario 14 / Security: Access Control (Student 2 cannot view Student 1 results)',
      pass: unauthorizedAccess.status === 403,
      detail: {
        status: unauthorizedAccess.status,
        message: unauthorizedAccess.data?.message,
      },
    });
  } catch (err) {
    results.push({ name: 'Scenario 14: Cross-Student Isolation', pass: false, error: err.message });
  }

  // 13. Role escalation check: Can student call Admin endpoints?
  try {
    const studentCallAdmin = await request('/questions/all', 'GET', null, student1Token);
    const studentCreateQuestion = await request(
      '/questions',
      'POST',
      {
        questionText: 'Unauthorized Question?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
      },
      student1Token
    );

    const blocked = studentCallAdmin.status === 403 && studentCreateQuestion.status === 403;
    results.push({
      name: 'Security: Role-Based Authorization (Student cannot access Admin endpoints)',
      pass: blocked,
      detail: {
        getQuestionsStatus: studentCallAdmin.status,
        postQuestionStatus: studentCreateQuestion.status,
      },
    });
  } catch (err) {
    results.push({ name: 'Role Escalation Check', pass: false, error: err.message });
  }

  // 14. Admin account login & bonus features verification
  try {
    const adminLogin = await request('/auth/login', 'POST', {
      email: 'admin@infinity.com',
      password: 'admin123',
    });
    const adminToken = adminLogin.data?.token;

    const allQ = await request('/questions/all', 'GET', null, adminToken);
    results.push({
      name: 'Bonus Feature: Admin view all questions & answers',
      pass: allQ.status === 200 && allQ.data?.questions?.length >= 15,
      detail: { count: allQ.data?.questions?.length },
    });
  } catch (err) {
    results.push({ name: 'Bonus Feature: Admin access', pass: false, error: err.message });
  }

  // 15. NoSQL injection test on login
  try {
    const nosqlPayload = { email: { $gt: '' }, password: { $gt: '' } };
    const nosqlRes = await request('/auth/login', 'POST', nosqlPayload);
    // Should fail with 400 or 500, MUST NOT succeed
    const notLoggedIn = nosqlRes.status !== 200;
    results.push({
      name: 'Security: NoSQL Injection Resistance on Login',
      pass: notLoggedIn,
      detail: { status: nosqlRes.status, success: nosqlRes.data?.success },
    });
  } catch (err) {
    results.push({ name: 'NoSQL Injection Test', pass: false, error: err.message });
  }

  console.log('RESULTS SUMMARY:\n');
  results.forEach((r, idx) => {
    const icon = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. [${icon}] ${r.name}`);
    if (r.detail) console.log(`   Details:`, JSON.stringify(r.detail));
    if (r.error) console.log(`   Error:`, r.error);
  });
}

runAuditTests();
