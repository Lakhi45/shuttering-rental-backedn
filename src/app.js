const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/apiError');

const app = express();

// Security
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);

// Parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Root
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shuttering Rental API is running',
  });
});

// API information
app.get('/api/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shuttering Rental API',
    version: '1.0.0',
    routes: {
      health: {
        method: 'GET',
        path: '/api/health',
      },
      auth: {
        basePath: '/api/auth',
      },
    },
  });
});

// Health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
  });
});

// Auth
app.use('/api/auth', authRoutes);

// 404
app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
});

// Error handler
app.use(errorHandler);

module.exports = app;