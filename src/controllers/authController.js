const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../utils/generateToken');
const otpService = require('../services/otpService');

// Include the OTP in API responses only outside production, purely so the
// signup/verify flow can be tested without a real SMS/email provider yet.
const includeOtpInResponse = process.env.NODE_ENV !== 'production';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matches JWT_REFRESH_EXPIRES default
  path: '/api/auth', // only sent back on auth routes
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  phone: user.phone,
  role: user.role,
  createdAt: user.createdAt,
});

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user and send an OTP to verify their phone.
 *          No tokens are issued yet — the account can't log in until
 *          POST /verify-otp succeeds.
 * @access  Public
 */
const signup = async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new ApiError(409, 'An account with this phone number already exists');
    }

    const user = await User.create({ name, phone, password });

    const otp = otpService.generateOtp();
    await user.setOtp(otp, otpService.getOtpExpiry());
    await otpService.sendOtp({ phone: user.phone, otp });

    return sendSuccess(
      res,
      201,
      'Account created. An OTP has been sent to your phone for verification.',
      {
        user: publicUser(user),
        ...(includeOtpInResponse && { otp }), // dev convenience only, see otpService
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify the OTP sent at signup (or via /resend-otp). On success,
 *          marks the phone verified and logs the user in (issues tokens).
 * @access  Public
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone }).select('+otp +otpExpires');
    if (!user) {
      throw new ApiError(404, 'No account found with this phone number');
    }

    if (user.isPhoneVerified) {
      throw new ApiError(400, 'Phone number is already verified. Please log in.');
    }

    const result = user.verifyOtp(otp);
    if (!result.valid) {
      const message =
        result.reason === 'EXPIRED'
          ? 'OTP has expired. Please request a new one.'
          : 'Invalid OTP';
      throw new ApiError(400, message);
    }

    await user.markPhoneVerified();

    const accessToken = generateAccessToken(user, false);
    const refreshToken = generateRefreshToken(user);
    await user.setRefreshToken(refreshToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    return sendSuccess(res, 200, 'Phone verified successfully', {
      user: publicUser(user),
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Generate and (re)send a fresh OTP for an unverified account.
 * @access  Public
 */
const resendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      throw new ApiError(404, 'No account found with this phone number');
    }

    if (user.isPhoneVerified) {
      throw new ApiError(400, 'Phone number is already verified. Please log in.');
    }

    const otp = otpService.generateOtp();
    await user.setOtp(otp, otpService.getOtpExpiry());
    await otpService.sendOtp({ phone: user.phone, otp });

    return sendSuccess(res, 200, 'A new OTP has been sent to your phone', {
      ...(includeOtpInResponse && { otp }), // dev convenience only, see otpService
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate a user and issue tokens
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { phone, password, rememberMe } = req.body;

    const user = await User.findOne({ phone }).select(
      '+password +loginAttempts +lockUntil'
    );

    // Same generic message whether the phone doesn't exist or the
    // password is wrong — never reveal which one it was.
    const invalidCredentialsError = new ApiError(
      401,
      'Invalid phone number or password'
    );

    if (!user) throw invalidCredentialsError;

    if (!user.isPhoneVerified) {
      throw new ApiError(
        403,
        'Phone number not verified. Please verify the OTP sent at signup before logging in.'
      );
    }

    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new ApiError(
        423,
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.registerFailedLogin();
      throw invalidCredentialsError;
    }

    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user, !!rememberMe);
    const refreshToken = generateRefreshToken(user);
    await user.setRefreshToken(refreshToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    return sendSuccess(res, 200, 'Logged in successfully', {
      user: publicUser(user),
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Exchange a valid refresh token (cookie) for a new access token
 * @access  Public (requires valid refresh cookie)
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new ApiError(401, 'No refresh token provided');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id).select('+refreshTokenHash');
    if (!user || !user.matchesRefreshToken(token)) {
      throw new ApiError(401, 'Refresh token is no longer valid');
    }

    const newAccessToken = generateAccessToken(user, false);

    return sendSuccess(res, 200, 'Access token refreshed', {
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Invalidate the refresh token and clear the cookie
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (user) await user.clearRefreshToken();
      } catch (err) {
        // Token already invalid/expired — nothing to clean up server-side
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get the currently authenticated user's profile
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'User profile fetched', {
      user: publicUser(req.user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  verifyOtp,
  resendOtp,
  refreshToken,
  logout,
  getMe,
};
