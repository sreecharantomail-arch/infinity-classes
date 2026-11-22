import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import attemptRoutes from './routes/attempts.js';
import { seedDatabase } from './seed/seedQuestions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Requirement 1: Fail application startup if JWT_SECRET is missing in production
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL ERROR: JWT_SECRET environment variable is required in production.');
    console.error('Server execution aborted for security.');
    process.exit(1);
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET is not configured. Please define it in your .env file.');
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy for Render / Cloudflare (ensures accurate req.ip for rate limiting)
app.set('trust proxy', 1);

// Connect to MongoDB & Seed initial data if empty
connectDB().then((connected) => {
  if (connected) {
    seedDatabase();
  }
});

// Requirement 6: Restrict CORS to configured origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://infinity-classes-online-test-app.onrender.com',
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach((url) => {
    const trimmed = url.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin static serving)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// API Health Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Mini Online Test Portal API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);

// Serve static frontend build in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  // If it's an API route that wasn't found, return 404 JSON
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  // Otherwise serve index.html for React SPA
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('API Server is running. Client build not found in ../client/dist yet.');
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
