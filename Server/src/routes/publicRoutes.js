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
  triggerSOS,
  getNearestExit,
  createSocialGroup,
  joinSocialGroup,
  updateSocialGroupLocation,
  getSocialGroup,
} = require("../controllers/emergencySocialController");
const {
  getPublicIntelligenceRecommendations,
} = require("../controllers/intelligenceController");
const {
  publicRegistrationLimiter,
  publicQueueJoinLimiter,
  publicFoodOrderLimiter,
  publicSosLimiter,
  publicSocialLimiter,
} = require("../middleware/rateLimitMiddleware");
const { protectUser } = require("../middleware/userAuthMiddleware");

const router = express.Router();

router.get("/events", getPublicEvents);
router.get("/events/:id", getPublicEventById);
router.post("/events/:eventId/register", protectUser, publicRegistrationLimiter, registerForEvent);
router.get("/events/:eventId/queues", protectUser, getEventQueues);
router.post(
  "/events/:eventId/queues/:queuePointId/join",
  protectUser,
  publicQueueJoinLimiter,
  joinQueue
);
router.get("/events/:eventId/navigation", protectUser, getEventNavigation);
router.get("/events/:eventId/navigation/route", protectUser, getRouteHint);
router.get(
  "/events/:eventId/intelligence/recommendations",
  protectUser,
  getPublicIntelligenceRecommendations
);
router.get("/events/:eventId/emergency/nearest-exit", protectUser, getNearestExit);
router.post("/events/:eventId/emergency/sos", protectUser, publicSosLimiter, triggerSOS);
router.get("/events/:eventId/food/catalog", protectUser, getPublicFoodCatalog);
router.post(
  "/events/:eventId/food/orders",
  protectUser,
  publicFoodOrderLimiter,
  placeFoodOrder
);
router.post("/events/:eventId/social/groups", protectUser, publicSocialLimiter, createSocialGroup);
router.post(
  "/events/:eventId/social/groups/:groupCode/join",
  protectUser,
  publicSocialLimiter,
  joinSocialGroup
);
router.patch(
  "/events/:eventId/social/groups/:groupCode/location",
  protectUser,
  publicSocialLimiter,
  updateSocialGroupLocation
);
router.get("/events/:eventId/social/groups/:groupCode", protectUser, getSocialGroup);
router.get("/food/orders/:orderId", protectUser, getFoodOrderStatus);
router.get("/queues/tickets/:ticketId", protectUser, getQueueTicketStatus);
router.get("/passes/:passId", protectUser, getPassById);

module.exports = router;
