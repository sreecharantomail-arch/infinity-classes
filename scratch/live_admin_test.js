import https from 'https';

const LIVE_BASE = 'https://infinity-classes-online-test-app.onrender.com/api';

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${LIVE_BASE}${path}`);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(options, (res) => {
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
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
};

async function testLiveAdminAndSecurity() {
  console.log('\n--- TESTING LIVE ADMIN & SECURITY ---');

  // 1. Admin login
  const adminLogin = await request('/auth/login', 'POST', {
    email: 'admin@infinity.com',
    password: 'admin123',
  });
  console.log('Live Admin Login:', adminLogin.status, adminLogin.data?.user?.role);
  const adminToken = adminLogin.data?.token;

  // 2. Fetch all questions as admin
  const allQ = await request('/questions/all', 'GET', null, adminToken);
  console.log('Live Admin View All Questions Count:', allQ.data?.questions?.length);

  // 3. Admin create question
  const createQ = await request(
    '/questions',
    'POST',
    {
      questionText: 'Which command compiles Jetpack Compose previews?',
      options: ['gradle build', 'android preview render', 'npm run build', 'tsc'],
      correctOptionIndex: 1,
      category: 'Android',
      explanation: 'The Android CLI preview plugin uses android preview render.',
    },
    adminToken
  );
  console.log('Live Admin Create Question Status:', createQ.status, 'ID:', createQ.data?.question?._id);

  // 4. Admin delete question
  if (createQ.data?.question?._id) {
    const delQ = await request(`/questions/${createQ.data.question._id}`, 'DELETE', null, adminToken);
    console.log('Live Admin Delete Question Status:', delQ.status, delQ.data?.message);
  }

  // 5. Cross-student data isolation test on live
  console.log('\n--- TESTING CROSS-STUDENT PRIVACY ON LIVE ---');
  // Student A logs in
  const studentA = await request('/auth/login', 'POST', { email: 'student@infinity.com', password: 'student123' });
  const histA = await request('/attempts/my-history', 'GET', null, studentA.data?.token);
  const attemptId = histA.data?.attempts?.[0]?._id;

  // Student B registers
  const studentB = await request('/auth/register', 'POST', {
    name: 'Snooping Student',
    email: `snoop_${Date.now()}@example.com`,
    password: 'Password123!',
  });

  // Student B attempts to read Student A's test attempt
  const snoopAttempt = await request(`/attempts/${attemptId}`, 'GET', null, studentB.data?.token);
  console.log('Student B Access to Student A Attempt:', snoopAttempt.status, snoopAttempt.data?.message);
}

testLiveAdminAndSecurity();

