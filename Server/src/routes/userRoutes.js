const express = require("express");
const { loginWithGoogle } = require("../controllers/userAuthController");
const {
  getCurrentUser,
  getMyTickets,
  getMyActivityHistory,
  getMyNotifications,
  markNotificationRead,
} = require("../controllers/userController");
const { protectUser } = require("../middleware/userAuthMiddleware");

const router = express.Router();

router.post("/auth/google", loginWithGoogle);
router.get("/me", protectUser, getCurrentUser);
router.get("/tickets", protectUser, getMyTickets);
router.get("/history", protectUser, getMyActivityHistory);
router.get("/notifications", protectUser, getMyNotifications);
router.patch("/notifications/:notificationId/read", protectUser, markNotificationRead);

module.exports = router;
