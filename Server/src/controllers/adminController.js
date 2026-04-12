const Admin = require("../models/Admin");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const User = require("../models/User");
const { emitToAdmins, emitToEventRoom } = require("../realtime/socketServer");
const { logAdminAudit } = require("../utils/auditLogger");
const {
  createUserNotification,
  emitLiveEventUpdate,
} = require("../utils/userNotificationService");

const serializeRegistration = (registration) => ({
  registrationId: registration._id,
  passId: registration.passId,
  name: registration.name,
  email: registration.email,
  college: registration.college,
  eventId: registration.event?._id || registration.event,
  eventTitle: registration.event?.title || registration.eventSnapshot?.title,
  createdAt: registration.createdAt,
});

const serializeCheckIn = (registration) => ({
  registrationId: registration._id,
  passId: registration.passId,
  name: registration.name,
  eventId: registration.event?._id || registration.event,
  eventTitle: registration.event?.title || registration.eventSnapshot?.title,
  checkedInAt: registration.checkedInAt,
  checkedInBy: registration.checkedInBy
    ? {
        id: registration.checkedInBy._id,
        name: registration.checkedInBy.name,
      }
    : null,
  checkInCount: registration.checkInCount,
});

const extractPassId = (scanPayload) => {
  const value = String(scanPayload || "").trim();

  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed?.passId === "string") {
      return parsed.passId.trim();
    }
  } catch (error) {
    // Raw pass ID is accepted when JSON is not provided.
  }

  return value;
};

const normalizeAudience = (value) => {
  const raw = String(value || "all-registrants").trim().toLowerCase();
  if (raw === "checked-in") {
    return "checked-in";
  }

  return "all-registrants";
};

const createEvent = async (req, res, next) => {
  try {
    const { title, date, venue, description, capacity } = req.body;

    if (!title || !date || !venue || !description || !capacity) {
      res.status(400);
      throw new Error("All event fields are required");
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400);
      throw new Error("Invalid event date");
    }

    const event = await Event.create({
      title,
      date: parsedDate,
      venue,
      description,
      capacity,
      createdBy: req.admin._id,
    });

    await logAdminAudit({
      req,
      action: "event.create",
      resourceType: "event",
      resourceId: event._id,
      status: "success",
      details: {
        title: event.title,
        date: event.date,
      },
    });

    res.status(201).json({
      message: "Event created",
      event,
    });

    emitToAdmins("realtime:event-created", {
      eventId: event._id.toString(),
      title: event.title,
      createdAt: event.createdAt,
      createdBy: {
        id: req.admin._id.toString(),
        name: req.admin.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAdminEvents = async (req, res, next) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json(events);
  } catch (error) {
    next(error);
  }
};

const getRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find()
      .populate("event", "title date venue")
      .populate("checkedInBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json(registrations);
  } catch (error) {
    next(error);
  }
};

const getPendingAdmins = async (req, res, next) => {
  try {
    const pendingAdmins = await Admin.find({
      role: "admin",
      approved: false,
    })
      .select("name email role approved createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json(pendingAdmins);
  } catch (error) {
    next(error);
  }
};

const updateAdminApproval = async (req, res, next) => {
  try {
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      res.status(400);
      throw new Error("approved must be true or false");
    }

    const admin = await Admin.findById(req.params.adminId);

    if (!admin) {
      res.status(404);
      throw new Error("Admin not found");
    }

    if (admin.role === "super-admin") {
      res.status(400);
      throw new Error("Super-admin approval cannot be changed");
    }

    admin.approved = approved;
    await admin.save();

    await logAdminAudit({
      req,
      action: "admin.approval.update",
      resourceType: "admin",
      resourceId: admin._id,
      status: "success",
      details: {
        approved,
        targetEmail: admin.email,
      },
    });

    res.json({
      message: approved ? "Admin approved" : "Admin rejected",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        approved: admin.approved,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCommandSummary = async (req, res, next) => {
  try {
    const [
      activeEvents,
      totalRegistrations,
      totalCheckedIn,
      recentRegistrations,
      recentCheckIns,
      eventStatuses,
    ] = await Promise.all([
      Event.countDocuments({ isActive: true }),
      Registration.countDocuments(),
      Registration.countDocuments({ ticketStatus: "checked-in" }),
      Registration.find()
        .populate("event", "title")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Registration.find({ ticketStatus: "checked-in" })
        .populate("event", "title")
        .populate("checkedInBy", "name")
        .sort({ checkedInAt: -1 })
        .limit(10)
        .lean(),
      Event.find()
        .select("title liveOperations")
        .sort({ date: 1 })
        .lean(),
    ]);

    res.json({
      metrics: {
        activeEvents,
        totalRegistrations,
        totalCheckedIn,
      },
      recentRegistrations: recentRegistrations.map(serializeRegistration),
      recentCheckIns: recentCheckIns.map(serializeCheckIn),
      eventStatuses: eventStatuses.map((event) => ({
        eventId: event._id.toString(),
        title: event.title,
        liveOperations: {
          crowdLevel: event.liveOperations?.crowdLevel || "medium",
          entryGateStatus: event.liveOperations?.entryGateStatus || "open",
          note: event.liveOperations?.note || "",
          updatedAt: event.liveOperations?.updatedAt || event.updatedAt,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
};

const scanPassForEntry = async (req, res, next) => {
  try {
    const { scanPayload } = req.body;
    const passId = extractPassId(scanPayload);

    if (!passId) {
      await logAdminAudit({
        req,
        action: "scan.check-in",
        resourceType: "registration",
        status: "blocked",
        details: {
          reason: "missing-pass-id",
        },
      });
      res.status(400);
      throw new Error("scanPayload with a valid passId is required");
    }

    const registration = await Registration.findOne({ passId }).populate("event", "title");

    if (!registration) {
      await logAdminAudit({
        req,
        action: "scan.check-in",
        resourceType: "registration",
        resourceId: passId,
        status: "blocked",
        details: {
          reason: "pass-not-found",
        },
      });
      res.status(404);
      throw new Error("Pass not found");
    }

    if (registration.ticketStatus === "checked-in") {
      await logAdminAudit({
        req,
        action: "scan.check-in",
        resourceType: "registration",
        resourceId: registration._id,
        status: "blocked",
        details: {
          passId: registration.passId,
          reason: "duplicate-check-in",
        },
      });
      res.status(409);
      throw new Error(
        `Pass already checked in at ${registration.checkedInAt?.toISOString() || "unknown time"}`
      );
    }

    registration.ticketStatus = "checked-in";
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.admin._id;
    registration.checkInCount = (registration.checkInCount || 0) + 1;
    await registration.save();

    const eventId = registration.event?._id
      ? registration.event._id.toString()
      : registration.event.toString();

    const checkIn = {
      registrationId: registration._id.toString(),
      passId: registration.passId,
      name: registration.name,
      eventId,
      eventTitle: registration.event?.title || registration.eventSnapshot?.title,
      checkedInAt: registration.checkedInAt,
      checkInCount: registration.checkInCount,
      scannedBy: {
        id: req.admin._id.toString(),
        name: req.admin.name,
      },
      scanPayload: String(scanPayload || ""),
    };

    emitToAdmins("realtime:check-in", checkIn);
    emitToEventRoom(eventId, "realtime:event-check-in", checkIn);

    const user = await User.findOne({ email: registration.email })
      .select("_id")
      .lean();

    if (user?._id) {
      await createUserNotification({
        userId: user._id,
        eventId,
        type: "ticket-checked-in",
        title: "Check-in successful",
        message: `Your pass ${registration.passId} is checked in for ${registration.event?.title || "event"}.`,
        payload: {
          passId: registration.passId,
          checkedInAt: registration.checkedInAt,
        },
      });
    }

    await logAdminAudit({
      req,
      action: "scan.check-in",
      resourceType: "registration",
      resourceId: registration._id,
      status: "success",
      details: {
        passId: registration.passId,
        eventId,
      },
    });

    res.json({
      message: "Check-in successful",
      checkIn,
    });
  } catch (error) {
    next(error);
  }
};

const updateEventLiveOperations = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { crowdLevel, entryGateStatus, note } = req.body;

    const allowedCrowd = ["low", "medium", "high"];
    const allowedGateStatus = ["open", "busy", "closed"];

    if (crowdLevel && !allowedCrowd.includes(crowdLevel)) {
      res.status(400);
      throw new Error("Invalid crowdLevel. Use low, medium or high");
    }

    if (entryGateStatus && !allowedGateStatus.includes(entryGateStatus)) {
      res.status(400);
      throw new Error("Invalid entryGateStatus. Use open, busy or closed");
    }

    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    if (!event.liveOperations) {
      event.liveOperations = {
        crowdLevel: "medium",
        entryGateStatus: "open",
        note: "",
        updatedAt: new Date(),
      };
    }

    if (crowdLevel) {
      event.liveOperations.crowdLevel = crowdLevel;
    }

    if (entryGateStatus) {
      event.liveOperations.entryGateStatus = entryGateStatus;
    }

    if (typeof note === "string") {
      event.liveOperations.note = note.trim();
    }

    event.liveOperations.updatedAt = new Date();
    await event.save();

    const eventStatus = {
      eventId: event._id.toString(),
      title: event.title,
      liveOperations: {
        crowdLevel: event.liveOperations.crowdLevel,
        entryGateStatus: event.liveOperations.entryGateStatus,
        note: event.liveOperations.note,
        updatedAt: event.liveOperations.updatedAt,
      },
    };

    emitToAdmins("realtime:crowd-updated", eventStatus);
    emitToEventRoom(eventStatus.eventId, "realtime:event-crowd-updated", eventStatus);
    emitLiveEventUpdate({
      eventId: eventStatus.eventId,
      type: "event-live-ops",
      title: `${event.title} live update`,
      message: `Entry gate is ${eventStatus.liveOperations.entryGateStatus} with ${eventStatus.liveOperations.crowdLevel} crowd.` ,
      payload: {
        crowdLevel: eventStatus.liveOperations.crowdLevel,
        entryGateStatus: eventStatus.liveOperations.entryGateStatus,
        note: eventStatus.liveOperations.note,
      },
    });

    await logAdminAudit({
      req,
      action: "event.live-ops.update",
      resourceType: "event",
      resourceId: event._id,
      status: "success",
      details: {
        crowdLevel: eventStatus.liveOperations.crowdLevel,
        entryGateStatus: eventStatus.liveOperations.entryGateStatus,
      },
    });

    res.json({
      message: "Live operations updated",
      eventStatus,
    });
  } catch (error) {
    next(error);
  }
};

const sendEventBroadcast = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const audience = normalizeAudience(req.body?.audience);
    const type = String(req.body?.type || "event-broadcast").trim() || "event-broadcast";

    if (!title || !message) {
      res.status(400);
      throw new Error("title and message are required");
    }

    if (title.length > 160) {
      res.status(400);
      throw new Error("title cannot be longer than 160 characters");
    }

    if (message.length > 500) {
      res.status(400);
      throw new Error("message cannot be longer than 500 characters");
    }

    const event = await Event.findById(eventId)
      .select("title")
      .lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const registrationFilter = {
      event: eventId,
    };

    if (audience === "checked-in") {
      registrationFilter.ticketStatus = "checked-in";
    }

    const registrationEmails = await Registration.distinct("email", registrationFilter);

    const users = registrationEmails.length
      ? await User.find({
          email: { $in: registrationEmails },
          isActive: true,
        })
          .select("_id")
          .lean()
      : [];

    const createdAt = new Date().toISOString();

    await Promise.all(
      users.map((user) =>
        createUserNotification({
          userId: user._id,
          eventId,
          type,
          title,
          message,
          payload: {
            audience,
            source: "admin-command-center",
            sentBy: {
              id: req.admin._id.toString(),
              name: req.admin.name,
            },
            sentAt: createdAt,
          },
        })
      )
    );

    emitLiveEventUpdate({
      eventId,
      type: "admin-broadcast",
      title,
      message,
      payload: {
        audience,
      },
    });

    const broadcastPayload = {
      eventId,
      eventTitle: event.title,
      title,
      message,
      audience,
      recipients: users.length,
      sentBy: {
        id: req.admin._id.toString(),
        name: req.admin.name,
      },
      createdAt,
    };

    emitToAdmins("realtime:user-broadcast-sent", broadcastPayload);
    emitToEventRoom(eventId, "realtime:event-broadcast", broadcastPayload);

    await logAdminAudit({
      req,
      action: "event.broadcast.send",
      resourceType: "event",
      resourceId: eventId,
      status: "success",
      details: {
        audience,
        recipients: users.length,
        title,
      },
    });

    res.json({
      message: "Broadcast sent",
      broadcast: broadcastPayload,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvent,
  getAdminEvents,
  getRegistrations,
  getPendingAdmins,
  updateAdminApproval,
  getCommandSummary,
  scanPassForEntry,
  updateEventLiveOperations,
  sendEventBroadcast,
};
