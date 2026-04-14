const Registration = require("../models/Registration");
const UserNotification = require("../models/UserNotification");
const QueueTicket = require("../models/QueueTicket");
const FoodOrder = require("../models/FoodOrder");
const EmergencyIncident = require("../models/EmergencyIncident");
const SocialGroup = require("../models/SocialGroup");
const { sanitizeUser } = require("./userAuthController");
const { serializeUserNotification } = require("../utils/userNotificationService");

const getCurrentUser = async (req, res, next) => {
  try {
    res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const registrations = await Registration.find({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const tickets = registrations.map((registration) => ({
      registrationId: registration._id.toString(),
      passId: registration.passId,
      ticketStatus: registration.ticketStatus,
      checkedInAt: registration.checkedInAt,
      createdAt: registration.createdAt,
      event: {
        id: registration.event?.toString?.() || registration.event,
        title: registration.eventSnapshot?.title || "Event",
        date: registration.eventSnapshot?.date || null,
        venue: registration.eventSnapshot?.venue || "",
      },
    }));

    const now = Date.now();

    const summary = {
      totalTickets: tickets.length,
      checkedIn: tickets.filter((ticket) => ticket.ticketStatus === "checked-in").length,
      upcoming: tickets.filter((ticket) => {
        const eventDate = new Date(ticket.event.date).getTime();
        return Number.isFinite(eventDate) && eventDate >= now;
      }).length,
    };

    res.json({
      user: sanitizeUser(req.user),
      summary,
      tickets,
    });
  } catch (error) {
    next(error);
  }
};

const getMyActivityHistory = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 30);
    const limit = Math.min(100, Math.max(5, requestedLimit));

    const registrations = await Registration.find({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const passIds = registrations
      .map((registration) => String(registration.passId || "").trim().toUpperCase())
      .filter(Boolean);

    const [queueTickets, foodOrders, emergencies, socialGroups] = await Promise.all([
      QueueTicket.find({
        $or: [{ user: req.user._id }, { passId: { $in: passIds } }],
      })
        .populate("event", "title date venue")
        .populate("queuePoint", "pointName pointType")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      FoodOrder.find({
        $or: [
          { user: req.user._id },
          { passId: { $in: passIds } },
          { "customerSnapshot.email": req.user.email },
        ],
      })
        .populate("event", "title date venue")
        .populate("stall", "name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      EmergencyIncident.find({
        $or: [
          { user: req.user._id },
          { passId: { $in: passIds } },
          { "reporterSnapshot.email": req.user.email },
        ],
      })
        .populate("event", "title date venue")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      SocialGroup.find({
        $or: [
          { leaderUser: req.user._id },
          { "members.user": req.user._id },
          { "members.passId": { $in: passIds } },
        ],
      })
        .populate("event", "title date venue")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const queueHistory = queueTickets.map((ticket) => ({
      id: ticket._id.toString(),
      passId: ticket.passId,
      status: ticket.status,
      joinedAt: ticket.joinedAt,
      servedAt: ticket.servedAt,
      event: {
        id: ticket.event?._id?.toString?.() || ticket.event?.toString?.() || "",
        title: ticket.event?.title || "Event",
        date: ticket.event?.date || null,
        venue: ticket.event?.venue || "",
      },
      queuePoint: {
        id: ticket.queuePoint?._id?.toString?.() || ticket.queuePoint?.toString?.() || "",
        name: ticket.queuePoint?.pointName || "Queue Point",
        type: ticket.queuePoint?.pointType || "",
      },
    }));

    const foodHistory = foodOrders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      passId: order.passId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      event: {
        id: order.event?._id?.toString?.() || order.event?.toString?.() || "",
        title: order.event?.title || "Event",
        date: order.event?.date || null,
        venue: order.event?.venue || "",
      },
      stall: {
        id: order.stall?._id?.toString?.() || order.stall?.toString?.() || "",
        name: order.stall?.name || "Food Stall",
      },
    }));

    const emergencyHistory = emergencies.map((incident) => ({
      id: incident._id.toString(),
      passId: incident.passId,
      status: incident.status,
      severity: incident.severity,
      zoneCode: incident.zoneCode || "",
      message: incident.message || "",
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      event: {
        id: incident.event?._id?.toString?.() || incident.event?.toString?.() || "",
        title: incident.event?.title || "Event",
        date: incident.event?.date || null,
        venue: incident.event?.venue || "",
      },
    }));

    const socialHistory = socialGroups.map((group) => ({
      id: group._id.toString(),
      groupCode: group.groupCode,
      groupName: group.groupName,
      isActive: Boolean(group.isActive),
      memberCount: Array.isArray(group.members) ? group.members.length : 0,
      updatedAt: group.updatedAt,
      event: {
        id: group.event?._id?.toString?.() || group.event?.toString?.() || "",
        title: group.event?.title || "Event",
        date: group.event?.date || null,
        venue: group.event?.venue || "",
      },
    }));

    res.json({
      user: sanitizeUser(req.user),
      summary: {
        tickets: registrations.length,
        queueActions: queueHistory.length,
        foodOrders: foodHistory.length,
        emergencies: emergencyHistory.length,
        socialGroups: socialHistory.length,
      },
      history: {
        queue: queueHistory,
        food: foodHistory,
        emergencies: emergencyHistory,
        social: socialHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 30);
    const limit = Math.min(100, Math.max(1, requestedLimit));

    const notifications = await UserNotification.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const serialized = notifications.map((item) => serializeUserNotification(item));

    res.json({
      unread: serialized.filter((item) => !item.isRead).length,
      notifications: serialized,
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await UserNotification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        user: req.user._id,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!notification) {
      res.status(404);
      throw new Error("Notification not found");
    }

    res.json({
      message: "Notification marked as read",
      notification: serializeUserNotification(notification),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentUser,
  getMyTickets,
  getMyActivityHistory,
  getMyNotifications,
  markNotificationRead,
};
