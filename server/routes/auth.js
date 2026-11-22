import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LoginRateLimit from '../models/LoginRateLimit.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Dual-track Sliding-Window Rate Limiter Config
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ACCOUNT = 5; // 5 failed attempts per account
const MAX_FAILED_IP = 10; // 10 failed attempts per IP

// Sliding-window in-memory stores for fast low-latency checks
const ipRateLimits = new Map();
const accountRateLimits = new Map();

// Periodic cleanup of stale in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of ipRateLimits.entries()) {
    if (now - data.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
      ipRateLimits.delete(key);
    }
  }
  for (const [key, data] of accountRateLimits.entries()) {
    if (now - data.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
      accountRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Helper to check rate limit against both in-memory store and MongoDB
const checkRateLimit = async (type, key, maxAllowed) => {
  const now = Date.now();
  const memoryStore = type === 'account' ? accountRateLimits : ipRateLimits;

  // 1. In-memory check
  const memRecord = memoryStore.get(key);
  if (memRecord) {
    if (now - memRecord.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
      memoryStore.delete(key);
    } else if (memRecord.count >= maxAllowed) {
      const remainingMinutes = Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - memRecord.firstAttemptTime)) / 60000
      );
      return { allowed: false, remainingMinutes, count: memRecord.count };
    }
  }

  // 2. Persistent MongoDB check (resilient across server restarts / multi-instance setups)
  try {
    const dbRecord = await LoginRateLimit.findOne({ key: `${type}:${key}` });
    if (dbRecord) {
      const firstTime = new Date(dbRecord.firstAttemptTime).getTime();
      if (now - firstTime > RATE_LIMIT_WINDOW_MS) {
        await LoginRateLimit.deleteOne({ _id: dbRecord._id }).catch(() => {});
      } else if (dbRecord.count >= maxAllowed) {
        const remainingMinutes = Math.ceil(
          (RATE_LIMIT_WINDOW_MS - (now - firstTime)) / 60000
        );
        // Sync to memory
        memoryStore.set(key, { count: dbRecord.count, firstAttemptTime: firstTime });
        return { allowed: false, remainingMinutes, count: dbRecord.count };
      }
    }
  } catch (err) {
    // Graceful non-blocking fallback if MongoDB query fails
  }

  return { allowed: true };
};

// Helper to record failed attempt in both in-memory store and MongoDB
const recordFailedAttempt = async (type, key) => {
  const now = Date.now();
  const memoryStore = type === 'account' ? accountRateLimits : ipRateLimits;

  // 1. Update in-memory
  const memRecord = memoryStore.get(key);
  if (!memRecord || now - memRecord.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
    memoryStore.set(key, { count: 1, firstAttemptTime: now, lastAttemptTime: now });
  } else {
    memRecord.count += 1;
    memRecord.lastAttemptTime = now;
  }

  // 2. Update persistent MongoDB record
  try {
    await LoginRateLimit.findOneAndUpdate(
      { key: `${type}:${key}` },
      {
        $setOnInsert: { key: `${type}:${key}`, type, firstAttemptTime: new Date(now) },
        $inc: { count: 1 },
        $set: { lastAttemptTime: new Date(now) },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Graceful fallback to memory
  }
};

// Helper to reset rate limits upon successful login
const recordSuccessfulLogin = async (email, clientIp) => {
  // Reset account counter ONLY for the authenticated user
  accountRateLimits.delete(email);

  // Reset IP counter
  ipRateLimits.delete(clientIp);

  // Remove persistent records from MongoDB
  try {
    await Promise.all([
      LoginRateLimit.deleteOne({ key: `account:${email}` }),
      LoginRateLimit.deleteOne({ key: `ip:${clientIp}` }),
    ]);
  } catch (err) {
    // Graceful non-blocking
  }
};

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
// @desc    Login user with dual-track per-account and per-IP rate limiting
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown-ip';
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

    // 1. Check Per-Account Rate Limit (Max 5 failed attempts per account)
    const accountCheck = await checkRateLimit('account', trimmedEmail, MAX_FAILED_ACCOUNT);
    if (!accountCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts for this account. Please try again in ${accountCheck.remainingMinutes} minute(s).`,
      });
    }

    // 2. Check Per-IP Rate Limit (Max 10 failed attempts per IP)
    const ipCheck = await checkRateLimit('ip', clientIp, MAX_FAILED_IP);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts from this IP address. Please try again in ${ipCheck.remainingMinutes} minute(s).`,
      });
    }

    // 3. Find User
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      // Record failed attempt for both account and IP
      await Promise.all([
        recordFailedAttempt('account', trimmedEmail),
        recordFailedAttempt('ip', clientIp),
      ]);

      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Compare Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Record failed attempt for both account and IP
      await Promise.all([
        recordFailedAttempt('account', trimmedEmail),
        recordFailedAttempt('ip', clientIp),
      ]);

      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 5. Login successful: reset rate-limiting counters for this specific account and IP ONLY
    // Crucially: Unrelated account failure counters remain completely intact!
    await recordSuccessfulLogin(trimmedEmail, clientIp);

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
