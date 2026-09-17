const { body, validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

// Strong password: min 8 chars, at least 1 uppercase, 1 lowercase,
// 1 number, and 1 special character.
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;

const PHONE_REGEX = /^[6-9]\d{9}$/;

const validateSignup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s.]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid 10-digit Indian phone number'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage(
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character'
    ),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
];

const validateLogin = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid 10-digit Indian phone number'),

  body('password').notEmpty().withMessage('Password is required'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('rememberMe must be true or false'),
];

const validateVerifyOtp = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid 10-digit Indian phone number'),

  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4 to 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only digits'),
];

const validateResendOtp = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid 10-digit Indian phone number'),
];

// Middleware: collect express-validator results and throw a single
// formatted ApiError (400) if any field failed validation.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(new ApiError(400, 'Validation failed', formatted));
  }
  next();
};

module.exports = {
  validateSignup,
  validateLogin,
  validateVerifyOtp,
  validateResendOtp,
  handleValidationErrors,
};
