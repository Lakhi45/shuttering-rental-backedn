const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

/**
 * Protect middleware: verifies the access token sent as
 * "Authorization: Bearer <token>" and attaches req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorized. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new ApiError(401, 'Not authorized. User no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Access token expired.'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token.'));
    }
    next(error);
  }
};

module.exports = { protect };
