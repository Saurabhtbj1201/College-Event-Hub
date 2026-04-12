const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  ALL_ADMIN_PERMISSION_VALUES,
  DEFAULT_ADMIN_PERMISSIONS,
} = require("../config/permissions");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "super-admin"],
      default: "admin",
    },
    permissions: {
      type: [String],
      enum: ALL_ADMIN_PERMISSION_VALUES,
      default: () => [...DEFAULT_ADMIN_PERMISSIONS],
    },
    approved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function onSave(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);
