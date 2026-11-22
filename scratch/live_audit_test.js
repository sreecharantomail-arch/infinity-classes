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
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
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

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'Request Timed Out (Mongoose Buffering / DB Down)' });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function testLiveDeployment() {
  console.log('=================================================================');
  console.log('   AUDITING LIVE PRODUCTION APP (Render + MongoDB Atlas)         ');
  console.log('   Target: https://infinity-classes-online-test-app.onrender.com ');
  console.log('=================================================================\n');

  // 1. Health check
  console.log('Checking /api/health ...');
  const health = await request('/health');
  console.log('Health Response Status:', health.status, JSON.stringify(health.data || health.error));

  // 2. Login with seeded student account
  console.log('\nTesting Login with student@infinity.com / student123 ...');
  const login = await request('/auth/login', 'POST', {
    email: 'student@infinity.com',
    password: 'student123',
  });
  console.log('Login Response Status:', login.status);
  console.log('Login Response Body:', JSON.stringify(login.data || login.error));

  // 3. Register a fresh new student
  const freshEmail = `live_audit_${Date.now()}@example.com`;
  console.log(`\nAttempting registration with ${freshEmail} ...`);
  const reg = await request('/auth/register', 'POST', {
    name: 'Auditor Student',
    email: freshEmail,
    password: 'Password123!',
  });
  console.log('Register Response Status:', reg.status);
  console.log('Register Response Body:', JSON.stringify(reg.data || reg.error));

  let token = login.data?.token || reg.data?.token;

  if (token) {
    // 4. Fetch test questions
    console.log('\nFetching 10 Test Questions from Live MongoDB ...');
    const questions = await request('/questions/test', 'GET', null, token);
    console.log('Questions Status:', questions.status);
    console.log('Questions Count:', questions.data?.questions?.length);
    if (questions.data?.questions?.length > 0) {
      console.log('Sample Question 1:', questions.data.questions[0].questionText);
      console.log('Options Count:', questions.data.questions[0].options?.length);
      console.log('Answers Hidden?:', questions.data.questions[0].correctOptionIndex === undefined);
    }

    // 5. Submit an attempt
    if (questions.data?.questions?.length > 0) {
      console.log('\nSubmitting Live Test Attempt ...');
      const answers = questions.data.questions.map((q, idx) => ({
        questionId: q._id,
        selectedOptionIndex: idx % 4,
      }));

      const submit = await request(
        '/attempts/submit',
        'POST',
        {
          answers,
          timeSpentSeconds: 190,
          isTimedOut: false,
        },
        token
      );
      console.log('Submit Response Status:', submit.status);
      console.log('Attempt Score:', submit.data?.attempt?.score, '/', submit.data?.attempt?.totalQuestions);
      console.log('Accuracy Percentage:', submit.data?.attempt?.percentage + '%');

      // 6. Fetch history
      console.log('\nFetching Live Attempt History ...');
      const hist = await request('/attempts/my-history', 'GET', null, token);
      console.log('History Status:', hist.status);
      console.log('History Count:', hist.data?.attempts?.length);
    }
  } else {
    console.log('\n⚠️ Authentication failed on live server. Investigating cause...');
  }
}

testLiveDeployment();

