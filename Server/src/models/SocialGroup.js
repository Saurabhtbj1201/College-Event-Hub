const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    passId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    alias: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    consentShareLocation: {
      type: Boolean,
      default: false,
    },
    currentZoneCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 32,
      default: "",
    },
    lastLocationAt: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const socialGroupSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    groupCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    leaderRegistration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    leaderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    leaderPassId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    preferredZoneCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 32,
      default: "",
    },
    seatClusterHint: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    members: {
      type: [groupMemberSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0 && value.length <= 30;
        },
        message: "Group must contain 1 to 30 members",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

socialGroupSchema.index({ event: 1, groupCode: 1 }, { unique: true });
socialGroupSchema.index({ event: 1, isActive: 1, updatedAt: -1 });

module.exports = mongoose.model("SocialGroup", socialGroupSchema);
