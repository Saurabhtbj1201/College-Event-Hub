const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorType: {
      type: String,
      enum: ["admin", "public", "system"],
      default: "system",
      index: true,
    },
    actorId: {
      type: String,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    resourceType: {
      type: String,
      default: "system",
      trim: true,
      maxlength: 120,
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failure", "blocked", "info"],
      default: "info",
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
      maxlength: 260,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
