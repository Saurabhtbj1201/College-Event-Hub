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

const phase2UserAuth = parseBoolean(import.meta.env.VITE_ENABLE_PHASE2_USER_AUTH, false);

export const FEATURE_FLAGS = {
  phase2UserAuth,
  phase2UserDashboard: parseBoolean(
    import.meta.env.VITE_ENABLE_PHASE2_USER_DASHBOARD,
    phase2UserAuth
  ),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  googleAnalyticsMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "",
};

export const isPhase2UserAuthEnabled = FEATURE_FLAGS.phase2UserAuth;
export const isPhase2UserDashboardEnabled = FEATURE_FLAGS.phase2UserDashboard;
