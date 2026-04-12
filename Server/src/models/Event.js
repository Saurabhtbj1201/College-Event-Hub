const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    date: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    liveOperations: {
      crowdLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      entryGateStatus: {
        type: String,
        enum: ["open", "busy", "closed"],
        default: "open",
      },
      note: {
        type: String,
        trim: true,
        maxlength: 240,
        default: "",
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ isActive: 1, date: 1 });

module.exports = mongoose.model("Event", eventSchema);
