const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

const getAllowedOrigins = () => {
  const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const configuredOrigins = [
    ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
    ...splitOrigins(process.env.CLIENT_URL),
  ];

  return [...new Set([...configuredOrigins, ...defaultOrigins])];
};

const isOriginAllowed = (origin, allowedOrigins = getAllowedOrigins()) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return true;
  }

  if (allowedOrigins.includes("*")) {
    return true;
  }

  return allowedOrigins.includes(normalizedOrigin);
};

const corsOriginHandler = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();

  if (isOriginAllowed(origin, allowedOrigins)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin || "unknown"}`));
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  corsOriginHandler,
};
