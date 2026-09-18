const app = require('../src/app');
const connectDB = require('../src/config/db');

let isConnected = false;

module.exports = async (req, res) => {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error('Vercel function error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};