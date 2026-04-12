const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const phase2UserAuth = parseBoolean(process.env.ENABLE_PHASE2_USER_AUTH, false);

const FEATURE_FLAGS = {
  phase2UserAuth,
  phase2UserDashboard: parseBoolean(
    process.env.ENABLE_PHASE2_USER_DASHBOARD,
    phase2UserAuth
  ),
};

const isFeatureEnabled = (flagName) => Boolean(FEATURE_FLAGS[flagName]);

module.exports = {
  FEATURE_FLAGS,
  isFeatureEnabled,
};
