const Event = require("../models/Event");
const Registration = require("../models/Registration");
const generatePassId = require("../utils/generatePassId");
const { emitToAdmins, emitToEventRoom } = require("../realtime/socketServer");
const { logPublicAudit } = require("../utils/auditLogger");
const { createUserNotification } = require("../utils/userNotificationService");

const parseLimit = (value, fallback, maxLimit) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maxLimit);
};

const getPublicEvents = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 100, 200);
    const events = await Event.find({ isActive: true })
      .select("title date venue description capacity")
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    res.json(events);
  } catch (error) {
    next(error);
  }
};

const getPublicEventById = async (req, res, next) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .select("title date venue description capacity")
      .lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    res.json(event);
  } catch (error) {
    next(error);
  }
};

const buildPassData = (registration, eventData) => {
  const payload = {
    passId: registration.passId,
    eventId: registration.event.toString(),
    eventTitle: eventData.title,
    eventDate: eventData.date,
    eventVenue: eventData.venue,
    name: registration.name,
    email: registration.email,
  };

  return {
    passId: registration.passId,
    qrValue: JSON.stringify(payload),
    ...payload,
  };
};

const registerForEvent = async (req, res, next) => {
  try {
    const { name, email, phone, college } = req.body;

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to register");
    }

    const normalizedUserEmail = String(req.user.email || "").trim().toLowerCase();
    const normalizedInputEmail = String(email || "").trim().toLowerCase();

    if (normalizedInputEmail && normalizedInputEmail !== normalizedUserEmail) {
      res.status(400);
      throw new Error("Registration email must match logged-in user email");
    }

    if (!phone || !college) {
      res.status(400);
      throw new Error("Phone and college are required");
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      isActive: true,
    }).lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    let passId = "";
    let attempt = 0;

    while (!passId && attempt < 5) {
      const candidate = generatePassId();
      const exists = await Registration.exists({ passId: candidate });
      if (!exists) {
        passId = candidate;
      }
      attempt += 1;
    }

    if (!passId) {
      res.status(500);
      throw new Error("Unable to generate event pass. Please try again");
    }

    const displayName = String(name || req.user.name || "").trim();
    if (!displayName) {
      res.status(400);
      throw new Error("Name is required");
    }

    const registration = await Registration.create({
      user: req.user._id,
      event: event._id,
      name: displayName,
      email: normalizedUserEmail,
      phone,
      college,
      passId,
      eventSnapshot: {
        title: event.title,
        date: event.date,
        venue: event.venue,
      },
    });

    const registrationSummary = {
      registrationId: registration._id.toString(),
      passId: registration.passId,
      eventId: event._id.toString(),
      eventTitle: event.title,
      name: registration.name,
      email: registration.email,
      college: registration.college,
      userId: req.user._id.toString(),
      createdAt: registration.createdAt,
    };

    emitToAdmins("realtime:registration-created", registrationSummary);
    emitToEventRoom(
      event._id.toString(),
      "realtime:event-registration-created",
      registrationSummary
    );

    await createUserNotification({
      userId: req.user._id,
      eventId: event._id,
      type: "ticket-created",
      title: "New event ticket added",
      message: `Your pass ${registration.passId} is ready for ${event.title}.`,
      payload: {
        passId: registration.passId,
        eventTitle: event.title,
        eventDate: event.date,
        venue: event.venue,
      },
    });

    await logPublicAudit({
      req,
      actorId: registration.passId,
      action: "registration.create",
      resourceType: "registration",
      resourceId: registration._id,
      status: "success",
      details: {
        eventId: event._id,
        email: registration.email,
      },
    });

    const pass = buildPassData(registration, event);

    res.status(201).json({
      message: "Registration successful",
      registration: {
        id: registration._id,
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        college: registration.college,
        event: event._id,
        createdAt: registration.createdAt,
      },
      pass,
    });
  } catch (error) {
    next(error);
  }
};

const getPassById = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to access pass details");
    }

    const registration = await Registration.findOne({
      passId: req.params.passId,
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).lean();

    if (!registration) {
      await logPublicAudit({
        req,
        actorId: req.params.passId,
        action: "pass.lookup",
        resourceType: "registration",
        resourceId: req.params.passId,
        status: "blocked",
        details: { reason: "pass-not-found" },
      });
      res.status(404);
      throw new Error("Pass not found");
    }

    const pass = buildPassData(registration, registration.eventSnapshot);

    res.json({
      registration: {
        id: registration._id,
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        college: registration.college,
        createdAt: registration.createdAt,
      },
      pass,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicEvents,
  getPublicEventById,
  registerForEvent,
  getPassById,
};
