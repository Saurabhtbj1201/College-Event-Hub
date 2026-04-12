const mongoose = require("mongoose");

const queuePointSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    pointType: {
      type: String,
      enum: ["entry", "food", "restroom"],
      required: true,
    },
    pointName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["free", "normal", "busy"],
      default: "normal",
    },
    manualWaitTimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

queuePointSchema.index({ event: 1, pointType: 1, pointName: 1 }, { unique: true });
queuePointSchema.index({ event: 1, isActive: 1, updatedAt: -1 });

module.exports = mongoose.model("QueuePoint", queuePointSchema);
