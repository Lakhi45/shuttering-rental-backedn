require('dotenv').config();

const app = require('../app');
const connectDB = require('../config/db');

let dbConnected = false;

module.exports = async (req, res) => {
  try {
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error('Vercel API error:', error);

    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
};