const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { hasPermission } = require("../config/permissions");

const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401);
      throw new Error("Not authorized. Token missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      res.status(401);
      throw new Error("Not authorized. Admin not found");
    }

    if (!admin.approved) {
      res.status(403);
      throw new Error("Admin account is not approved");
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }
    next(error);
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== "super-admin") {
    res.status(403);
    throw new Error("Only super-admin can perform this action");
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.admin || !hasPermission(req.admin, permission)) {
    res.status(403);
    throw new Error("Insufficient permissions for this action");
  }

  next();
};

module.exports = { protectAdmin, requireSuperAdmin, requirePermission };
