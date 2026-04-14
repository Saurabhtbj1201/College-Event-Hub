const mongoose = require("mongoose");

const queueTicketSchema = new mongoose.Schema(
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
    },
    queuePoint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QueuePoint",
      required: true,
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
    status: {
      type: String,
      enum: ["waiting", "served", "cancelled"],
      default: "waiting",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    servedAt: {
      type: Date,
      default: null,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

queueTicketSchema.index({ queuePoint: 1, status: 1, joinedAt: 1 });
queueTicketSchema.index({ queuePoint: 1, passId: 1, status: 1 });
queueTicketSchema.index({ event: 1, status: 1 });
queueTicketSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("QueueTicket", queueTicketSchema);
