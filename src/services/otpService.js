/**
 * OTP service — currently a DEV STUB.
 *
 * For now every OTP is a fixed value (default "4444", overridable via the
 * OTP_DEFAULT env var) and "sending" it just logs to the console. This lets
 * the full signup -> verify -> login flow be built and tested end-to-end
 * without a real SMS/email provider.
 *
 * ── PRODUCTION TODO ──────────────────────────────────────────────────────
 * 1. generateOtp(): replace the fixed value with a random code, e.g.
 *      const crypto = require('crypto');
 *      return crypto.randomInt(1000, 9999).toString();
 * 2. sendOtp(): replace the console.log with real delivery via SendGrid —
 *      - SMS:   SendGrid's SMS/Twilio integration to `phone`
 *      - Email: @sendgrid/mail to `email`, once an email field is added
 *        to the signup form/User model
 *    Example shape once wired up:
 *      const sgMail = require('@sendgrid/mail');
 *      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
 *      await sgMail.send({ to: email, from: process.env.OTP_FROM_EMAIL,
 *        subject: 'Your verification code', text: `Your OTP is ${otp}` });
 * ─────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_OTP = process.env.OTP_DEFAULT || '4444';
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

// Returns the OTP to issue. Fixed for now — see PRODUCTION TODO above.
const generateOtp = () => DEFAULT_OTP;

// Returns the Date at which a freshly generated OTP should expire.
const getOtpExpiry = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

// "Delivers" the OTP. Currently just logs it — swap for SendGrid in production.
const sendOtp = async ({ phone, email, otp }) => {
  console.log(
    `[OTP STUB] Code ${otp} for phone ${phone}${email ? ` / email ${email}` : ''} (expires in ${OTP_EXPIRY_MINUTES}m)`
  );
  return true;
};

module.exports = { generateOtp, getOtpExpiry, sendOtp };
