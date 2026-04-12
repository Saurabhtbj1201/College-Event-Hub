const express = require("express");
const {
  createEvent,
  getAdminEvents,
  getRegistrations,
  getPendingAdmins,
  updateAdminApproval,
  getCommandSummary,
  scanPassForEntry,
  updateEventLiveOperations,
  sendEventBroadcast,
} = require("../controllers/adminController");
const {
  getQueueOverview,
  getQueueAnalytics,
  createQueuePoint,
  updateQueuePoint,
  serveNextQueueTicket,
} = require("../controllers/queueController");
const {
  getStatus: getSimulatorStatus,
  start: startSimulator,
  stop: stopSimulator,
} = require("../controllers/simulatorController");
const {
  getEventNavigation,
  upsertNavigation,
  resetNavigationToDefault,
} = require("../controllers/navigationController");
const {
  createFoodStall,
  getAdminFoodStalls,
  updateFoodStall,
  createFoodItem,
  updateFoodItem,
  getAdminFoodOrders,
  updateFoodOrderStatus,
} = require("../controllers/foodController");
const {
  protectAdmin,
  requireSuperAdmin,
  requirePermission,
} = require("../middleware/authMiddleware");
const {
  adminMutationLimiter,
  scannerLimiter,
} = require("../middleware/rateLimitMiddleware");
const { ADMIN_PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.use(protectAdmin);

router.post(
  "/events",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.EVENT_CREATE),
  createEvent
);
router.get("/events", requirePermission(ADMIN_PERMISSIONS.EVENT_READ), getAdminEvents);
router.get(
  "/registrations",
  requirePermission(ADMIN_PERMISSIONS.REGISTRATION_READ),
  getRegistrations
);
router.get(
  "/command/summary",
  requirePermission(ADMIN_PERMISSIONS.COMMAND_VIEW),
  getCommandSummary
);
router.post(
  "/scanner/check-in",
  scannerLimiter,
  requirePermission(ADMIN_PERMISSIONS.SCAN_TICKET),
  scanPassForEntry
);
router.patch(
  "/events/:eventId/live-ops",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.LIVE_OPS_UPDATE),
  updateEventLiveOperations
);
router.post(
  "/events/:eventId/broadcast",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.USER_BROADCAST),
  sendEventBroadcast
);
router.post(
  "/events/:eventId/food/stalls",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.FOOD_MANAGE),
  createFoodStall
);
router.get(
  "/events/:eventId/food/stalls",
  requirePermission(ADMIN_PERMISSIONS.FOOD_MANAGE),
  getAdminFoodStalls
);
router.patch(
  "/food/stalls/:stallId",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.FOOD_MANAGE),
  updateFoodStall
);
router.post(
  "/food/stalls/:stallId/items",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.FOOD_MANAGE),
  createFoodItem
);
router.patch(
  "/food/items/:itemId",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.FOOD_MANAGE),
  updateFoodItem
);
router.get(
  "/events/:eventId/food/orders",
  requirePermission(ADMIN_PERMISSIONS.FOOD_ORDER_MANAGE),
  getAdminFoodOrders
);
router.patch(
  "/food/orders/:orderId/status",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.FOOD_ORDER_MANAGE),
  updateFoodOrderStatus
);
router.get("/queues/overview", requirePermission(ADMIN_PERMISSIONS.QUEUE_VIEW), getQueueOverview);
router.get("/queues/analytics", requirePermission(ADMIN_PERMISSIONS.QUEUE_VIEW), getQueueAnalytics);
router.post(
  "/events/:eventId/queues",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.QUEUE_MANAGE),
  createQueuePoint
);
router.patch(
  "/queues/:queuePointId",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.QUEUE_MANAGE),
  updateQueuePoint
);
router.post(
  "/queues/:queuePointId/serve-next",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.QUEUE_MANAGE),
  serveNextQueueTicket
);
router.get(
  "/simulator/status",
  requirePermission(ADMIN_PERMISSIONS.SIMULATOR_CONTROL),
  getSimulatorStatus
);
router.post(
  "/simulator/start",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.SIMULATOR_CONTROL),
  startSimulator
);
router.post(
  "/simulator/stop",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.SIMULATOR_CONTROL),
  stopSimulator
);
router.get(
  "/events/:eventId/navigation",
  requirePermission(ADMIN_PERMISSIONS.NAVIGATION_MANAGE),
  getEventNavigation
);
router.put(
  "/events/:eventId/navigation",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.NAVIGATION_MANAGE),
  upsertNavigation
);
router.post(
  "/events/:eventId/navigation/reset",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.NAVIGATION_MANAGE),
  resetNavigationToDefault
);

router.get(
  "/admins/pending",
  requirePermission(ADMIN_PERMISSIONS.ADMIN_APPROVAL),
  requireSuperAdmin,
  getPendingAdmins
);
router.patch(
  "/admins/:adminId/approval",
  adminMutationLimiter,
  requirePermission(ADMIN_PERMISSIONS.ADMIN_APPROVAL),
  requireSuperAdmin,
  updateAdminApproval
);

module.exports = router;
