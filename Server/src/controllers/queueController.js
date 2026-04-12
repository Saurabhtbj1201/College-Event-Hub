const Event = require("../models/Event");
const QueuePoint = require("../models/QueuePoint");
const QueueTicket = require("../models/QueueTicket");
const Registration = require("../models/Registration");
const { emitToAdmins, emitToEventRoom } = require("../realtime/socketServer");
const { logAdminAudit, logPublicAudit } = require("../utils/auditLogger");
const { emitLiveEventUpdate } = require("../utils/userNotificationService");

const toObjectIdList = (items) => items.map((item) => item._id);
const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return value._id ? value._id.toString() : value.toString();
};

const getWaitingCountMap = async (queuePointIds) => {
  if (!queuePointIds.length) {
    return new Map();
  }

  const grouped = await QueueTicket.aggregate([
    {
      $match: {
        queuePoint: { $in: queuePointIds },
        status: "waiting",
      },
    },
    {
      $group: {
        _id: "$queuePoint",
        waitingCount: { $sum: 1 },
      },
    },
  ]);

  const result = new Map();
  grouped.forEach((item) => {
    result.set(item._id.toString(), item.waitingCount);
  });

  return result;
};

const buildQueuePointSummary = (queuePoint, waitingCount) => {
  const manualWait = Number(queuePoint.manualWaitTimeMinutes || 0);
  const estimatedWaitMinutes = manualWait > 0 ? manualWait : waitingCount * 3;

  return {
    queuePointId: queuePoint._id.toString(),
    eventId: queuePoint.event?._id
      ? queuePoint.event._id.toString()
      : queuePoint.event.toString(),
    eventTitle: queuePoint.event?.title,
    pointType: queuePoint.pointType,
    pointName: queuePoint.pointName,
    status: queuePoint.status,
    manualWaitTimeMinutes: manualWait,
    estimatedWaitMinutes,
    waitingCount,
    note: queuePoint.note || "",
    updatedAt: queuePoint.updatedAt,
  };
};

const buildQueueTicketPayload = ({ ticket, queuePointSummary, position }) => ({
  ticketId: ticket._id.toString(),
  eventId: toIdString(ticket.event),
  queuePointId: toIdString(ticket.queuePoint),
  passId: ticket.passId,
  status: ticket.status,
  joinedAt: ticket.joinedAt,
  servedAt: ticket.servedAt,
  position,
  queuePoint: queuePointSummary,
});

const getQueueOverview = async (req, res, next) => {
  try {
    const filter = { isActive: true };

    if (req.query.eventId) {
      filter.event = req.query.eventId;
    }

    const queuePoints = await QueuePoint.find(filter)
      .populate("event", "title")
      .sort({ updatedAt: -1 })
      .lean();

    const waitingCountMap = await getWaitingCountMap(toObjectIdList(queuePoints));

    const queuePointSummaries = queuePoints.map((queuePoint) => {
      const waitingCount = waitingCountMap.get(queuePoint._id.toString()) || 0;
      return buildQueuePointSummary(queuePoint, waitingCount);
    });

    const totalWaiting = queuePointSummaries.reduce(
      (sum, item) => sum + item.waitingCount,
      0
    );

    res.json({
      metrics: {
        queuePoints: queuePointSummaries.length,
        totalWaiting,
      },
      queuePoints: queuePointSummaries,
    });
  } catch (error) {
    next(error);
  }
};

const getQueueAnalytics = async (req, res, next) => {
  try {
    const filter = { isActive: true };

    if (req.query.eventId) {
      filter.event = req.query.eventId;
    }

    const queuePoints = await QueuePoint.find(filter)
      .populate("event", "title")
      .sort({ pointType: 1, pointName: 1 })
      .lean();

    if (queuePoints.length === 0) {
      return res.json({
        metrics: {
          points: 0,
          totalServed: 0,
          totalWaiting: 0,
          averageWaitMinutes: 0,
          busiestPointName: null,
        },
        perPoint: [],
      });
    }

    const queuePointIds = toObjectIdList(queuePoints);
    const tickets = await QueueTicket.find({
      queuePoint: { $in: queuePointIds },
      status: { $in: ["waiting", "served"] },
    })
      .select("queuePoint status joinedAt servedAt")
      .lean();

    const analyticsMap = new Map();

    queuePoints.forEach((queuePoint) => {
      analyticsMap.set(queuePoint._id.toString(), {
        queuePoint,
        waitingCount: 0,
        servedCount: 0,
        totalWaitMs: 0,
      });
    });

    tickets.forEach((ticket) => {
      const key = ticket.queuePoint.toString();
      const stats = analyticsMap.get(key);
      if (!stats) {
        return;
      }

      if (ticket.status === "waiting") {
        stats.waitingCount += 1;
      }

      if (ticket.status === "served") {
        stats.servedCount += 1;

        if (ticket.servedAt && ticket.joinedAt) {
          const diffMs = new Date(ticket.servedAt).getTime() - new Date(ticket.joinedAt).getTime();
          if (diffMs > 0) {
            stats.totalWaitMs += diffMs;
          }
        }
      }
    });

    const perPoint = [];
    let totalServed = 0;
    let totalWaiting = 0;
    let weightedWaitMinutes = 0;
    let busiestPointName = null;
    let busiestPointWaiting = -1;

    analyticsMap.forEach((stats) => {
      const averageWaitMinutes =
        stats.servedCount > 0
          ? Number((stats.totalWaitMs / stats.servedCount / 60000).toFixed(2))
          : 0;

      const throughput = stats.servedCount;

      totalServed += stats.servedCount;
      totalWaiting += stats.waitingCount;
      weightedWaitMinutes += averageWaitMinutes * stats.servedCount;

      if (stats.waitingCount > busiestPointWaiting) {
        busiestPointWaiting = stats.waitingCount;
        busiestPointName = stats.queuePoint.pointName;
      }

      perPoint.push({
        queuePointId: stats.queuePoint._id.toString(),
        eventId: stats.queuePoint.event?._id
          ? stats.queuePoint.event._id.toString()
          : stats.queuePoint.event.toString(),
        eventTitle: stats.queuePoint.event?.title,
        pointType: stats.queuePoint.pointType,
        pointName: stats.queuePoint.pointName,
        status: stats.queuePoint.status,
        waitingCount: stats.waitingCount,
        servedCount: stats.servedCount,
        averageWaitMinutes,
        throughput,
      });
    });

    perPoint.sort((a, b) => b.throughput - a.throughput || b.waitingCount - a.waitingCount);

    const averageWaitMinutes =
      totalServed > 0 ? Number((weightedWaitMinutes / totalServed).toFixed(2)) : 0;

    return res.json({
      metrics: {
        points: perPoint.length,
        totalServed,
        totalWaiting,
        averageWaitMinutes,
        busiestPointName,
      },
      perPoint,
    });
  } catch (error) {
    return next(error);
  }
};

const createQueuePoint = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const {
      pointType,
      pointName,
      status = "normal",
      manualWaitTimeMinutes = 0,
      note = "",
    } = req.body;

    if (!pointType || !pointName) {
      res.status(400);
      throw new Error("pointType and pointName are required");
    }

    const event = await Event.findById(eventId).select("title").lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const queuePoint = await QueuePoint.create({
      event: eventId,
      pointType,
      pointName,
      status,
      manualWaitTimeMinutes,
      note,
      updatedBy: req.admin._id,
    });

    const payload = buildQueuePointSummary(
      {
        ...queuePoint.toObject(),
        event,
      },
      0
    );

    const eventPayload = {
      reason: "created",
      queuePoint: payload,
    };

    emitToAdmins("realtime:queue-updated", eventPayload);
    emitToEventRoom(eventId, "realtime:event-queue-updated", eventPayload);
    emitLiveEventUpdate({
      eventId,
      type: "queue-updated",
      title: `${payload.pointName} queue opened`,
      message: `Queue point ${payload.pointName} is active with ${payload.status} status.`,
      payload,
    });

    await logAdminAudit({
      req,
      action: "queue.point.create",
      resourceType: "queue-point",
      resourceId: queuePoint._id,
      status: "success",
      details: {
        eventId,
        pointType,
        pointName,
      },
    });

    res.status(201).json({
      message: "Queue point created",
      queuePoint: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error("Queue point already exists for this event"));
    }

    if (error.name === "ValidationError") {
      res.status(400);
      return next(new Error(error.message));
    }

    return next(error);
  }
};

const updateQueuePoint = async (req, res, next) => {
  try {
    const { queuePointId } = req.params;
    const { status, manualWaitTimeMinutes, note, isActive } = req.body;

    const queuePoint = await QueuePoint.findById(queuePointId).populate("event", "title");

    if (!queuePoint) {
      res.status(404);
      throw new Error("Queue point not found");
    }

    const allowedStatus = ["free", "normal", "busy"];

    if (status) {
      if (!allowedStatus.includes(status)) {
        res.status(400);
        throw new Error("Invalid queue status. Use free, normal or busy");
      }
      queuePoint.status = status;
    }

    if (typeof manualWaitTimeMinutes !== "undefined") {
      queuePoint.manualWaitTimeMinutes = Number(manualWaitTimeMinutes);
    }

    if (typeof note === "string") {
      queuePoint.note = note.trim();
    }

    if (typeof isActive === "boolean") {
      queuePoint.isActive = isActive;
    }

    queuePoint.updatedBy = req.admin._id;
    await queuePoint.save();

    const waitingCount = await QueueTicket.countDocuments({
      queuePoint: queuePoint._id,
      status: "waiting",
    });

    const payload = buildQueuePointSummary(queuePoint, waitingCount);

    const eventPayload = {
      reason: "updated",
      queuePoint: payload,
    };

    emitToAdmins("realtime:queue-updated", eventPayload);
    emitToEventRoom(payload.eventId, "realtime:event-queue-updated", eventPayload);
    emitLiveEventUpdate({
      eventId: payload.eventId,
      type: "queue-updated",
      title: `${payload.pointName} queue updated`,
      message: `${payload.pointName} now has ${payload.waitingCount} waiting users.`,
      payload,
    });

    await logAdminAudit({
      req,
      action: "queue.point.update",
      resourceType: "queue-point",
      resourceId: queuePoint._id,
      status: "success",
      details: {
        pointName: queuePoint.pointName,
        status: queuePoint.status,
      },
    });

    res.json({
      message: "Queue point updated",
      queuePoint: payload,
    });
  } catch (error) {
    next(error);
  }
};

const serveNextQueueTicket = async (req, res, next) => {
  try {
    const { queuePointId } = req.params;

    const queuePoint = await QueuePoint.findById(queuePointId).populate("event", "title");

    if (!queuePoint) {
      res.status(404);
      throw new Error("Queue point not found");
    }

    const ticket = await QueueTicket.findOne({
      queuePoint: queuePoint._id,
      status: "waiting",
    })
      .sort({ joinedAt: 1 })
      .lean();

    if (!ticket) {
      res.status(404);
      throw new Error("No waiting ticket in this queue");
    }

    await QueueTicket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          status: "served",
          servedAt: new Date(),
          servedBy: req.admin._id,
        },
      }
    );

    const updatedTicket = await QueueTicket.findById(ticket._id).lean();

    const waitingCount = await QueueTicket.countDocuments({
      queuePoint: queuePoint._id,
      status: "waiting",
    });

    const queuePointSummary = buildQueuePointSummary(queuePoint, waitingCount);

    const ticketPayload = buildQueueTicketPayload({
      ticket: updatedTicket,
      queuePointSummary,
      position: 0,
    });

    emitToAdmins("realtime:queue-ticket-served", {
      queuePoint: queuePointSummary,
      ticket: ticketPayload,
    });

    emitToAdmins("realtime:queue-updated", {
      reason: "served",
      queuePoint: queuePointSummary,
      ticket: ticketPayload,
    });

    emitToEventRoom(queuePointSummary.eventId, "realtime:event-queue-updated", {
      reason: "served",
      queuePoint: queuePointSummary,
      ticket: ticketPayload,
    });
    emitLiveEventUpdate({
      eventId: queuePointSummary.eventId,
      type: "queue-served",
      title: `${queuePointSummary.pointName} moved`,
      message: `Queue advanced at ${queuePointSummary.pointName}.`,
      payload: {
        queuePoint: queuePointSummary,
        ticket: ticketPayload,
      },
    });

    await logAdminAudit({
      req,
      action: "queue.ticket.serve-next",
      resourceType: "queue-ticket",
      resourceId: updatedTicket._id,
      status: "success",
      details: {
        queuePointId: queuePoint._id,
        passId: updatedTicket.passId,
      },
    });

    res.json({
      message: "Next queue ticket served",
      ticket: ticketPayload,
      queuePoint: queuePointSummary,
    });
  } catch (error) {
    next(error);
  }
};

const getEventQueues = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({ _id: eventId, isActive: true })
      .select("title date venue")
      .lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const queuePoints = await QueuePoint.find({ event: eventId, isActive: true })
      .sort({ pointType: 1, pointName: 1 })
      .lean();

    const waitingCountMap = await getWaitingCountMap(toObjectIdList(queuePoints));

    const queuePointSummaries = queuePoints.map((queuePoint) => {
      const waitingCount = waitingCountMap.get(queuePoint._id.toString()) || 0;
      return buildQueuePointSummary(
        {
          ...queuePoint,
          event,
        },
        waitingCount
      );
    });

    res.json({
      event,
      queuePoints: queuePointSummaries,
    });
  } catch (error) {
    next(error);
  }
};

const joinQueue = async (req, res, next) => {
  try {
    const { eventId, queuePointId } = req.params;
    const { passId } = req.body;

    if (!passId) {
      res.status(400);
      throw new Error("passId is required to join queue");
    }

    const normalizedPassId = String(passId).trim().toUpperCase();

    const queuePoint = await QueuePoint.findOne({
      _id: queuePointId,
      event: eventId,
      isActive: true,
    }).populate("event", "title");

    if (!queuePoint) {
      res.status(404);
      throw new Error("Queue point not found");
    }

    const registration = await Registration.findOne({
      event: eventId,
      passId: normalizedPassId,
    }).lean();

    if (!registration) {
      res.status(404);
      throw new Error("Registration with this passId not found for the event");
    }

    const alreadyWaiting = await QueueTicket.findOne({
      queuePoint: queuePoint._id,
      passId: normalizedPassId,
      status: "waiting",
    }).lean();

    if (alreadyWaiting) {
      res.status(409);
      throw new Error("You are already waiting in this queue");
    }

    const waitingCountBefore = await QueueTicket.countDocuments({
      queuePoint: queuePoint._id,
      status: "waiting",
    });

    const ticket = await QueueTicket.create({
      event: eventId,
      queuePoint: queuePoint._id,
      registration: registration._id,
      passId: normalizedPassId,
      status: "waiting",
    });

    const waitingCount = waitingCountBefore + 1;
    const queuePointSummary = buildQueuePointSummary(queuePoint, waitingCount);

    const ticketPayload = buildQueueTicketPayload({
      ticket,
      queuePointSummary,
      position: waitingCount,
    });

    const eventPayload = {
      reason: "joined",
      queuePoint: queuePointSummary,
      ticket: ticketPayload,
    };

    emitToAdmins("realtime:queue-updated", eventPayload);
    emitToEventRoom(eventId, "realtime:event-queue-updated", eventPayload);
    emitLiveEventUpdate({
      eventId,
      type: "queue-joined",
      title: `${queuePointSummary.pointName} joined`,
      message: `Queue activity increased at ${queuePointSummary.pointName}.`,
      payload: {
        queuePoint: queuePointSummary,
        position: waitingCount,
      },
    });

    await logPublicAudit({
      req,
      actorId: normalizedPassId,
      action: "queue.ticket.join",
      resourceType: "queue-ticket",
      resourceId: ticket._id,
      status: "success",
      details: {
        eventId,
        queuePointId,
        position: waitingCount,
      },
    });

    res.status(201).json({
      message: "Joined queue successfully",
      ticket: ticketPayload,
      queuePoint: queuePointSummary,
    });
  } catch (error) {
    next(error);
  }
};

const getQueueTicketStatus = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await QueueTicket.findById(ticketId)
      .populate("queuePoint")
      .populate("event", "title")
      .lean();

    if (!ticket) {
      res.status(404);
      throw new Error("Queue ticket not found");
    }

    const waitingCount = await QueueTicket.countDocuments({
      queuePoint: ticket.queuePoint._id,
      status: "waiting",
    });

    let position = 0;

    if (ticket.status === "waiting") {
      position = await QueueTicket.countDocuments({
        queuePoint: ticket.queuePoint._id,
        status: "waiting",
        joinedAt: { $lte: ticket.joinedAt },
      });
    }

    const queuePointSummary = buildQueuePointSummary(
      {
        ...ticket.queuePoint,
        event: ticket.event,
      },
      waitingCount
    );

    const ticketPayload = buildQueueTicketPayload({
      ticket,
      queuePointSummary,
      position,
    });

    res.json({
      ticket: ticketPayload,
      queuePoint: queuePointSummary,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQueueOverview,
  getQueueAnalytics,
  createQueuePoint,
  updateQueuePoint,
  serveNextQueueTicket,
  getEventQueues,
  joinQueue,
  getQueueTicketStatus,
};
