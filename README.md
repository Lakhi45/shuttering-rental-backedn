# Shuttering Rental App — Auth Backend

Standalone authentication service for the Shuttering Rental App: **signup and login only**, built with production-grade validation and security practices. Everything else (dashboard, rentals, inventory, customers) can be added later as separate modules that reuse this auth layer.

Matches the app's UI flow: users authenticate with **phone number + password** (as shown on the Login/Sign Up screens).

## Features

- Signup with strong validation (name, 10-digit Indian phone, strong password + confirm)
- **OTP-verified signup**: account starts unverified; a fixed dev OTP (`4444` by default) must be confirmed via `/verify-otp` before login is allowed
- Login with phone + password, optional "Remember Me" (extends access token life) — blocked until the phone is verified
- Passwords hashed with bcrypt (never stored or returned in plaintext)
- JWT access tokens (short-lived) + JWT refresh tokens (long-lived, httpOnly cookie)
- Refresh tokens stored server-side as a SHA-256 hash, so a stolen DB dump can't be replayed
- Account lockout after repeated failed logins (brute-force protection)
- Rate limiting on `/signup` and `/login`
- Centralized, consistent error responses
- Security headers (Helmet), CORS, NoSQL-injection sanitization, payload size limits
- Clean, modular structure (config / models / controllers / routes / middleware / validators / utils)

## Tech Stack

Node.js, Express, MongoDB (Mongoose), JWT, bcryptjs, express-validator, express-rate-limit, Helmet.

## Project Structure

```
src/
  config/db.js              MongoDB connection
  models/User.js             User schema, password hashing, lockout, OTP & refresh-token logic
  services/otpService.js     OTP generation + "sending" (dev stub — see PRODUCTION TODO inside)
  validators/authValidators.js   express-validator rules for signup/login/verify-otp/resend-otp
  controllers/authController.js  signup, verifyOtp, resendOtp, login, refreshToken, logout, getMe
  routes/authRoutes.js       /api/auth/* route definitions
  middleware/auth.js         protect() — verifies access token
  middleware/rateLimiter.js  authLimiter — throttles brute-force attempts
  middleware/errorHandler.js Central error formatter
  utils/                     ApiError, apiResponse, token generators
  app.js                     Express app (security middleware, routes)
  server.js                  Entry point — connects DB, starts server
```

## Setup

```bash
npm install
cp .env.example .env
# then edit .env: set MONGO_URI and two strong random JWT secrets
npm run dev      # nodemon, for development
npm start        # plain node, for production
```

Generate strong secrets quickly with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | Frontend origin, used for CORS |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_ACCESS_EXPIRES` | Access token lifetime (e.g. `15m`) |
| `JWT_ACCESS_EXPIRES_REMEMBER` | Access token lifetime when "Remember Me" is checked (e.g. `7d`) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime (e.g. `30d`) |
| `MAX_LOGIN_ATTEMPTS` | Failed logins allowed before lockout |
| `LOCK_TIME_MINUTES` | Lockout duration once the limit is hit |

## API Reference

Base URL: `/api/auth`

### POST `/signup`
Create a new account. The account is **unverified** until the OTP is confirmed — no tokens are issued yet.

Request body:
```json
{
  "name": "Raj Kumar",
  "phone": "9876543210",
  "password": "Str0ng@Pass",
  "confirmPassword": "Str0ng@Pass"
}
```

Success `201`:
```json
{
  "success": true,
  "message": "Account created. An OTP has been sent to your phone for verification.",
  "data": {
    "user": { "id": "...", "name": "Raj Kumar", "phone": "9876543210", "role": "owner", "createdAt": "..." },
    "otp": "4444"
  }
}
```
`otp` is only included in the response outside `NODE_ENV=production`, purely so you can test the flow without a real SMS/email provider — see **OTP Verification** below.

### POST `/verify-otp`
Confirms the OTP and, on success, logs the user in (issues tokens).

Request body:
```json
{ "phone": "9876543210", "otp": "4444" }
```
Success `200` — same data shape as login (`user` + `accessToken`, plus the `refreshToken` cookie). Returns `400` for an invalid or expired OTP, `404` if the phone isn't registered.

### POST `/resend-otp`
Request body:
```json
{ "phone": "9876543210" }
```
Generates and "sends" a fresh OTP (again `4444` for now). `400` if the account is already verified.

### POST `/login`
Request body:
```json
{
  "phone": "9876543210",
  "password": "Str0ng@Pass",
  "rememberMe": true
}
```
Success `200` — same shape as `/verify-otp`. Returns `403` if the phone hasn't been verified yet, `401` for wrong credentials (generic message, doesn't reveal which field was wrong), and `423` if the account is temporarily locked.

### POST `/refresh-token`
No body required — reads the httpOnly `refreshToken` cookie automatically. Returns a fresh `accessToken`.

### POST `/logout`
Invalidates the refresh token (server-side) and clears the cookie.

### GET `/me`
Protected route — requires header `Authorization: Bearer <accessToken>`. Returns the logged-in user's profile.

## OTP Verification

Right now `src/services/otpService.js` is a **dev stub**:
- `generateOtp()` always returns a fixed code — `4444` by default, override with `OTP_DEFAULT` in `.env`
- `sendOtp()` just logs the code to the server console instead of actually delivering it
- codes expire after `OTP_EXPIRY_MINUTES` (default 10)

This lets you build and test the full signup → verify → login flow immediately, with no SMS/email provider wired up.

**Moving to production:** swap the internals of that one file for real delivery via SendGrid —
- SMS to `user.phone` (SendGrid's SMS integration, or a dedicated gateway like Twilio)
- Email to `user.email`, once an email field is added to signup (not included yet, since the current flow is phone + password only)

and replace `generateOtp()` with a random 4–6 digit code (e.g. `crypto.randomInt(1000, 9999)`). Everything else — the model fields, validators, and controller logic — is already written to support that change with no further edits needed elsewhere.

## Validation Rules

- **Name**: 2–50 characters, letters and spaces only
- **Phone**: exactly 10 digits, must start with 6, 7, 8, or 9 (Indian mobile format)
- **Password**: minimum 8 characters, must include at least one uppercase letter, one lowercase letter, one number, and one special character
- **confirmPassword**: must match `password` on signup

All validation failures return `400` with a field-by-field `errors` array, e.g.:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "password", "message": "Password must be at least 8 characters and include..." }
  ]
}
```

## Security Notes / Suggested Next Steps

- Behind a load balancer, set `app.set('trust proxy', 1)` in `app.js` so rate limiting reads the real client IP.
- In production, always run over HTTPS — the refresh cookie is marked `secure` automatically when `NODE_ENV=production`.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` periodically in production.
- Don't ship `OTP_DEFAULT` / the dev OTP-in-response behavior to production — both are gated by `NODE_ENV`, but double-check your deployed env vars before going live.
