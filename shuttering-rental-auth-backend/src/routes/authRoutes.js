const express = require('express');
const {
  signup,
  login,
  verifyOtp,
  resendOtp,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');
const {
  validateSignup,
  validateLogin,
  validateVerifyOtp,
  validateResendOtp,
  handleValidationErrors,
} = require('../validators/authValidators');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/signup',
  authLimiter,
  validateSignup,
  handleValidationErrors,
  signup
);

router.post(
  '/login',
  authLimiter,
  validateLogin,
  handleValidationErrors,
  login
);

router.post(
  '/verify-otp',
  authLimiter,
  validateVerifyOtp,
  handleValidationErrors,
  verifyOtp
);

router.post(
  '/resend-otp',
  authLimiter,
  validateResendOtp,
  handleValidationErrors,
  resendOtp
);

router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
