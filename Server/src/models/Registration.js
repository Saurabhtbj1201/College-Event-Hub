const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
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
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    college: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    passId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ticketStatus: {
      type: String,
      enum: ["active", "checked-in"],
      default: "active",
      index: true,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    checkInCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    eventSnapshot: {
      title: { type: String, required: true },
      date: { type: Date, required: true },
      venue: { type: String, required: true },
    },
  },
  { timestamps: true }
);

registrationSchema.index({ event: 1 });
registrationSchema.index({ event: 1, ticketStatus: 1 });

module.exports = mongoose.model("Registration", registrationSchema);
