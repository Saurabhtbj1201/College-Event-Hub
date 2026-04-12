const {
  getSimulatorStatus,
  startSimulator,
  stopSimulator,
} = require("../realtime/simulatorEngine");
const { logAdminAudit } = require("../utils/auditLogger");

const getStatus = async (req, res, next) => {
  try {
    res.json({ simulator: getSimulatorStatus() });
  } catch (error) {
    next(error);
  }
};

const start = async (req, res, next) => {
  try {
    const { intervalSeconds } = req.body;
    const simulator = await startSimulator(intervalSeconds);

    await logAdminAudit({
      req,
      action: "simulator.start",
      resourceType: "simulator",
      status: "success",
      details: {
        intervalSeconds: simulator.intervalSeconds,
        tickCount: simulator.tickCount,
      },
    });

    res.json({
      message: simulator.tickCount > 0 ? "Simulator started" : "Simulator running",
      simulator,
    });
  } catch (error) {
    next(error);
  }
};

const stop = async (req, res, next) => {
  try {
    const simulator = stopSimulator();

    await logAdminAudit({
      req,
      action: "simulator.stop",
      resourceType: "simulator",
      status: "success",
      details: {
        tickCount: simulator.tickCount,
      },
    });

    res.json({
      message: "Simulator stopped",
      simulator,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  start,
  stop,
};
