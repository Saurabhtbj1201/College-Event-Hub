const Event = require("../models/Event");
const Registration = require("../models/Registration");
const User = require("../models/User");
const VenueNavigation = require("../models/VenueNavigation");
const EmergencyIncident = require("../models/EmergencyIncident");
const SocialGroup = require("../models/SocialGroup");
const generateGroupCode = require("../utils/generateGroupCode");
const { emitToAdmins, emitToEventRoom } = require("../realtime/socketServer");
const { logAdminAudit, logPublicAudit } = require("../utils/auditLogger");
const {
  createUserNotification,
  emitLiveEventUpdate,
} = require("../utils/userNotificationService");

const INCIDENT_STATUSES = ["open", "acknowledged", "resolved", "dismissed"];
const INCIDENT_SEVERITIES = ["info", "warning", "critical"];

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return value._id ? value._id.toString() : value.toString();
};

const normalizePassId = (value) => String(value || "").trim().toUpperCase();
const normalizeZoneCode = (value) => String(value || "").trim().toUpperCase();

const getEventOrThrow = async (eventId, { requireActive = false } = {}) => {
  const filter = { _id: eventId };
  if (requireActive) {
    filter.isActive = true;
  }

  return Event.findOne(filter).select("title date venue isActive").lean();
};

const getRegistrationByPass = async (eventId, passId, user = null) =>
  Registration.findOne({
    event: eventId,
    passId,
    ...(user
      ? {
          $or: [{ user: user._id }, { email: user.email }],
        }
      : {}),
  }).lean();

const serializeIncident = (incident, eventTitle = "") => ({
  incidentId: toIdString(incident._id || incident.incidentId),
  eventId: toIdString(incident.event),
  eventTitle,
  registrationId: toIdString(incident.registration),
  passId: incident.passId,
  type: incident.type,
  severity: incident.severity,
  zoneCode: incident.zoneCode || "",
  message: incident.message || "",
  status: incident.status,
  reporter: {
    name: incident.reporterSnapshot?.name || "",
    email: incident.reporterSnapshot?.email || "",
    college: incident.reporterSnapshot?.college || "",
  },
  timeline: Array.isArray(incident.timeline)
    ? incident.timeline.map((entry) => ({
        status: entry.status,
        at: entry.at,
        byAdmin: toIdString(entry.byAdmin),
        note: entry.note || "",
      }))
    : [],
  acknowledgedAt: incident.acknowledgedAt,
  resolvedAt: incident.resolvedAt,
  dismissedAt: incident.dismissedAt,
  handledBy: toIdString(incident.handledBy),
  createdAt: incident.createdAt,
  updatedAt: incident.updatedAt,
});

const maskPassId = (passId) => {
  const value = String(passId || "").trim();
  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
};

const getSeatClusterSuggestion = (group) => {
  const preferred = normalizeZoneCode(group.preferredZoneCode);
  if (preferred) {
    return `Suggested meetup zone: ${preferred}.`;
  }

  const counter = new Map();

  (group.members || []).forEach((member) => {
    if (!member.consentShareLocation || !member.currentZoneCode) {
      return;
    }

    const zoneCode = normalizeZoneCode(member.currentZoneCode);
    const currentCount = counter.get(zoneCode) || 0;
    counter.set(zoneCode, currentCount + 1);
  });

  let suggestedZone = "";
  let highestCount = 0;

  counter.forEach((count, zoneCode) => {
    if (count > highestCount) {
      highestCount = count;
      suggestedZone = zoneCode;
    }
  });

  if (suggestedZone && highestCount >= 2) {
    return `Most group members are near ${suggestedZone}. Consider clustering there.`;
  }

  return "No strong cluster signal yet. Ask members to share location consent for better guidance.";
};

const serializeSocialGroup = (group, { viewerPassId = "" } = {}) => {
  const normalizedViewer = normalizePassId(viewerPassId);

  return {
    groupId: toIdString(group._id || group.groupId),
    eventId: toIdString(group.event),
    groupCode: group.groupCode,
    groupName: group.groupName,
    leaderPassId: maskPassId(group.leaderPassId),
    preferredZoneCode: group.preferredZoneCode || "",
    seatClusterHint: group.seatClusterHint || "",
    seatClusterSuggestion: getSeatClusterSuggestion(group),
    memberCount: Array.isArray(group.members) ? group.members.length : 0,
    members: Array.isArray(group.members)
      ? group.members.map((member) => {
          const sameViewer = normalizePassId(member.passId) === normalizedViewer;
          const canRevealLocation = member.consentShareLocation || sameViewer;

          return {
            passId: sameViewer ? member.passId : maskPassId(member.passId),
            displayName: member.alias || member.name,
            consentShareLocation: Boolean(member.consentShareLocation),
            currentZoneCode: canRevealLocation ? member.currentZoneCode || "" : "",
            lastLocationAt: canRevealLocation ? member.lastLocationAt : null,
            joinedAt: member.joinedAt,
          };
        })
      : [],
    isActive: Boolean(group.isActive),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const createUniqueGroupCode = async (eventId) => {
  let groupCode = "";
  let attempts = 0;

  while (!groupCode && attempts < 10) {
    const candidate = generateGroupCode();
    const exists = await SocialGroup.exists({ event: eventId, groupCode: candidate });
    if (!exists) {
      groupCode = candidate;
    }
    attempts += 1;
  }

  return groupCode;
};

const triggerSOS = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const passId = normalizePassId(req.body?.passId);
    const zoneCode = normalizeZoneCode(req.body?.zoneCode);
    const message = String(req.body?.message || "").trim().slice(0, 500);

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to trigger SOS");
    }

    if (!passId) {
      res.status(400);
      throw new Error("passId is required");
    }

    const event = await getEventOrThrow(eventId, { requireActive: true });
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const registration = await getRegistrationByPass(eventId, passId, req.user);
    if (!registration) {
      res.status(404);
      throw new Error("This pass is not linked to your user account for the event");
    }

    const incident = await EmergencyIncident.create({
      user: req.user._id,
      event: eventId,
      registration: registration._id,
      passId,
      type: "sos",
      severity: "critical",
      zoneCode,
      message,
      status: "open",
      reporterSnapshot: {
        name: registration.name,
        email: registration.email,
        college: registration.college,
      },
      timeline: [{ status: "open", at: new Date(), byAdmin: null, note: "SOS received" }],
    });

    const payload = serializeIncident(incident.toObject(), event.title);

    emitToAdmins("realtime:emergency-incident", {
      reason: "created",
      incident: payload,
    });

    emitToEventRoom(eventId, "realtime:event-emergency-incident", {
      reason: "created",
      incident: payload,
    });

    emitLiveEventUpdate({
      eventId,
      type: "sos-triggered",
      title: "Emergency SOS triggered",
      message: `Emergency team has been alerted for pass ${passId}.`,
      payload: {
        incidentId: payload.incidentId,
        passId,
        zoneCode,
      },
    });

    await createUserNotification({
      userId: req.user._id,
      eventId,
      type: "sos-triggered",
      title: "Emergency team alerted",
      message: "Your SOS request has been received and sent to event operations.",
      payload: {
        incidentId: payload.incidentId,
        passId,
        zoneCode,
      },
    });

    await logPublicAudit({
      req,
      actorId: passId,
      action: "emergency.sos.create",
      resourceType: "emergency-incident",
      resourceId: incident._id,
      status: "success",
      details: {
        eventId,
        zoneCode,
      },
    });

    res.status(201).json({
      message: "SOS alert submitted",
      incident: payload,
    });
  } catch (error) {
    next(error);
  }
};

const getNearestExit = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const fromCode = normalizeZoneCode(req.query.from);

    if (!fromCode) {
      res.status(400);
      throw new Error("from query parameter is required");
    }

    const event = await getEventOrThrow(eventId, { requireActive: true });
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const navigation = await VenueNavigation.findOne({ event: eventId }).lean();

    if (!navigation || !Array.isArray(navigation.zones) || navigation.zones.length === 0) {
      res.status(404);
      throw new Error("Navigation map is not available for this event");
    }

    const fromZone = navigation.zones.find((zone) => normalizeZoneCode(zone.code) === fromCode);
    if (!fromZone) {
      res.status(404);
      throw new Error("Source zone not found in navigation map");
    }

    const exitZones = navigation.zones.filter(
      (zone) => zone.type === "gate" || normalizeZoneCode(zone.code).includes("EXIT")
    );

    if (exitZones.length === 0) {
      res.status(404);
      throw new Error("No exit zones configured in navigation map");
    }

    const fromCenter = {
      x: Number(fromZone.x) + Number(fromZone.width) / 2,
      y: Number(fromZone.y) + Number(fromZone.height) / 2,
    };

    const nearestExit = exitZones
      .map((zone) => {
        const zoneCenter = {
          x: Number(zone.x) + Number(zone.width) / 2,
          y: Number(zone.y) + Number(zone.height) / 2,
        };

        const distance = Math.hypot(fromCenter.x - zoneCenter.x, fromCenter.y - zoneCenter.y);

        return {
          zone,
          distance,
        };
      })
      .sort((left, right) => left.distance - right.distance)[0];

    const toCode = normalizeZoneCode(nearestExit.zone.code);

    const matchedRoute = Array.isArray(navigation.routeHints)
      ? navigation.routeHints.find(
          (hint) => normalizeZoneCode(hint.fromCode) === fromCode && normalizeZoneCode(hint.toCode) === toCode
        )
      : null;

    const fallbackRoute = {
      fromCode,
      toCode,
      instructions: [
        `Start from ${fromCode}.`,
        "Follow overhead safety signs and nearest exit arrows.",
        `Proceed to ${toCode}.`,
      ],
      estimatedMinutes: Math.max(1, Math.round(nearestExit.distance / 90)),
      crowdRecommendation: "preferred",
    };

    const routeHint = matchedRoute || fallbackRoute;

    res.json({
      event: {
        id: eventId,
        title: event.title,
      },
      fromZone: {
        code: fromZone.code,
        label: fromZone.label,
      },
      nearestExit: {
        code: nearestExit.zone.code,
        label: nearestExit.zone.label,
        type: nearestExit.zone.type,
        approxDistance: Number(nearestExit.distance.toFixed(1)),
      },
      routeHint,
    });
  } catch (error) {
    next(error);
  }
};

const getEmergencyIncidents = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const status = String(req.query.status || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(300, Number(req.query.limit || 120)));

    const event = await getEventOrThrow(eventId);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const filter = { event: eventId };

    if (status) {
      if (!INCIDENT_STATUSES.includes(status)) {
        res.status(400);
        throw new Error("Invalid incident status filter");
      }
      filter.status = status;
    }

    const incidents = await EmergencyIncident.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const metrics = {
      total: incidents.length,
      byStatus: INCIDENT_STATUSES.reduce((acc, value) => ({ ...acc, [value]: 0 }), {}),
    };

    incidents.forEach((incident) => {
      metrics.byStatus[incident.status] = (metrics.byStatus[incident.status] || 0) + 1;
    });

    res.json({
      event: {
        id: eventId,
        title: event.title,
      },
      metrics,
      incidents: incidents.map((incident) => serializeIncident(incident, event.title)),
    });
  } catch (error) {
    next(error);
  }
};

const updateEmergencyIncident = async (req, res, next) => {
  try {
    const { incidentId } = req.params;
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim().slice(0, 180);

    if (!INCIDENT_STATUSES.includes(nextStatus)) {
      res.status(400);
      throw new Error("Invalid status. Use open, acknowledged, resolved, or dismissed");
    }

    const incident = await EmergencyIncident.findById(incidentId).populate("event", "title");

    if (!incident) {
      res.status(404);
      throw new Error("Emergency incident not found");
    }

    const previousStatus = incident.status;

    if (previousStatus !== nextStatus) {
      incident.status = nextStatus;
      incident.timeline.push({
        status: nextStatus,
        at: new Date(),
        byAdmin: req.admin._id,
        note,
      });

      if (nextStatus === "acknowledged") {
        incident.acknowledgedAt = new Date();
        incident.handledBy = req.admin._id;
      }

      if (nextStatus === "resolved") {
        incident.resolvedAt = new Date();
        incident.handledBy = req.admin._id;
      }

      if (nextStatus === "dismissed") {
        incident.dismissedAt = new Date();
        incident.handledBy = req.admin._id;
      }

      await incident.save();
    }

    const eventId = toIdString(incident.event?._id || incident.event);
    const eventTitle = incident.event?.title || "Event";

    const payload = serializeIncident(incident.toObject(), eventTitle);

    emitToAdmins("realtime:emergency-incident", {
      reason: "status-updated",
      incident: payload,
    });

    emitToEventRoom(eventId, "realtime:event-emergency-incident", {
      reason: "status-updated",
      incident: payload,
    });

    emitLiveEventUpdate({
      eventId,
      type: "emergency-incident-status",
      title: "Emergency incident status update",
      message: `Incident for pass ${incident.passId} is now ${nextStatus}.`,
      payload: {
        incidentId: payload.incidentId,
        status: nextStatus,
      },
    });

    await logAdminAudit({
      req,
      action: "emergency.incident.update",
      resourceType: "emergency-incident",
      resourceId: incident._id,
      status: "success",
      details: {
        eventId,
        previousStatus,
        nextStatus,
      },
    });

    res.json({
      message: "Emergency incident updated",
      incident: payload,
    });
  } catch (error) {
    next(error);
  }
};

const sendEmergencyBroadcast = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const title = String(req.body?.title || "").trim().slice(0, 160);
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const zoneCode = normalizeZoneCode(req.body?.zoneCode);
    const severity = String(req.body?.severity || "warning").trim().toLowerCase();

    if (!title || !message) {
      res.status(400);
      throw new Error("title and message are required");
    }

    if (!INCIDENT_SEVERITIES.includes(severity)) {
      res.status(400);
      throw new Error("Invalid severity. Use info, warning, or critical");
    }

    const event = await getEventOrThrow(eventId);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const emails = await Registration.distinct("email", { event: eventId });

    const users = emails.length
      ? await User.find({
          email: { $in: emails },
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
          type: "emergency-broadcast",
          title,
          message,
          payload: {
            severity,
            zoneCode,
            source: "admin-emergency-panel",
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
      type: "emergency-broadcast",
      title,
      message,
      payload: {
        severity,
        zoneCode,
      },
    });

    const broadcastPayload = {
      eventId,
      eventTitle: event.title,
      title,
      message,
      severity,
      zoneCode,
      recipients: users.length,
      sentBy: {
        id: req.admin._id.toString(),
        name: req.admin.name,
      },
      createdAt,
    };

    emitToAdmins("realtime:emergency-broadcast", broadcastPayload);
    emitToEventRoom(eventId, "realtime:event-emergency-broadcast", broadcastPayload);

    await logAdminAudit({
      req,
      action: "emergency.broadcast.send",
      resourceType: "event",
      resourceId: eventId,
      status: "success",
      details: {
        severity,
        zoneCode,
        recipients: users.length,
      },
    });

    res.json({
      message: "Emergency broadcast sent",
      broadcast: broadcastPayload,
    });
  } catch (error) {
    next(error);
  }
};

const createSocialGroup = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const leaderPassId = normalizePassId(req.body?.leaderPassId);
    const groupName = String(req.body?.groupName || "").trim();
    const preferredZoneCode = normalizeZoneCode(req.body?.preferredZoneCode);
    const seatClusterHint = String(req.body?.seatClusterHint || "").trim().slice(0, 240);
    const consentShareLocation = Boolean(req.body?.consentShareLocation);
    const alias = String(req.body?.alias || "").trim().slice(0, 80);

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to create social group");
    }

    if (!leaderPassId) {
      res.status(400);
      throw new Error("leaderPassId is required");
    }

    const event = await getEventOrThrow(eventId, { requireActive: true });
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const leaderRegistration = await getRegistrationByPass(eventId, leaderPassId, req.user);
    if (!leaderRegistration) {
      res.status(404);
      throw new Error("Leader pass is not linked to your user account for the event");
    }

    const generatedCode = await createUniqueGroupCode(eventId);
    if (!generatedCode) {
      res.status(500);
      throw new Error("Unable to create group code. Please try again");
    }

    const normalizedGroupName = groupName || `${leaderRegistration.name}'s Group`;

    const group = await SocialGroup.create({
      event: eventId,
      groupCode: generatedCode,
      groupName: normalizedGroupName,
      leaderRegistration: leaderRegistration._id,
      leaderUser: req.user._id,
      leaderPassId,
      preferredZoneCode,
      seatClusterHint,
      members: [
        {
          user: req.user._id,
          registration: leaderRegistration._id,
          passId: leaderPassId,
          name: leaderRegistration.name,
          alias,
          consentShareLocation,
          currentZoneCode: "",
          lastLocationAt: null,
          joinedAt: new Date(),
        },
      ],
      isActive: true,
    });

    const payload = serializeSocialGroup(group.toObject(), { viewerPassId: leaderPassId });

    emitToEventRoom(eventId, "realtime:event-social-group", {
      reason: "created",
      group: payload,
    });

    await logPublicAudit({
      req,
      actorId: leaderPassId,
      action: "social.group.create",
      resourceType: "social-group",
      resourceId: group._id,
      status: "success",
      details: {
        eventId,
        groupCode: generatedCode,
      },
    });

    res.status(201).json({
      message: "Social group created",
      group: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error("Group code conflict. Please retry"));
    }

    return next(error);
  }
};

const joinSocialGroup = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const groupCode = String(req.params.groupCode || "").trim().toUpperCase();
    const passId = normalizePassId(req.body?.passId);
    const consentShareLocation = Boolean(req.body?.consentShareLocation);
    const alias = String(req.body?.alias || "").trim().slice(0, 80);

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to join social group");
    }

    if (!groupCode || !passId) {
      res.status(400);
      throw new Error("groupCode and passId are required");
    }

    const event = await getEventOrThrow(eventId, { requireActive: true });
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const registration = await getRegistrationByPass(eventId, passId, req.user);
    if (!registration) {
      res.status(404);
      throw new Error("This pass is not linked to your user account for the event");
    }

    const group = await SocialGroup.findOne({
      event: eventId,
      groupCode,
      isActive: true,
    });

    if (!group) {
      res.status(404);
      throw new Error("Social group not found");
    }

    const existingMember = group.members.find(
      (member) =>
        normalizePassId(member.passId) === passId ||
        (member.user && toIdString(member.user) === toIdString(req.user._id))
    );

    if (existingMember) {
      res.status(409);
      throw new Error("Pass already joined this group");
    }

    if (group.members.length >= 30) {
      res.status(409);
      throw new Error("Group has reached maximum member capacity");
    }

    group.members.push({
      user: req.user._id,
      registration: registration._id,
      passId,
      name: registration.name,
      alias,
      consentShareLocation,
      currentZoneCode: "",
      lastLocationAt: null,
      joinedAt: new Date(),
    });

    await group.save();

    const payload = serializeSocialGroup(group.toObject(), { viewerPassId: passId });

    emitToEventRoom(eventId, "realtime:event-social-group", {
      reason: "member-joined",
      group: payload,
    });

    await logPublicAudit({
      req,
      actorId: passId,
      action: "social.group.join",
      resourceType: "social-group",
      resourceId: group._id,
      status: "success",
      details: {
        eventId,
        groupCode,
      },
    });

    res.json({
      message: "Joined social group",
      group: payload,
    });
  } catch (error) {
    next(error);
  }
};

const updateSocialGroupLocation = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const groupCode = String(req.params.groupCode || "").trim().toUpperCase();
    const passId = normalizePassId(req.body?.passId);
    const zoneCode = normalizeZoneCode(req.body?.zoneCode);
    const consentShareLocationRaw = req.body?.consentShareLocation;

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to update group location");
    }

    if (!groupCode || !passId) {
      res.status(400);
      throw new Error("groupCode and passId are required");
    }

    if (!zoneCode && typeof consentShareLocationRaw !== "boolean") {
      res.status(400);
      throw new Error("Provide zoneCode or consentShareLocation");
    }

    const registration = await getRegistrationByPass(eventId, passId, req.user);
    if (!registration) {
      res.status(404);
      throw new Error("This pass is not linked to your user account for the event");
    }

    const group = await SocialGroup.findOne({
      event: eventId,
      groupCode,
      isActive: true,
    });

    if (!group) {
      res.status(404);
      throw new Error("Social group not found");
    }

    const member = group.members.find(
      (item) =>
        normalizePassId(item.passId) === passId &&
        (!item.user || toIdString(item.user) === toIdString(req.user._id))
    );

    if (!member) {
      res.status(403);
      throw new Error("Pass is not part of this group");
    }

    if (typeof consentShareLocationRaw === "boolean") {
      member.consentShareLocation = consentShareLocationRaw;
      if (!member.consentShareLocation) {
        member.currentZoneCode = "";
        member.lastLocationAt = null;
      }
    }

    if (zoneCode && member.consentShareLocation) {
      member.currentZoneCode = zoneCode;
      member.lastLocationAt = new Date();
    }

    await group.save();

    const payload = serializeSocialGroup(group.toObject(), { viewerPassId: passId });

    emitToEventRoom(eventId, "realtime:event-social-group", {
      reason: "location-updated",
      group: payload,
    });

    await logPublicAudit({
      req,
      actorId: passId,
      action: "social.group.location.update",
      resourceType: "social-group",
      resourceId: group._id,
      status: "success",
      details: {
        eventId,
        groupCode,
        zoneCode,
        consentShareLocation: member.consentShareLocation,
      },
    });

    res.json({
      message: "Group location updated",
      group: payload,
    });
  } catch (error) {
    next(error);
  }
};

const getSocialGroup = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const groupCode = String(req.params.groupCode || "").trim().toUpperCase();
    const passId = normalizePassId(req.query.passId || req.query.passid);

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to view social group");
    }

    if (!groupCode || !passId) {
      res.status(400);
      throw new Error("groupCode and passId are required");
    }

    const registration = await getRegistrationByPass(eventId, passId, req.user);
    if (!registration) {
      res.status(404);
      throw new Error("This pass is not linked to your user account for the event");
    }

    const group = await SocialGroup.findOne({
      event: eventId,
      groupCode,
      isActive: true,
    }).lean();

    if (!group) {
      res.status(404);
      throw new Error("Social group not found");
    }

    const isMember = (group.members || []).some(
      (member) =>
        normalizePassId(member.passId) === passId &&
        (!member.user || toIdString(member.user) === toIdString(req.user._id))
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not authorized to view this group");
    }

    res.json({
      group: serializeSocialGroup(group, { viewerPassId: passId }),
    });
  } catch (error) {
    next(error);
  }
};

const getAdminSocialGroups = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const activeOnly = String(req.query.activeOnly || "true").trim().toLowerCase() !== "false";
    const limit = Math.max(1, Math.min(300, Number(req.query.limit || 120)));

    const event = await getEventOrThrow(eventId);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const filter = { event: eventId };
    if (activeOnly) {
      filter.isActive = true;
    }

    const groups = await SocialGroup.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const payload = groups.map((group) => serializeSocialGroup(group));

    res.json({
      event: {
        id: eventId,
        title: event.title,
      },
      metrics: {
        totalGroups: payload.length,
        activeGroups: payload.filter((group) => group.isActive).length,
      },
      groups: payload,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  triggerSOS,
  getNearestExit,
  getEmergencyIncidents,
  updateEmergencyIncident,
  sendEmergencyBroadcast,
  createSocialGroup,
  joinSocialGroup,
  updateSocialGroupLocation,
  getSocialGroup,
  getAdminSocialGroups,
};
