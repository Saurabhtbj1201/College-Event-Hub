const Admin = require("../models/Admin");
const generateToken = require("../utils/generateToken");
const {
  DEFAULT_ADMIN_PERMISSIONS,
  getEffectivePermissions,
} = require("../config/permissions");
const { writeAuditLog } = require("../utils/auditLogger");

const sanitizeAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  approved: admin.approved,
  permissions: getEffectivePermissions(admin),
});

const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !email || !password) {
      await writeAuditLog({
        req,
        actorType: "admin",
        actorId: normalizedEmail || null,
        action: "auth.admin.register",
        resourceType: "admin",
        status: "blocked",
        details: { reason: "missing-required-fields" },
      });
      res.status(400);
      throw new Error("Name, email and password are required");
    }

    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      await writeAuditLog({
        req,
        actorType: "admin",
        actorId: normalizedEmail,
        action: "auth.admin.register",
        resourceType: "admin",
        resourceId: existingAdmin._id,
        status: "blocked",
        details: { reason: "admin-already-exists" },
      });
      res.status(409);
      throw new Error("Admin account already exists");
    }

    const admin = await Admin.create({
      name,
      email: normalizedEmail,
      password,
      role: "admin",
      permissions: [...DEFAULT_ADMIN_PERMISSIONS],
      approved: false,
    });

    await writeAuditLog({
      req,
      actorType: "admin",
      actorId: admin._id,
      action: "auth.admin.register",
      resourceType: "admin",
      resourceId: admin._id,
      status: "success",
      details: {
        email: admin.email,
        role: admin.role,
        approved: admin.approved,
      },
    });

    res.status(201).json({
      message: "Admin registered. Waiting for super-admin approval",
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!email || !password) {
      await writeAuditLog({
        req,
        actorType: "admin",
        actorId: normalizedEmail || null,
        action: "auth.admin.login",
        resourceType: "admin",
        status: "blocked",
        details: { reason: "missing-email-or-password" },
      });
      res.status(400);
      throw new Error("Email and password are required");
    }

    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin || !(await admin.matchPassword(password))) {
      await writeAuditLog({
        req,
        actorType: "admin",
        actorId: normalizedEmail,
        action: "auth.admin.login",
        resourceType: "admin",
        status: "blocked",
        details: { reason: "invalid-credentials" },
      });
      res.status(401);
      throw new Error("Invalid email or password");
    }

    if (!admin.approved) {
      await writeAuditLog({
        req,
        actorType: "admin",
        actorId: admin._id,
        action: "auth.admin.login",
        resourceType: "admin",
        resourceId: admin._id,
        status: "blocked",
        details: { reason: "pending-approval" },
      });
      res.status(403);
      throw new Error("Admin account is pending approval");
    }

    await writeAuditLog({
      req,
      actorType: "admin",
      actorId: admin._id,
      action: "auth.admin.login",
      resourceType: "admin",
      resourceId: admin._id,
      status: "success",
      details: {
        role: admin.role,
      },
    });

    res.json({
      message: "Login successful",
      token: generateToken(admin),
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    next(error);
  }
};

const getCurrentAdmin = async (req, res, next) => {
  try {
    res.json({ admin: sanitizeAdmin(req.admin) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getCurrentAdmin,
};
