const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
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
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "general",
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 8,
      default: "INR",
    },
    isVeg: {
      type: Boolean,
      default: false,
    },
    prepMinutes: {
      type: Number,
      min: 0,
      default: 8,
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

foodItemSchema.index({ stall: 1, isActive: 1, isAvailable: 1, sortOrder: 1 });
foodItemSchema.index({ event: 1, isActive: 1, isAvailable: 1, category: 1 });

module.exports = mongoose.model("FoodItem", foodItemSchema);
