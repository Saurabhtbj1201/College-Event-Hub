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

const publicFoodOrderLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: 70,
  message: "Too many food order attempts. Please retry shortly.",
});

const publicSosLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many SOS attempts from this client. Please retry shortly.",
});

const publicSocialLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: 90,
  message: "Too many social actions from this client. Please retry shortly.",
});

module.exports = {
  authLimiter,
  adminMutationLimiter,
  scannerLimiter,
  publicRegistrationLimiter,
  publicQueueJoinLimiter,
  publicFoodOrderLimiter,
  publicSosLimiter,
  publicSocialLimiter,
};
