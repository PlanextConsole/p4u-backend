import rateLimit from 'express-rate-limit';

/** Login: PRD-style abuse control (CAPTCHA after failures is app-side; this is server baseline).
 *  Counts both successful and failed attempts so a credential-stuffing attacker can't bypass
 *  the limiter by occasionally succeeding. Cap is raised accordingly. */
export const publicLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { message: 'Too many sign-up attempts from this network. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicForgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many token refresh requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const introspectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: 'Too many introspection requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});
