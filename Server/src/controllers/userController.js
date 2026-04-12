const Registration = require("../models/Registration");
const UserNotification = require("../models/UserNotification");
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
      email: req.user.email,
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
  getMyNotifications,
  markNotificationRead,
};
