/**
 * Standard operational error class.
 * Throw this anywhere in the app with a specific HTTP status and message;
 * the central error handler knows how to format it.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional array of field-level errors
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
