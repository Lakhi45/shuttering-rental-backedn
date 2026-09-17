const jwt = require('jsonwebtoken');

/**
 * Access token: short-lived, sent in the response body, used on every
 * protected request via the Authorization: Bearer header.
 * When rememberMe is true at login, we issue a longer-lived access token.
 */
const generateAccessToken = (user, rememberMe = false) => {
  const expiresIn = rememberMe
    ? process.env.JWT_ACCESS_EXPIRES_REMEMBER
    : process.env.JWT_ACCESS_EXPIRES;

  return jwt.sign(
    { id: user._id, phone: user.phone, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn }
  );
};

/**
 * Refresh token: long-lived, stored as an httpOnly cookie + hashed copy
 * in the DB, used only to mint new access tokens via /refresh-token.
 */
const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES,
  });
};

module.exports = { generateAccessToken, generateRefreshToken };
