const AuditLog = require("../models/AuditLog");

const resolveIpAddress = (req) => {
  const headers = req?.headers || {};
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req?.ip || req?.socket?.remoteAddress || null;
};

const resolveUserAgent = (req) => {
  const headers = req?.headers || {};
  const userAgent = headers["user-agent"];
  return typeof userAgent === "string" && userAgent.trim() ? userAgent.trim() : null;
};

const writeAuditLog = async ({
  req,
  actorType = "system",
  actorId = null,
  action,
  resourceType = "system",
  resourceId = null,
  status = "info",
  details = {},
}) => {
  if (!action) {
    return null;
  }

  try {
    const payload = {
      actorType,
      actorId: actorId ? String(actorId) : null,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      status,
      details,
      ipAddress: req ? resolveIpAddress(req) : null,
      userAgent: req ? resolveUserAgent(req) : null,
    };

    return await AuditLog.create(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
    return null;
  }
};

const logAdminAudit = async ({ req, action, resourceType, resourceId, status, details }) =>
  writeAuditLog({
    req,
    actorType: "admin",
    actorId: req?.admin?._id || req?.admin?.id || null,
    action,
    resourceType,
    resourceId,
    status,
    details,
  });

const logPublicAudit = async ({ req, actorId = null, action, resourceType, resourceId, status, details }) =>
  writeAuditLog({
    req,
    actorType: "public",
    actorId,
    action,
    resourceType,
    resourceId,
    status,
    details,
  });

module.exports = {
  writeAuditLog,
  logAdminAudit,
  logPublicAudit,
};
