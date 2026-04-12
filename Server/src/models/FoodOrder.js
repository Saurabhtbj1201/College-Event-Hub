const mongoose = require("mongoose");

const foodOrderItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodItem",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const foodOrderStatusSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["placed", "accepted", "preparing", "ready", "picked-up", "cancelled"],
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

const foodOrderSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    stall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodStall",
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
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    customerSnapshot: {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
      college: { type: String, required: true, trim: true, maxlength: 180 },
    },
    items: {
      type: [foodOrderItemSchema],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Food order must include at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    serviceFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 8,
      default: "INR",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    status: {
      type: String,
      enum: ["placed", "accepted", "preparing", "ready", "picked-up", "cancelled"],
      default: "placed",
      index: true,
    },
    statusTimeline: {
      type: [foodOrderStatusSchema],
      default: () => [{ status: "placed", at: new Date(), byAdmin: null, note: "" }],
    },
    estimatedPrepMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    estimatedReadyAt: {
      type: Date,
      default: null,
    },
    readyAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

foodOrderSchema.index({ event: 1, status: 1, createdAt: -1 });
foodOrderSchema.index({ stall: 1, status: 1, createdAt: -1 });
foodOrderSchema.index({ passId: 1, createdAt: -1 });

module.exports = mongoose.model("FoodOrder", foodOrderSchema);
