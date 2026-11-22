import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Sliding-window in-memory login rate limiter (max 5 failed attempts per 15 minutes per IP)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// Clean up stale rate-limit records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

const generateToken = (userId, role) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not defined.');
  }
  return jwt.sign({ id: userId, role }, jwtSecret, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new student (admin requires explicit environment secret)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;

    // Strict input type validation against NoSQL injection / object attacks
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format. Name, email, and password must be strings.',
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    // Improved Password Validation: minimum 8 characters with at least one letter and one number
    if (password.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 8 characters long and contain both letters and numbers.',
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Role security: default to 'student'.
    // ONLY assign 'admin' if ADMIN_SECRET is configured in environment AND matches payload
    let userRole = 'student';
    if (
      adminSecret &&
      process.env.ADMIN_SECRET &&
      adminSecret === process.env.ADMIN_SECRET
    ) {
      userRole = 'admin';
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
      role: userRole,
    });

    const token = generateToken(newUser._id, newUser.role);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with rate limiting & return JWT token
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown-ip';
    const now = Date.now();

    // Check rate limiting
    const attemptRecord = loginAttempts.get(clientIp);
    if (attemptRecord) {
      if (now - attemptRecord.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
        // Window expired, reset
        loginAttempts.delete(clientIp);
      } else if (attemptRecord.count >= MAX_FAILED_ATTEMPTS) {
        const remainingMinutes = Math.ceil(
          (RATE_LIMIT_WINDOW_MS - (now - attemptRecord.firstAttemptTime)) / 60000
        );
        return res.status(429).json({
          success: false,
          message: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        });
      }
    }

    const { email, password } = req.body;

    // Strict input type check to prevent NoSQL injection / object pass-through
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request format. Email and password must be strings.',
      });
    }

    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      // Record failed attempt
      const current = loginAttempts.get(clientIp) || { count: 0, firstAttemptTime: now };
      current.count += 1;
      loginAttempts.set(clientIp, current);

      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Record failed attempt
      const current = loginAttempts.get(clientIp) || { count: 0, firstAttemptTime: now };
      current.count += 1;
      loginAttempts.set(clientIp, current);

      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Login successful: reset rate-limiting counter for this IP
    loginAttempts.delete(clientIp);

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default router;
