const express = require("express");
const {
  getPublicEvents,
  getPublicEventById,
  registerForEvent,
  getPassById,
} = require("../controllers/publicController");
const {
  getEventQueues,
  joinQueue,
  getQueueTicketStatus,
} = require("../controllers/queueController");
const {
  getEventNavigation,
  getRouteHint,
} = require("../controllers/navigationController");
const {
  getPublicFoodCatalog,
  placeFoodOrder,
  getFoodOrderStatus,
} = require("../controllers/foodController");
const {
  publicRegistrationLimiter,
  publicQueueJoinLimiter,
  publicFoodOrderLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.get("/events", getPublicEvents);
router.get("/events/:id", getPublicEventById);
router.post("/events/:eventId/register", publicRegistrationLimiter, registerForEvent);
router.get("/events/:eventId/queues", getEventQueues);
router.post(
  "/events/:eventId/queues/:queuePointId/join",
  publicQueueJoinLimiter,
  joinQueue
);
router.get("/events/:eventId/navigation", getEventNavigation);
router.get("/events/:eventId/navigation/route", getRouteHint);
router.get("/events/:eventId/food/catalog", getPublicFoodCatalog);
router.post(
  "/events/:eventId/food/orders",
  publicFoodOrderLimiter,
  placeFoodOrder
);
router.get("/food/orders/:orderId", getFoodOrderStatus);
router.get("/queues/tickets/:ticketId", getQueueTicketStatus);
router.get("/passes/:passId", getPassById);

module.exports = router;
