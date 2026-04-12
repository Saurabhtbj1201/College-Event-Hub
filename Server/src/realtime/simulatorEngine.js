const Event = require("../models/Event");
const QueuePoint = require("../models/QueuePoint");
const QueueTicket = require("../models/QueueTicket");
const { emitToAdmins, emitToEventRoom } = require("./socketServer");

const CROWD_LEVELS = ["low", "medium", "high"];
const QUEUE_STATUSES = ["free", "normal", "busy"];

let simulatorIntervalId = null;
let simulatorState = {
  running: false,
  intervalMs: 15000,
  startedAt: null,
  lastTickAt: null,
  tickCount: 0,
};

const pickOne = (items) => items[Math.floor(Math.random() * items.length)];

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

const simulateTick = async () => {
  const now = new Date();

  const activeEvents = await Event.find({ isActive: true })
    .select("title liveOperations")
    .lean();

  for (const event of activeEvents) {
    const nextCrowd = pickOne(CROWD_LEVELS);

    await Event.updateOne(
      { _id: event._id },
      {
        $set: {
          "liveOperations.crowdLevel": nextCrowd,
          "liveOperations.updatedAt": now,
          "liveOperations.note": `Simulated crowd update at ${now.toLocaleTimeString()}`,
        },
      }
    );

    const crowdPayload = {
      eventId: event._id.toString(),
      title: event.title,
      liveOperations: {
        crowdLevel: nextCrowd,
        entryGateStatus: event.liveOperations?.entryGateStatus || "open",
        note: `Simulated crowd update at ${now.toLocaleTimeString()}`,
        updatedAt: now,
      },
    };

    emitToAdmins("realtime:crowd-updated", crowdPayload);
    emitToEventRoom(event._id.toString(), "realtime:event-crowd-updated", crowdPayload);
  }

  const queuePoints = await QueuePoint.find({ isActive: true })
    .populate("event", "title")
    .lean();

  const queuePointIds = queuePoints.map((item) => item._id);
  const waitingCountMap = await getWaitingCountMap(queuePointIds);

  for (const queuePoint of queuePoints) {
    const waitingCount = waitingCountMap.get(queuePoint._id.toString()) || 0;

    const suggestedStatus =
      waitingCount > 12
        ? "busy"
        : waitingCount > 5
        ? "normal"
        : pickOne(QUEUE_STATUSES);

    const simulatedWait = Math.max(0, waitingCount * 3 + Math.floor(Math.random() * 4) - 1);

    await QueuePoint.updateOne(
      { _id: queuePoint._id },
      {
        $set: {
          status: suggestedStatus,
          manualWaitTimeMinutes: simulatedWait,
          updatedAt: now,
          note: `Simulated wait update at ${now.toLocaleTimeString()}`,
        },
      }
    );

    const queuePayload = {
      reason: "simulated",
      queuePoint: {
        queuePointId: queuePoint._id.toString(),
        eventId: queuePoint.event?._id
          ? queuePoint.event._id.toString()
          : queuePoint.event.toString(),
        eventTitle: queuePoint.event?.title,
        pointType: queuePoint.pointType,
        pointName: queuePoint.pointName,
        status: suggestedStatus,
        waitingCount,
        manualWaitTimeMinutes: simulatedWait,
        estimatedWaitMinutes: simulatedWait || waitingCount * 3,
        note: `Simulated wait update at ${now.toLocaleTimeString()}`,
        updatedAt: now,
      },
    };

    emitToAdmins("realtime:queue-updated", queuePayload);
    emitToEventRoom(queuePayload.queuePoint.eventId, "realtime:event-queue-updated", queuePayload);
  }

  simulatorState.lastTickAt = now.toISOString();
  simulatorState.tickCount += 1;
};

const getSimulatorStatus = () => ({
  running: simulatorState.running,
  intervalSeconds: Math.round(simulatorState.intervalMs / 1000),
  startedAt: simulatorState.startedAt,
  lastTickAt: simulatorState.lastTickAt,
  tickCount: simulatorState.tickCount,
});

const startSimulator = async (intervalSeconds = 15) => {
  if (simulatorIntervalId) {
    return getSimulatorStatus();
  }

  const clampedSeconds = Math.min(120, Math.max(3, Number(intervalSeconds) || 15));
  simulatorState = {
    running: true,
    intervalMs: clampedSeconds * 1000,
    startedAt: new Date().toISOString(),
    lastTickAt: null,
    tickCount: 0,
  };

  await simulateTick();

  simulatorIntervalId = setInterval(() => {
    simulateTick().catch((error) => {
      console.error("Simulation tick failed:", error.message);
    });
  }, simulatorState.intervalMs);

  return getSimulatorStatus();
};

const stopSimulator = () => {
  if (simulatorIntervalId) {
    clearInterval(simulatorIntervalId);
    simulatorIntervalId = null;
  }

  simulatorState.running = false;
  return getSimulatorStatus();
};

module.exports = {
  getSimulatorStatus,
  startSimulator,
  stopSimulator,
};
