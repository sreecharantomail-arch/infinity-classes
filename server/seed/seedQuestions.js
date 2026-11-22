import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Question from '../models/Question.js';
import User from '../models/User.js';
import { defaultQuestions } from './questionsData.js';

dotenv.config();

export const seedDatabase = async () => {
  try {
    // 1. Seed Questions if count is 0
    const qCount = await Question.countDocuments();
    if (qCount === 0) {
      console.log('Seeding question bank with default questions...');
      await Question.insertMany(defaultQuestions);
      console.log(`✅ Seeded ${defaultQuestions.length} questions.`);
    } else {
      console.log(`ℹ️ Question bank already has ${qCount} questions.`);
    }

    // 2. Seed Demo Student
    const studentExists = await User.findOne({ email: 'student@infinity.com' });
    if (!studentExists) {
      const studentSalt = await bcrypt.genSalt(10);
      const studentPassword = await bcrypt.hash('student123', studentSalt);
      await User.create({
        name: 'Demo Student',
        email: 'student@infinity.com',
        password: studentPassword,
        role: 'student',
      });
      console.log('✅ Demo Student created: student@infinity.com / student123');
    }

    // 3. Seed Demo Admin
    const adminExists = await User.findOne({ email: 'admin@infinity.com' });
    if (!adminExists) {
      const adminSalt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash('admin123', adminSalt);
      await User.create({
        name: 'Demo Admin',
        email: 'admin@infinity.com',
        password: adminPassword,
        role: 'admin',
      });
      console.log('✅ Demo Admin created: admin@infinity.com / admin123');
    }
  } catch (error) {
    console.error('Error during auto-seed:', error.message);
  }
};

// If run directly via CLI (e.g. npm run seed)
if (process.argv[1]?.endsWith('seedQuestions.js')) {
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/online_test_app';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log('Connected to MongoDB. Running seed...');
      await seedDatabase();
      await mongoose.connection.close();
      console.log('Seeding completed. Connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding connection error:', err);
      process.exit(1);
    });
}
