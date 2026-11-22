import mongoose from 'mongoose';

const loginRateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String, // e.g. "ip:127.0.0.1" or "account:student@example.com"
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['ip', 'account'],
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    firstAttemptTime: {
      type: Date,
      default: Date.now,
      index: { expires: 900 }, // Auto-expire after 15 minutes via MongoDB TTL index
    },
    lastAttemptTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const LoginRateLimit = mongoose.model('LoginRateLimit', loginRateLimitSchema);
export default LoginRateLimit;

