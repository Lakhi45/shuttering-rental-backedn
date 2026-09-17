const rateLimit = require('express-rate-limit');

// Applies to signup + login: 10 attempts per 15 minutes per IP.
// Slows down brute-force / credential-stuffing attempts without
// blocking normal usage.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this IP. Please try again in 15 minutes.',
  },
});

module.exports = { authLimiter };
