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

// --- Security & parsing middleware ---
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use(mongoSanitize()); // strips $ and . from req.body/query/params

// --- Logger ---
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// =====================================================
// Root route
// =====================================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shuttering Rental API is running',
  });
});

// =====================================================
// API documentation / available routes
// =====================================================

app.get('/api/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shuttering Rental API',
    version: '1.0.0',

    routes: {
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Check API health',
      },

      auth: {
        basePath: '/api/auth',
        description: 'Authentication routes',
      },
    },
  });
});

// =====================================================
// Health check
// =====================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
  });
});

// =====================================================
// Authentication routes
// =====================================================

app.use('/api/auth', authRoutes);

// =====================================================
// 404 handler
// IMPORTANT: Keep this AFTER all routes
// =====================================================

app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
});

// =====================================================
// Central error handler
// IMPORTANT: Must be the last middleware
// =====================================================

app.use(errorHandler);

module.exports = app;
