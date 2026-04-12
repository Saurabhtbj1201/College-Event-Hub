const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  getCurrentAdmin,
} = require("../controllers/adminAuthController");
const { protectAdmin } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post("/admin/register", authLimiter, registerAdmin);
router.post("/admin/login", authLimiter, loginAdmin);
router.get("/admin/me", protectAdmin, getCurrentAdmin);

module.exports = router;
