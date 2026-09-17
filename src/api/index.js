const app = require('../src/app');
const connectDB = require('../src/config/db');

let isConnected = false;

module.exports = async (req, res) => {
  try {
    // Connect to MongoDB only when needed
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }

    // Pass request to Express
    return app(req, res);
  } catch (error) {
    console.error('Server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};