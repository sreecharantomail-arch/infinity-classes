import mongoose from '../server/node_modules/mongoose/index.js';
import http from 'http';
import ExamSession from '../server/models/ExamSession.js';
import Question from '../server/models/Question.js';

async function testExpiredSession() {
  await mongoose.connect('mongodb://127.0.0.1:27017/online_test_app');

  // Log in as demo student
  const token = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(JSON.parse(d).token));
      }
    );
    req.write(JSON.stringify({ email: 'student@infinity.com', password: 'student123' }));
    req.end();
  });

  const questions = await Question.find().limit(10);
  const qIds = questions.map((q) => q._id);

  // Student ID
  const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

  // Create an expired session (started 20 mins ago, expired 10 mins ago)
  const expiredSession = await ExamSession.create({
    userId: decoded.id,
    questionIds: qIds,
    startedAt: new Date(Date.now() - 20 * 60 * 1000),
    expiresAt: new Date(Date.now() - 10 * 60 * 1000),
    status: 'in_progress',
  });

  // Attempt to submit this expired session
  const submitResponse = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/attempts/submit',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
      }
    );
    req.write(
      JSON.stringify({
        sessionId: expiredSession._id,
        answers: qIds.map((id) => ({ questionId: id, selectedOptionIndex: 1 })),
      })
    );
    req.end();
  });

  console.log('Expired Session Submit Status:', submitResponse.status);
  console.log('Expired Session Submit Message:', submitResponse.data.message);
  console.log(
    'Is Correctly Rejected (400 Bad Request)?:',
    submitResponse.status === 400 &&
      submitResponse.data.message.includes('deadline has expired')
  );

  await mongoose.connection.close();
}

testExpiredSession();
