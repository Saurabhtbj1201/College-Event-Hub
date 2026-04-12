const rateLimit = require("express-rate-limit");

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message,
    },
  });

const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: "Too many authentication attempts. Please retry later.",
});

const adminMutationLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 90,
  message: "Too many admin write operations. Please slow down.",
});

const scannerLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 140,
  message: "Scanner rate limit exceeded. Please retry shortly.",
});

const publicRegistrationLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 50,
  message: "Too many registrations from this client. Please retry later.",
});

const publicQueueJoinLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: 80,
  message: "Too many queue join attempts. Please retry later.",
});

module.exports = {
  authLimiter,
  adminMutationLimiter,
  scannerLimiter,
  publicRegistrationLimiter,
  publicQueueJoinLimiter,
};
