const ApiError = require('../utils/apiError');

/**
 * Central error handler. Every thrown error (ApiError, Mongoose error,
 * JWT error, or unexpected exception) is normalized into one JSON shape:
 * { success: false, message, errors }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Mongoose duplicate key (e.g. phone already registered)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ApiError(409, `An account with this ${field} already exists`);
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error = new ApiError(400, 'Validation failed', messages);
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid value for ${err.path}`);
  }

  if (!(error instanceof ApiError)) {
    console.error('UNEXPECTED ERROR:', err);
    error = new ApiError(500, 'Something went wrong. Please try again later.');
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors && error.errors.length ? error.errors : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
