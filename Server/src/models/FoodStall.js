const mongoose = require("mongoose");

const foodStallSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    zoneCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: "",
    },
    locationHint: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    operatingStatus: {
      type: String,
      enum: ["open", "busy", "closed", "paused"],
      default: "open",
      index: true,
    },
    estimatedPrepMinutes: {
      type: Number,
      min: 0,
      default: 10,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

foodStallSchema.index({ event: 1, code: 1 }, { unique: true });
foodStallSchema.index({ event: 1, isActive: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model("FoodStall", foodStallSchema);
