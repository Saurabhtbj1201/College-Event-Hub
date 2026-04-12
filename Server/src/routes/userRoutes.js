const express = require("express");
const { loginWithGoogle } = require("../controllers/userAuthController");
const {
  getCurrentUser,
  getMyTickets,
  getMyNotifications,
  markNotificationRead,
} = require("../controllers/userController");
const { protectUser } = require("../middleware/userAuthMiddleware");
const { requireFeatureFlag } = require("../middleware/featureFlagMiddleware");

const router = express.Router();

router.use(
  requireFeatureFlag("phase2UserAuth", {
    statusCode: 404,
    message: "Phase 2 user module is disabled",
  })
);

router.post("/auth/google", loginWithGoogle);
router.get("/me", protectUser, getCurrentUser);
router.get("/tickets", protectUser, getMyTickets);
router.get("/notifications", protectUser, getMyNotifications);
router.patch("/notifications/:notificationId/read", protectUser, markNotificationRead);

module.exports = router;
