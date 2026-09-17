const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCK_TIME_MS = parseInt(process.env.LOCK_TIME_MINUTES || '15', 10) * 60 * 1000;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be under 50 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default in queries
    },
    role: {
      type: String,
      enum: ['owner', 'staff', 'admin'],
      default: 'owner',
    },

    // --- OTP verification (phone, and email once that field exists) ---
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
      select: false,
    },

    // --- Refresh token (stored hashed, never in plaintext) ---
    refreshTokenHash: {
      type: String,
      select: false,
    },

    // --- Brute-force / account lockout protection ---
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Virtual: is the account currently locked?
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving, only if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare plaintext password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: register a failed login attempt, locking the account
// after MAX_LOGIN_ATTEMPTS consecutive failures.
userSchema.methods.registerFailedLogin = async function () {
  // If a previous lock has expired, reset the counter first
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
  }

  this.loginAttempts += 1;

  if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
  }

  await this.save({ validateBeforeSave: false });
};

// Instance method: clear lockout state after a successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save({ validateBeforeSave: false });
};

// Instance method: set/replace the OTP and its expiry
userSchema.methods.setOtp = async function (otp, expiresAt) {
  this.otp = otp;
  this.otpExpires = expiresAt;
  await this.save({ validateBeforeSave: false });
};

// Instance method: check an incoming OTP against the stored value + expiry
userSchema.methods.verifyOtp = function (candidateOtp) {
  if (!this.otp || !this.otpExpires) return { valid: false, reason: 'NO_OTP' };
  if (this.otpExpires < Date.now()) return { valid: false, reason: 'EXPIRED' };
  if (this.otp !== candidateOtp) return { valid: false, reason: 'MISMATCH' };
  return { valid: true };
};

// Instance method: mark phone as verified and clear OTP fields
userSchema.methods.markPhoneVerified = async function () {
  this.isPhoneVerified = true;
  this.otp = undefined;
  this.otpExpires = undefined;
  await this.save({ validateBeforeSave: false });
};

// Instance method: store a hashed copy of the current refresh token
userSchema.methods.setRefreshToken = async function (refreshToken) {
  this.refreshTokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');
  await this.save({ validateBeforeSave: false });
};

// Instance method: check an incoming refresh token against the stored hash
userSchema.methods.matchesRefreshToken = function (refreshToken) {
  if (!this.refreshTokenHash) return false;
  const incomingHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');
  return incomingHash === this.refreshTokenHash;
};

// Instance method: invalidate refresh token (logout)
userSchema.methods.clearRefreshToken = async function () {
  this.refreshTokenHash = undefined;
  await this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', userSchema);
