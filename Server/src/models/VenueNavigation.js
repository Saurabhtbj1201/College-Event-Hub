const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: ["gate", "section", "facility", "stage", "path"],
      default: "section",
    },
    x: {
      type: Number,
      required: true,
      min: 0,
    },
    y: {
      type: Number,
      required: true,
      min: 0,
    },
    width: {
      type: Number,
      required: true,
      min: 1,
    },
    height: {
      type: Number,
      required: true,
      min: 1,
    },
    color: {
      type: String,
      trim: true,
      default: "#8ad1bf",
    },
  },
  { _id: false }
);

const routeHintSchema = new mongoose.Schema(
  {
    fromCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    toCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    instructions: {
      type: [String],
      default: [],
    },
    estimatedMinutes: {
      type: Number,
      min: 1,
      default: 4,
    },
    crowdRecommendation: {
      type: String,
      enum: ["normal", "avoid", "preferred"],
      default: "normal",
    },
  },
  { _id: false }
);

const venueNavigationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    canvas: {
      width: {
        type: Number,
        default: 860,
        min: 200,
      },
      height: {
        type: Number,
        default: 480,
        min: 200,
      },
    },
    zones: {
      type: [zoneSchema],
      default: [],
    },
    routeHints: {
      type: [routeHintSchema],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VenueNavigation", venueNavigationSchema);
