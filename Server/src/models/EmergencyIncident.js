const mongoose = require("mongoose");

const incidentTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved", "dismissed"],
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    byAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
  },
  { _id: false }
);

const emergencyIncidentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      index: true,
    },
    passId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["sos", "medical", "security"],
      default: "sos",
      index: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "critical",
      index: true,
    },
    zoneCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 32,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    reporterSnapshot: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 120,
      },
      college: {
        type: String,
        required: true,
        trim: true,
        maxlength: 180,
      },
    },
    timeline: {
      type: [incidentTimelineSchema],
      default: () => [{ status: "open", at: new Date(), byAdmin: null, note: "" }],
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

emergencyIncidentSchema.index({ event: 1, status: 1, createdAt: -1 });
emergencyIncidentSchema.index({ event: 1, severity: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("EmergencyIncident", emergencyIncidentSchema);
