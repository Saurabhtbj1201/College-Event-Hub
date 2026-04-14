const Event = require("../models/Event");
const QueuePoint = require("../models/QueuePoint");
const QueueTicket = require("../models/QueueTicket");
const Registration = require("../models/Registration");
const { logAdminAudit, logPublicAudit } = require("../utils/auditLogger");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return value._id ? value._id.toString() : value.toString();
};

const getQueueWaitingCountMap = async (queuePointIds) => {
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

  const waitingMap = new Map();
  grouped.forEach((item) => {
    waitingMap.set(item._id.toString(), item.waitingCount);
  });

  return waitingMap;
};

const toLoadLevel = (score) => {
  if (score >= 0.7) {
    return "high";
  }

  if (score >= 0.4) {
    return "medium";
  }

  return "low";
};

const buildTimelineBuckets = (items, fieldName, now, options = {}) => {
  const bucketMinutes = options.bucketMinutes || 15;
  const bucketCount = options.bucketCount || 8;
  const bucketMs = bucketMinutes * 60 * 1000;
  const startMs = now.getTime() - bucketCount * bucketMs;

  const counts = Array.from({ length: bucketCount }, () => 0);

  items.forEach((item) => {
    const raw = item?.[fieldName];
    if (!raw) {
      return;
    }

    const timestamp = new Date(raw).getTime();
    if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp > now.getTime()) {
      return;
    }

    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor((timestamp - startMs) / bucketMs)
    );

    if (bucketIndex >= 0) {
      counts[bucketIndex] += 1;
    }
  });

  return counts.map((count, index) => {
    const bucketStartMs = startMs + index * bucketMs;
    const bucketEndMs = bucketStartMs + bucketMs;

    return {
      startAt: new Date(bucketStartMs).toISOString(),
      endAt: new Date(bucketEndMs).toISOString(),
      count,
    };
  });
};

const rankEntryGates = ({
  entryQueuePoints,
  waitingCountMap,
  crowdLevel,
  entryGateStatus,
}) => {
  const statusPenaltyMap = {
    free: 0,
    normal: 6,
    busy: 14,
  };

  const crowdPenaltyMap = {
    low: 0,
    medium: 6,
    high: 12,
  };

  const gateStatusPenaltyMap = {
    open: 0,
    busy: 7,
    closed: 22,
  };

  const ranked = entryQueuePoints
    .map((queuePoint) => {
      const waitingCount = waitingCountMap.get(queuePoint._id.toString()) || 0;
      const manualWait = Number(queuePoint.manualWaitTimeMinutes || 0);
      const estimatedWaitMinutes = manualWait > 0 ? manualWait : waitingCount * 3;
      const score =
        estimatedWaitMinutes +
        (statusPenaltyMap[queuePoint.status] || 0) +
        (crowdPenaltyMap[crowdLevel] || 0) +
        (gateStatusPenaltyMap[entryGateStatus] || 0);

      return {
        queuePointId: queuePoint._id.toString(),
        pointName: queuePoint.pointName,
        status: queuePoint.status,
        waitingCount,
        manualWaitTimeMinutes: manualWait,
        estimatedWaitMinutes,
        score: Number(score.toFixed(2)),
        rationale:
          manualWait > 0
            ? "Using manual wait override set by admin operations."
            : "Derived from live waiting count and point status.",
      };
    })
    .sort((left, right) => left.score - right.score || left.waitingCount - right.waitingCount);

  if (ranked.length === 0) {
    return {
      available: false,
      summary: "No entry queue points are configured yet.",
      bestGate: null,
      alternatives: [],
      rankedGates: [],
    };
  }

  const bestGate = ranked[0];
  const alternatives = ranked.slice(1, 3);

  return {
    available: true,
    summary: `Recommended gate is ${bestGate.pointName} based on live queue load.`,
    bestGate,
    alternatives,
    rankedGates: ranked,
  };
};

const buildRushPrediction = ({
  event,
  registrationsTotal,
  entryQueueCount,
  entryQueueWaiting,
  checkedInLast60m,
  entryJoinedLast60m,
  entryServedLast60m,
  minutesToStart,
}) => {
  const crowdSignalMap = {
    low: 0.25,
    medium: 0.55,
    high: 0.82,
  };

  const crowdSignal = crowdSignalMap[event.liveOperations?.crowdLevel] || 0.55;
  const queueSignal = clamp(entryQueueWaiting / Math.max(1, entryQueueCount * 20), 0, 1);
  const joinVelocitySignal = clamp(
    entryJoinedLast60m / Math.max(1, entryQueueCount * 18),
    0,
    1
  );
  const checkInVelocitySignal = clamp(
    checkedInLast60m / Math.max(1, registrationsTotal * 0.35),
    0,
    1
  );

  let timeSignal = 0.25;
  if (minutesToStart <= 150 && minutesToStart > 80) {
    timeSignal = 0.45;
  } else if (minutesToStart <= 80 && minutesToStart > 20) {
    timeSignal = 0.68;
  } else if (minutesToStart <= 20 && minutesToStart > -60) {
    timeSignal = 0.78;
  } else if (minutesToStart <= -60) {
    timeSignal = 0.5;
  }

  const currentScore = clamp(
    crowdSignal * 0.34 +
      queueSignal * 0.26 +
      joinVelocitySignal * 0.2 +
      checkInVelocitySignal * 0.08 +
      timeSignal * 0.12,
    0,
    1
  );

  const throughputBalance = entryJoinedLast60m - entryServedLast60m;
  const trendDelta = clamp(
    throughputBalance / Math.max(10, entryQueueCount * 10),
    -0.24,
    0.24
  );

  const next30Score = clamp(
    currentScore +
      trendDelta +
      (minutesToStart <= 40 && minutesToStart >= -30 ? 0.08 : 0),
    0,
    1
  );

  const next60Score = clamp(
    next30Score + trendDelta * 0.6 + (minutesToStart <= 90 && minutesToStart >= -30 ? 0.05 : 0),
    0,
    1
  );

  const nowLevel = toLoadLevel(currentScore);
  const next30Level = toLoadLevel(next30Score);
  const next60Level = toLoadLevel(next60Score);

  const drift = next60Score - currentScore;
  let trend = "steady";
  if (drift >= 0.1) {
    trend = "rising";
  } else if (drift <= -0.1) {
    trend = "falling";
  }

  const reasons = [
    `Entry waiting load: ${entryQueueWaiting} across ${entryQueueCount || 0} gate queue(s).`,
    `Last 60 minutes: ${entryJoinedLast60m} joins vs ${entryServedLast60m} served.`,
    `Live crowd signal is ${event.liveOperations?.crowdLevel || "medium"}.`,
  ];

  return {
    current: nowLevel,
    next30Minutes: next30Level,
    next60Minutes: next60Level,
    trend,
    confidence: queueSignal > 0.2 || joinVelocitySignal > 0.2 ? "medium" : "low",
    reasons,
    score: {
      current: Number(currentScore.toFixed(3)),
      next30Minutes: Number(next30Score.toFixed(3)),
      next60Minutes: Number(next60Score.toFixed(3)),
    },
  };
};

const buildArrivalWindow = ({
  eventDate,
  now,
  registrationsTotal,
  checkedInTotal,
  minutesToStart,
  entryQueueWaiting,
  entryQueueCount,
  rushPrediction,
  entryGateStatus,
}) => {
  const checkedInRatio = registrationsTotal > 0 ? checkedInTotal / registrationsTotal : 0;
  const queuePressure = clamp(entryQueueWaiting / Math.max(1, entryQueueCount * 16), 0, 1);

  let suggestedLeadMinutes = 30;

  if (queuePressure >= 0.75) {
    suggestedLeadMinutes += 25;
  } else if (queuePressure >= 0.5) {
    suggestedLeadMinutes += 15;
  } else if (queuePressure >= 0.25) {
    suggestedLeadMinutes += 8;
  }

  if (rushPrediction.next30Minutes === "high") {
    suggestedLeadMinutes += 15;
  } else if (rushPrediction.next30Minutes === "medium") {
    suggestedLeadMinutes += 8;
  }

  if (checkedInRatio >= 0.7) {
    suggestedLeadMinutes += 10;
  }

  if (entryGateStatus === "busy") {
    suggestedLeadMinutes += 8;
  }

  if (entryGateStatus === "closed") {
    suggestedLeadMinutes += 20;
  }

  if (minutesToStart <= 45 && minutesToStart >= -20) {
    suggestedLeadMinutes += 10;
  }

  suggestedLeadMinutes = clamp(suggestedLeadMinutes, 20, 95);

  const windowStart = new Date(eventDate.getTime() - (suggestedLeadMinutes + 15) * 60000);
  const windowEnd = new Date(
    eventDate.getTime() - Math.max(10, suggestedLeadMinutes - 10) * 60000
  );

  let state = "upcoming-window";
  let summary = "Arrive within the recommended window to reduce gate wait time.";

  if (now >= windowStart && now <= windowEnd) {
    state = "ideal-now";
    summary = "This is currently the best arrival window based on live telemetry.";
  } else if (now > windowEnd) {
    state = "arrive-now";
    summary = "Arrival window has passed. Enter now and use the least crowded gate suggestion.";
  }

  return {
    summary,
    state,
    minutesToStart,
    suggestedLeadMinutes,
    window: {
      startAt: windowStart.toISOString(),
      endAt: windowEnd.toISOString(),
    },
  };
};

const collectIntelligenceInputs = async (eventId, options = {}) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const eventFilter = { _id: eventId };
  if (options.requireActive) {
    eventFilter.isActive = true;
  }

  const event = await Event.findOne(eventFilter)
    .select("title date venue isActive liveOperations")
    .lean();

  if (!event) {
    return null;
  }

  const queuePoints = await QueuePoint.find({ event: eventId, isActive: true })
    .select("pointType pointName status manualWaitTimeMinutes note updatedAt")
    .lean();

  const queuePointIds = queuePoints.map((item) => item._id);
  const waitingCountMap = await getQueueWaitingCountMap(queuePointIds);

  const entryQueuePoints = queuePoints.filter((item) => item.pointType === "entry");
  const entryQueueIds = entryQueuePoints.map((item) => item._id);

  const [
    registrationsTotal,
    checkedInTotal,
    checkedInLast60m,
    registrationsLast60m,
    entryJoinedLast60m,
    entryServedLast60m,
    checkInSamples,
    queueJoinSamples,
  ] = await Promise.all([
    Registration.countDocuments({ event: eventId }),
    Registration.countDocuments({ event: eventId, ticketStatus: "checked-in" }),
    Registration.countDocuments({
      event: eventId,
      ticketStatus: "checked-in",
      checkedInAt: { $gte: oneHourAgo },
    }),
    Registration.countDocuments({ event: eventId, createdAt: { $gte: oneHourAgo } }),
    entryQueueIds.length
      ? QueueTicket.countDocuments({
          event: eventId,
          queuePoint: { $in: entryQueueIds },
          joinedAt: { $gte: oneHourAgo },
        })
      : Promise.resolve(0),
    entryQueueIds.length
      ? QueueTicket.countDocuments({
          event: eventId,
          queuePoint: { $in: entryQueueIds },
          status: "served",
          servedAt: { $gte: oneHourAgo },
        })
      : Promise.resolve(0),
    options.includeTimeline
      ? Registration.find({
          event: eventId,
          ticketStatus: "checked-in",
          checkedInAt: { $gte: twoHoursAgo },
        })
          .select("checkedInAt")
          .lean()
      : Promise.resolve([]),
    options.includeTimeline
      ? QueueTicket.find({
          event: eventId,
          queuePoint: { $in: entryQueueIds },
          joinedAt: { $gte: twoHoursAgo },
        })
          .select("joinedAt")
          .lean()
      : Promise.resolve([]),
  ]);

  const queueWaitingTotal = queuePoints.reduce(
    (sum, queuePoint) => sum + (waitingCountMap.get(queuePoint._id.toString()) || 0),
    0
  );

  const entryQueueWaiting = entryQueuePoints.reduce(
    (sum, queuePoint) => sum + (waitingCountMap.get(queuePoint._id.toString()) || 0),
    0
  );

  const eventDate = new Date(event.date);
  const minutesToStart = Math.round((eventDate.getTime() - now.getTime()) / 60000);

  const gateRecommendation = rankEntryGates({
    entryQueuePoints,
    waitingCountMap,
    crowdLevel: event.liveOperations?.crowdLevel || "medium",
    entryGateStatus: event.liveOperations?.entryGateStatus || "open",
  });

  const rushPrediction = buildRushPrediction({
    event,
    registrationsTotal,
    entryQueueCount: entryQueuePoints.length,
    entryQueueWaiting,
    checkedInLast60m,
    entryJoinedLast60m,
    entryServedLast60m,
    minutesToStart,
  });

  const arrivalWindow = buildArrivalWindow({
    eventDate,
    now,
    registrationsTotal,
    checkedInTotal,
    minutesToStart,
    entryQueueWaiting,
    entryQueueCount: entryQueuePoints.length,
    rushPrediction,
    entryGateStatus: event.liveOperations?.entryGateStatus || "open",
  });

  return {
    now,
    event,
    registrationsTotal,
    checkedInTotal,
    checkedInLast60m,
    registrationsLast60m,
    entryJoinedLast60m,
    entryServedLast60m,
    queueWaitingTotal,
    entryQueueWaiting,
    entryQueueCount: entryQueuePoints.length,
    gateRecommendation,
    rushPrediction,
    arrivalWindow,
    checkInTimeline: options.includeTimeline
      ? buildTimelineBuckets(checkInSamples, "checkedInAt", now)
      : [],
    queueJoinTimeline: options.includeTimeline
      ? buildTimelineBuckets(queueJoinSamples, "joinedAt", now)
      : [],
  };
};

const getPublicIntelligenceRecommendations = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const intelligence = await collectIntelligenceInputs(eventId, {
      requireActive: true,
      includeTimeline: false,
    });

    if (!intelligence) {
      res.status(404);
      throw new Error("Event not found");
    }

    await logPublicAudit({
      req,
      action: "intelligence.recommendations.view",
      resourceType: "event",
      resourceId: eventId,
      status: "success",
      details: {
        queueWaitingTotal: intelligence.queueWaitingTotal,
        entryQueueWaiting: intelligence.entryQueueWaiting,
      },
    });

    res.json({
      generatedAt: intelligence.now.toISOString(),
      event: {
        id: eventId,
        title: intelligence.event.title,
        date: intelligence.event.date,
        venue: intelligence.event.venue,
      },
      telemetrySnapshot: {
        registrationsTotal: intelligence.registrationsTotal,
        checkedInTotal: intelligence.checkedInTotal,
        checkedInRatio:
          intelligence.registrationsTotal > 0
            ? Number((intelligence.checkedInTotal / intelligence.registrationsTotal).toFixed(3))
            : 0,
        queueWaitingTotal: intelligence.queueWaitingTotal,
        entryQueueWaiting: intelligence.entryQueueWaiting,
        entryQueueCount: intelligence.entryQueueCount,
        crowdLevel: intelligence.event.liveOperations?.crowdLevel || "medium",
        entryGateStatus: intelligence.event.liveOperations?.entryGateStatus || "open",
      },
      recommendations: {
        gate: intelligence.gateRecommendation,
        arrivalWindow: intelligence.arrivalWindow,
        rushPrediction: intelligence.rushPrediction,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAdminIntelligenceInsights = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const intelligence = await collectIntelligenceInputs(eventId, {
      requireActive: false,
      includeTimeline: true,
    });

    if (!intelligence) {
      res.status(404);
      throw new Error("Event not found");
    }

    await logAdminAudit({
      req,
      action: "intelligence.insights.view",
      resourceType: "event",
      resourceId: eventId,
      status: "success",
      details: {
        queueWaitingTotal: intelligence.queueWaitingTotal,
        entryQueueWaiting: intelligence.entryQueueWaiting,
        checkedInTotal: intelligence.checkedInTotal,
      },
    });

    res.json({
      generatedAt: intelligence.now.toISOString(),
      event: {
        id: eventId,
        title: intelligence.event.title,
        date: intelligence.event.date,
        venue: intelligence.event.venue,
        isActive: Boolean(intelligence.event.isActive),
      },
      telemetry: {
        registrationsTotal: intelligence.registrationsTotal,
        registrationsLast60m: intelligence.registrationsLast60m,
        checkedInTotal: intelligence.checkedInTotal,
        checkedInLast60m: intelligence.checkedInLast60m,
        queueWaitingTotal: intelligence.queueWaitingTotal,
        entryQueueWaiting: intelligence.entryQueueWaiting,
        entryQueueCount: intelligence.entryQueueCount,
        entryJoinedLast60m: intelligence.entryJoinedLast60m,
        entryServedLast60m: intelligence.entryServedLast60m,
        minutesToStart: intelligence.arrivalWindow.minutesToStart,
        crowdLevel: intelligence.event.liveOperations?.crowdLevel || "medium",
        entryGateStatus: intelligence.event.liveOperations?.entryGateStatus || "open",
      },
      insights: {
        gate: intelligence.gateRecommendation,
        arrivalWindow: intelligence.arrivalWindow,
        rushPrediction: intelligence.rushPrediction,
      },
      historicalSnapshots: {
        checkInsPer15Minutes: intelligence.checkInTimeline,
        queueJoinsPer15Minutes: intelligence.queueJoinTimeline,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicIntelligenceRecommendations,
  getAdminIntelligenceInsights,
};
