const { isFeatureEnabled } = require("../config/featureFlags");

const requireFeatureFlag = (flagName, options = {}) => {
  const {
    statusCode = 404,
    message = "Requested feature is disabled",
  } = options;

  return (req, res, next) => {
    if (isFeatureEnabled(flagName)) {
      return next();
    }

    res.status(statusCode);
    return next(new Error(message));
  };
};

module.exports = {
  requireFeatureFlag,
};
