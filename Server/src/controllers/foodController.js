const mongoose = require("mongoose");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const User = require("../models/User");
const FoodStall = require("../models/FoodStall");
const FoodItem = require("../models/FoodItem");
const FoodOrder = require("../models/FoodOrder");
const generateFoodOrderNumber = require("../utils/generateFoodOrderNumber");
const { emitToAdmins, emitToEventRoom } = require("../realtime/socketServer");
const { logAdminAudit, logPublicAudit } = require("../utils/auditLogger");
const {
  createUserNotification,
  emitLiveEventUpdate,
} = require("../utils/userNotificationService");

const STALL_STATUSES = ["open", "busy", "closed", "paused"];
const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "picked-up", "cancelled"];

const ORDER_TRANSITIONS = {
  placed: ["accepted", "preparing", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked-up", "cancelled"],
  "picked-up": [],
  cancelled: [],
};

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return value._id ? value._id.toString() : value.toString();
};

const normalizePassId = (value) => String(value || "").trim().toUpperCase();

const normalizeStallCode = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  const normalized = raw.replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 30);
};

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCurrencyAmount = (value) => Number(toSafeNumber(value, 0).toFixed(2));

const buildFoodItemPayload = (item) => ({
  itemId: toIdString(item._id || item.item || item.itemId),
  eventId: toIdString(item.event),
  stallId: toIdString(item.stall),
  name: item.name,
  description: item.description || "",
  category: item.category || "general",
  price: item.price,
  currency: item.currency || "INR",
  isVeg: Boolean(item.isVeg),
  prepMinutes: toSafeNumber(item.prepMinutes, 0),
  imageUrl: item.imageUrl || "",
  sortOrder: toSafeNumber(item.sortOrder, 0),
  isAvailable: Boolean(item.isAvailable),
  isActive: Boolean(item.isActive),
  updatedAt: item.updatedAt,
});

const buildFoodStallPayload = (stall, items = []) => ({
  stallId: toIdString(stall._id || stall.stallId),
  eventId: toIdString(stall.event),
  code: stall.code,
  name: stall.name,
  description: stall.description || "",
  zoneCode: stall.zoneCode || "",
  locationHint: stall.locationHint || "",
  operatingStatus: stall.operatingStatus,
  estimatedPrepMinutes: toSafeNumber(stall.estimatedPrepMinutes, 0),
  sortOrder: toSafeNumber(stall.sortOrder, 0),
  isActive: Boolean(stall.isActive),
  menuSize: Array.isArray(items) ? items.length : 0,
  items: Array.isArray(items) ? items.map(buildFoodItemPayload) : [],
  updatedAt: stall.updatedAt,
});

const buildFoodOrderPayload = (order, { includeCustomer = false } = {}) => ({
  orderId: toIdString(order._id || order.orderId),
  orderNumber: order.orderNumber,
  eventId: toIdString(order.event),
  stall: {
    stallId: toIdString(order.stall?._id || order.stall),
    name: order.stall?.name || "Food Stall",
  },
  registrationId: toIdString(order.registration),
  passId: order.passId,
  customer: includeCustomer
    ? {
        name: order.customerSnapshot?.name || "",
        email: order.customerSnapshot?.email || "",
        college: order.customerSnapshot?.college || "",
      }
    : undefined,
  items: Array.isArray(order.items)
    ? order.items.map((item) => ({
        itemId: toIdString(item.item),
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }))
    : [],
  subtotal: order.subtotal,
  serviceFee: order.serviceFee,
  totalAmount: order.totalAmount,
  currency: order.currency || "INR",
  notes: order.notes || "",
  status: order.status,
  statusTimeline: Array.isArray(order.statusTimeline)
    ? order.statusTimeline.map((entry) => ({
        status: entry.status,
        at: entry.at,
        byAdmin: toIdString(entry.byAdmin),
        note: entry.note || "",
      }))
    : [],
  estimatedPrepMinutes: toSafeNumber(order.estimatedPrepMinutes, 0),
  estimatedReadyAt: order.estimatedReadyAt,
  readyAt: order.readyAt,
  pickedUpAt: order.pickedUpAt,
  cancelledAt: order.cancelledAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const getStatusTitle = (status) => {
  if (status === "accepted") {
    return "Food order accepted";
  }
  if (status === "preparing") {
    return "Food order in preparation";
  }
  if (status === "ready") {
    return "Food order ready";
  }
  if (status === "picked-up") {
    return "Food order picked up";
  }
  if (status === "cancelled") {
    return "Food order cancelled";
  }

  return "Food order placed";
};

const getStatusMessage = (status, orderNumber, stallName) => {
  if (status === "accepted") {
    return `Order ${orderNumber} has been accepted by ${stallName}.`;
  }
  if (status === "preparing") {
    return `Order ${orderNumber} is now being prepared at ${stallName}.`;
  }
  if (status === "ready") {
    return `Order ${orderNumber} is ready for pickup at ${stallName}.`;
  }
  if (status === "picked-up") {
    return `Order ${orderNumber} has been marked as picked up.`;
  }
  if (status === "cancelled") {
    return `Order ${orderNumber} was cancelled by food operations.`;
  }

  return `Order ${orderNumber} has been placed at ${stallName}.`;
};

const isTransitionAllowed = (fromStatus, toStatus) => {
  if (fromStatus === toStatus) {
    return true;
  }

  const allowed = ORDER_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

const generateUniqueOrderNumber = async () => {
  let orderNumber = "";
  let attempts = 0;

  while (!orderNumber && attempts < 10) {
    const candidate = generateFoodOrderNumber();
    const exists = await FoodOrder.exists({ orderNumber: candidate });
    if (!exists) {
      orderNumber = candidate;
    }
    attempts += 1;
  }

  return orderNumber;
};

const getEventForFoodOps = async (eventId, isPublic = false) => {
  const filter = { _id: eventId };

  if (isPublic) {
    filter.isActive = true;
  }

  return Event.findOne(filter).select("title date venue isActive").lean();
};

const createFoodStall = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const {
      code,
      name,
      description = "",
      zoneCode = "",
      locationHint = "",
      operatingStatus = "open",
      estimatedPrepMinutes = 10,
      sortOrder = 0,
    } = req.body;

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      res.status(400);
      throw new Error("name is required");
    }

    if (!STALL_STATUSES.includes(String(operatingStatus || "").trim().toLowerCase())) {
      res.status(400);
      throw new Error("Invalid operatingStatus. Use open, busy, closed or paused");
    }

    const normalizedCode = normalizeStallCode(code || trimmedName);
    if (!normalizedCode) {
      res.status(400);
      throw new Error("Unable to derive a valid stall code");
    }

    const event = await getEventForFoodOps(eventId, false);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const stall = await FoodStall.create({
      event: eventId,
      code: normalizedCode,
      name: trimmedName,
      description: String(description || "").trim(),
      zoneCode: String(zoneCode || "").trim().toUpperCase(),
      locationHint: String(locationHint || "").trim(),
      operatingStatus: String(operatingStatus || "open").trim().toLowerCase(),
      estimatedPrepMinutes: Math.max(0, toSafeNumber(estimatedPrepMinutes, 10)),
      sortOrder: toSafeNumber(sortOrder, 0),
      managedBy: req.admin._id,
    });

    const payload = buildFoodStallPayload(stall.toObject(), []);

    emitToAdmins("realtime:food-stall-updated", {
      reason: "created",
      eventId,
      eventTitle: event.title,
      stall: payload,
    });

    emitToEventRoom(eventId, "realtime:event-food-catalog-updated", {
      reason: "stall-created",
      eventId,
      stall: payload,
    });

    await logAdminAudit({
      req,
      action: "food.stall.create",
      resourceType: "food-stall",
      resourceId: stall._id,
      status: "success",
      details: {
        eventId,
        code: stall.code,
        name: stall.name,
      },
    });

    res.status(201).json({
      message: "Food stall created",
      stall: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error("Food stall code already exists for this event"));
    }

    return next(error);
  }
};

const getAdminFoodStalls = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await getEventForFoodOps(eventId, false);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const stalls = await FoodStall.find({ event: eventId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const stallIds = stalls.map((stall) => stall._id);

    const items = stallIds.length
      ? await FoodItem.find({
          event: eventId,
          stall: { $in: stallIds },
        })
          .sort({ sortOrder: 1, name: 1 })
          .lean()
      : [];

    const itemsByStall = new Map();
    items.forEach((item) => {
      const key = item.stall.toString();
      const list = itemsByStall.get(key) || [];
      list.push(item);
      itemsByStall.set(key, list);
    });

    const payload = stalls.map((stall) =>
      buildFoodStallPayload(stall, itemsByStall.get(stall._id.toString()) || [])
    );

    res.json({
      event: {
        id: eventId,
        title: event.title,
        date: event.date,
        venue: event.venue,
        isActive: event.isActive,
      },
      stalls: payload,
    });
  } catch (error) {
    next(error);
  }
};

const updateFoodStall = async (req, res, next) => {
  try {
    const { stallId } = req.params;
    const {
      code,
      name,
      description,
      zoneCode,
      locationHint,
      operatingStatus,
      estimatedPrepMinutes,
      sortOrder,
      isActive,
    } = req.body;

    const stall = await FoodStall.findById(stallId);
    if (!stall) {
      res.status(404);
      throw new Error("Food stall not found");
    }

    if (typeof code === "string") {
      const normalized = normalizeStallCode(code);
      if (!normalized) {
        res.status(400);
        throw new Error("Invalid stall code");
      }
      stall.code = normalized;
    }

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        res.status(400);
        throw new Error("name cannot be empty");
      }
      stall.name = trimmedName;
    }

    if (typeof description === "string") {
      stall.description = description.trim();
    }

    if (typeof zoneCode === "string") {
      stall.zoneCode = zoneCode.trim().toUpperCase();
    }

    if (typeof locationHint === "string") {
      stall.locationHint = locationHint.trim();
    }

    if (typeof operatingStatus === "string") {
      const normalizedStatus = operatingStatus.trim().toLowerCase();
      if (!STALL_STATUSES.includes(normalizedStatus)) {
        res.status(400);
        throw new Error("Invalid operatingStatus. Use open, busy, closed or paused");
      }
      stall.operatingStatus = normalizedStatus;
    }

    if (typeof estimatedPrepMinutes !== "undefined") {
      const minutes = toSafeNumber(estimatedPrepMinutes, -1);
      if (minutes < 0) {
        res.status(400);
        throw new Error("estimatedPrepMinutes must be 0 or greater");
      }
      stall.estimatedPrepMinutes = minutes;
    }

    if (typeof sortOrder !== "undefined") {
      stall.sortOrder = toSafeNumber(sortOrder, 0);
    }

    if (typeof isActive === "boolean") {
      stall.isActive = isActive;
    }

    stall.managedBy = req.admin._id;
    await stall.save();

    const items = await FoodItem.find({
      stall: stall._id,
      event: stall.event,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const payload = buildFoodStallPayload(stall.toObject(), items);
    const eventId = toIdString(stall.event);

    emitToAdmins("realtime:food-stall-updated", {
      reason: "updated",
      eventId,
      stall: payload,
    });

    emitToEventRoom(eventId, "realtime:event-food-catalog-updated", {
      reason: "stall-updated",
      eventId,
      stall: payload,
    });

    await logAdminAudit({
      req,
      action: "food.stall.update",
      resourceType: "food-stall",
      resourceId: stall._id,
      status: "success",
      details: {
        eventId,
        code: stall.code,
        name: stall.name,
      },
    });

    res.json({
      message: "Food stall updated",
      stall: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error("Food stall code already exists for this event"));
    }

    return next(error);
  }
};

const createFoodItem = async (req, res, next) => {
  try {
    const { stallId } = req.params;
    const {
      name,
      description = "",
      category = "general",
      price,
      currency = "INR",
      isVeg = false,
      prepMinutes = 8,
      imageUrl = "",
      sortOrder = 0,
      isAvailable = true,
      isActive = true,
    } = req.body;

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      res.status(400);
      throw new Error("name is required");
    }

    const parsedPrice = toSafeNumber(price, -1);
    if (parsedPrice <= 0) {
      res.status(400);
      throw new Error("price must be greater than 0");
    }

    const parsedPrepMinutes = toSafeNumber(prepMinutes, -1);
    if (parsedPrepMinutes < 0) {
      res.status(400);
      throw new Error("prepMinutes must be 0 or greater");
    }

    const stall = await FoodStall.findById(stallId).lean();
    if (!stall) {
      res.status(404);
      throw new Error("Food stall not found");
    }

    const item = await FoodItem.create({
      event: stall.event,
      stall: stall._id,
      name: trimmedName,
      description: String(description || "").trim(),
      category: String(category || "general").trim() || "general",
      price: toCurrencyAmount(parsedPrice),
      currency: String(currency || "INR").trim().toUpperCase() || "INR",
      isVeg: Boolean(isVeg),
      prepMinutes: parsedPrepMinutes,
      imageUrl: String(imageUrl || "").trim(),
      sortOrder: toSafeNumber(sortOrder, 0),
      isAvailable: Boolean(isAvailable),
      isActive: Boolean(isActive),
      updatedBy: req.admin._id,
    });

    const payload = buildFoodItemPayload(item.toObject());
    const eventId = toIdString(stall.event);

    emitToAdmins("realtime:food-item-updated", {
      reason: "created",
      eventId,
      stallId: toIdString(stall._id),
      item: payload,
    });

    emitToEventRoom(eventId, "realtime:event-food-catalog-updated", {
      reason: "item-created",
      eventId,
      stallId: toIdString(stall._id),
      item: payload,
    });

    await logAdminAudit({
      req,
      action: "food.item.create",
      resourceType: "food-item",
      resourceId: item._id,
      status: "success",
      details: {
        eventId,
        stallId: stall._id,
        name: item.name,
      },
    });

    res.status(201).json({
      message: "Food item created",
      item: payload,
    });
  } catch (error) {
    next(error);
  }
};

const updateFoodItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const {
      name,
      description,
      category,
      price,
      currency,
      isVeg,
      prepMinutes,
      imageUrl,
      sortOrder,
      isAvailable,
      isActive,
    } = req.body;

    const item = await FoodItem.findById(itemId);
    if (!item) {
      res.status(404);
      throw new Error("Food item not found");
    }

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        res.status(400);
        throw new Error("name cannot be empty");
      }
      item.name = trimmedName;
    }

    if (typeof description === "string") {
      item.description = description.trim();
    }

    if (typeof category === "string") {
      item.category = category.trim() || "general";
    }

    if (typeof price !== "undefined") {
      const parsedPrice = toSafeNumber(price, -1);
      if (parsedPrice <= 0) {
        res.status(400);
        throw new Error("price must be greater than 0");
      }
      item.price = toCurrencyAmount(parsedPrice);
    }

    if (typeof currency === "string") {
      item.currency = currency.trim().toUpperCase() || "INR";
    }

    if (typeof isVeg === "boolean") {
      item.isVeg = isVeg;
    }

    if (typeof prepMinutes !== "undefined") {
      const parsedPrepMinutes = toSafeNumber(prepMinutes, -1);
      if (parsedPrepMinutes < 0) {
        res.status(400);
        throw new Error("prepMinutes must be 0 or greater");
      }
      item.prepMinutes = parsedPrepMinutes;
    }

    if (typeof imageUrl === "string") {
      item.imageUrl = imageUrl.trim();
    }

    if (typeof sortOrder !== "undefined") {
      item.sortOrder = toSafeNumber(sortOrder, 0);
    }

    if (typeof isAvailable === "boolean") {
      item.isAvailable = isAvailable;
    }

    if (typeof isActive === "boolean") {
      item.isActive = isActive;
    }

    item.updatedBy = req.admin._id;
    await item.save();

    const payload = buildFoodItemPayload(item.toObject());
    const eventId = toIdString(item.event);

    emitToAdmins("realtime:food-item-updated", {
      reason: "updated",
      eventId,
      stallId: toIdString(item.stall),
      item: payload,
    });

    emitToEventRoom(eventId, "realtime:event-food-catalog-updated", {
      reason: "item-updated",
      eventId,
      stallId: toIdString(item.stall),
      item: payload,
    });

    await logAdminAudit({
      req,
      action: "food.item.update",
      resourceType: "food-item",
      resourceId: item._id,
      status: "success",
      details: {
        eventId,
        stallId: item.stall,
        name: item.name,
      },
    });

    res.json({
      message: "Food item updated",
      item: payload,
    });
  } catch (error) {
    next(error);
  }
};

const getPublicFoodCatalog = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await getEventForFoodOps(eventId, true);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const stalls = await FoodStall.find({
      event: eventId,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const stallIds = stalls.map((stall) => stall._id);

    const items = stallIds.length
      ? await FoodItem.find({
          event: eventId,
          stall: { $in: stallIds },
          isActive: true,
          isAvailable: true,
        })
          .sort({ sortOrder: 1, name: 1 })
          .lean()
      : [];

    const itemsByStall = new Map();
    items.forEach((item) => {
      const key = item.stall.toString();
      const list = itemsByStall.get(key) || [];
      list.push(item);
      itemsByStall.set(key, list);
    });

    const payload = stalls.map((stall) =>
      buildFoodStallPayload(stall, itemsByStall.get(stall._id.toString()) || [])
    );

    res.json({
      event: {
        id: eventId,
        title: event.title,
        date: event.date,
        venue: event.venue,
      },
      stalls: payload,
    });
  } catch (error) {
    next(error);
  }
};

const placeFoodOrder = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { passId, stallId, items, notes = "" } = req.body;

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to place food order");
    }

    const normalizedPassId = normalizePassId(passId);
    if (!normalizedPassId || !stallId || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("passId, stallId, and non-empty items array are required");
    }

    if (!isObjectId(stallId)) {
      res.status(400);
      throw new Error("Invalid stallId");
    }

    const event = await getEventForFoodOps(eventId, true);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const registration = await Registration.findOne({
      event: eventId,
      passId: normalizedPassId,
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).lean();

    if (!registration) {
      res.status(404);
      throw new Error("This pass is not linked to your user account for the event");
    }

    const stall = await FoodStall.findOne({
      _id: stallId,
      event: eventId,
      isActive: true,
    }).lean();

    if (!stall) {
      res.status(404);
      throw new Error("Food stall not found for this event");
    }

    if (["closed", "paused"].includes(stall.operatingStatus)) {
      res.status(409);
      throw new Error("Food stall is not accepting orders right now");
    }

    const quantityByItemId = new Map();

    items.forEach((entry) => {
      const itemId = String(entry?.itemId || "").trim();
      const quantity = Math.floor(toSafeNumber(entry?.quantity, 0));

      if (!isObjectId(itemId) || quantity <= 0 || quantity > 20) {
        return;
      }

      const existing = quantityByItemId.get(itemId) || 0;
      quantityByItemId.set(itemId, existing + quantity);
    });

    const itemIds = Array.from(quantityByItemId.keys());

    if (itemIds.length === 0) {
      res.status(400);
      throw new Error("At least one valid order item is required");
    }

    const catalogItems = await FoodItem.find({
      _id: { $in: itemIds },
      event: eventId,
      stall: stall._id,
      isActive: true,
      isAvailable: true,
    }).lean();

    if (catalogItems.length !== itemIds.length) {
      res.status(400);
      throw new Error("Some selected items are unavailable");
    }

    let subtotal = 0;
    let weightedPrep = 0;
    let totalQuantity = 0;

    const lineItems = catalogItems.map((catalogItem) => {
      const itemId = catalogItem._id.toString();
      const quantity = quantityByItemId.get(itemId) || 0;
      const unitPrice = toCurrencyAmount(catalogItem.price);
      const lineTotal = toCurrencyAmount(unitPrice * quantity);

      subtotal += lineTotal;
      weightedPrep += toSafeNumber(catalogItem.prepMinutes, 0) * quantity;
      totalQuantity += quantity;

      return {
        item: catalogItem._id,
        name: catalogItem.name,
        unitPrice,
        quantity,
        lineTotal,
      };
    });

    const estimatedPrepMinutes = Math.max(
      toSafeNumber(stall.estimatedPrepMinutes, 0),
      Math.ceil(weightedPrep / Math.max(totalQuantity, 1))
    );

    const orderNumber = await generateUniqueOrderNumber();
    if (!orderNumber) {
      res.status(500);
      throw new Error("Unable to create order number. Please try again");
    }

    const createdAt = new Date();
    const estimatedReadyAt =
      estimatedPrepMinutes > 0
        ? new Date(createdAt.getTime() + estimatedPrepMinutes * 60 * 1000)
        : null;

    const order = await FoodOrder.create({
      user: req.user._id,
      event: eventId,
      stall: stall._id,
      registration: registration._id,
      passId: normalizedPassId,
      orderNumber,
      customerSnapshot: {
        name: registration.name,
        email: registration.email,
        college: registration.college,
      },
      items: lineItems,
      subtotal: toCurrencyAmount(subtotal),
      serviceFee: 0,
      totalAmount: toCurrencyAmount(subtotal),
      currency: "INR",
      notes: String(notes || "").trim(),
      status: "placed",
      statusTimeline: [{ status: "placed", at: createdAt, byAdmin: null, note: "" }],
      estimatedPrepMinutes,
      estimatedReadyAt,
    });

    const orderPayload = buildFoodOrderPayload(
      {
        ...order.toObject(),
        stall: {
          _id: stall._id,
          name: stall.name,
        },
      },
      { includeCustomer: false }
    );

    emitToAdmins("realtime:food-order-updated", {
      reason: "placed",
      eventId,
      order: orderPayload,
    });

    emitToEventRoom(eventId, "realtime:event-food-order-updated", {
      reason: "placed",
      eventId,
      order: orderPayload,
    });

    emitLiveEventUpdate({
      eventId,
      type: "food-order-placed",
      title: "Food order placed",
      message: `Order ${orderNumber} has been placed at ${stall.name}.`,
      payload: {
        orderId: orderPayload.orderId,
        orderNumber,
        stallName: stall.name,
        status: "placed",
      },
    });

    await createUserNotification({
      userId: req.user._id,
      eventId,
      type: "food-order-placed",
      title: "Food order placed",
      message: `Order ${orderNumber} has been placed at ${stall.name}.`,
      payload: {
        orderId: orderPayload.orderId,
        orderNumber,
        stallName: stall.name,
        status: "placed",
        estimatedReadyAt: orderPayload.estimatedReadyAt,
      },
    });

    await logPublicAudit({
      req,
      actorId: normalizedPassId,
      action: "food.order.place",
      resourceType: "food-order",
      resourceId: order._id,
      status: "success",
      details: {
        eventId,
        stallId: stall._id,
        orderNumber,
      },
    });

    res.status(201).json({
      message: "Food order placed",
      order: orderPayload,
    });
  } catch (error) {
    next(error);
  }
};

const getFoodOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const normalizedPassId = normalizePassId(req.query.passId || req.query.passid);

    if (!req.user?._id) {
      res.status(401);
      throw new Error("User login is required to view food order status");
    }

    const order = await FoodOrder.findById(orderId)
      .populate("stall", "name")
      .lean();

    if (!order) {
      res.status(404);
      throw new Error("Food order not found");
    }

    const ownsByUser = order.user && toIdString(order.user) === toIdString(req.user._id);
    const ownsByLegacyEmail =
      typeof order.customerSnapshot?.email === "string" &&
      order.customerSnapshot.email.toLowerCase() === String(req.user.email || "").toLowerCase();

    if (!ownsByUser && !ownsByLegacyEmail) {
      res.status(403);
      throw new Error("You are not authorized to view this order");
    }

    if (normalizedPassId && order.passId !== normalizedPassId) {
      res.status(403);
      throw new Error("passId does not match this order");
    }

    res.json({
      order: buildFoodOrderPayload(order, { includeCustomer: false }),
    });
  } catch (error) {
    next(error);
  }
};

const getAdminFoodOrders = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { status = "", stallId = "", limit = "120" } = req.query;

    const event = await getEventForFoodOps(eventId, false);
    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const filter = {
      event: eventId,
    };

    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (normalizedStatus) {
      if (!ORDER_STATUSES.includes(normalizedStatus)) {
        res.status(400);
        throw new Error("Invalid order status filter");
      }
      filter.status = normalizedStatus;
    }

    if (stallId) {
      if (!isObjectId(stallId)) {
        res.status(400);
        throw new Error("Invalid stallId filter");
      }
      filter.stall = stallId;
    }

    const parsedLimit = Math.max(1, Math.min(300, Math.floor(toSafeNumber(limit, 120))));

    const orders = await FoodOrder.find(filter)
      .populate("stall", "name")
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    const metrics = ORDER_STATUSES.reduce(
      (acc, value) => {
        acc.byStatus[value] = 0;
        return acc;
      },
      {
        totalOrders: orders.length,
        byStatus: {},
      }
    );

    orders.forEach((order) => {
      metrics.byStatus[order.status] = (metrics.byStatus[order.status] || 0) + 1;
    });

    res.json({
      event: {
        id: eventId,
        title: event.title,
      },
      metrics,
      orders: orders.map((order) => buildFoodOrderPayload(order, { includeCustomer: true })),
    });
  } catch (error) {
    next(error);
  }
};

const updateFoodOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim().slice(0, 180);

    if (!ORDER_STATUSES.includes(nextStatus)) {
      res.status(400);
      throw new Error("Invalid status. Use placed, accepted, preparing, ready, picked-up or cancelled");
    }

    const order = await FoodOrder.findById(orderId).populate("stall", "name");
    if (!order) {
      res.status(404);
      throw new Error("Food order not found");
    }

    if (!isTransitionAllowed(order.status, nextStatus)) {
      const allowed = ORDER_TRANSITIONS[order.status] || [];
      res.status(400);
      throw new Error(
        allowed.length
          ? `Invalid status transition from ${order.status}. Allowed: ${allowed.join(", ")}`
          : `Order is already in terminal status ${order.status}`
      );
    }

    const previousStatus = order.status;

    if (order.status !== nextStatus) {
      order.status = nextStatus;
      order.statusTimeline.push({
        status: nextStatus,
        at: new Date(),
        byAdmin: req.admin._id,
        note,
      });

      if (nextStatus === "preparing" && !order.estimatedReadyAt && order.estimatedPrepMinutes > 0) {
        order.estimatedReadyAt = new Date(Date.now() + order.estimatedPrepMinutes * 60 * 1000);
      }

      if (nextStatus === "ready") {
        order.readyAt = new Date();
      }

      if (nextStatus === "picked-up") {
        order.pickedUpAt = new Date();
      }

      if (nextStatus === "cancelled") {
        order.cancelledAt = new Date();
      }

      await order.save();
    }

    const eventId = toIdString(order.event);
    const orderPayload = buildFoodOrderPayload(order.toObject(), { includeCustomer: true });

    emitToAdmins("realtime:food-order-updated", {
      reason: "status-updated",
      eventId,
      order: orderPayload,
    });

    emitToEventRoom(eventId, "realtime:event-food-order-updated", {
      reason: "status-updated",
      eventId,
      order: orderPayload,
    });

    const statusTitle = getStatusTitle(nextStatus);
    const statusMessage = getStatusMessage(nextStatus, order.orderNumber, order.stall?.name || "Food Stall");

    emitLiveEventUpdate({
      eventId,
      type: `food-order-${nextStatus}`,
      title: statusTitle,
      message: statusMessage,
      payload: {
        orderId: orderPayload.orderId,
        orderNumber: order.orderNumber,
        status: nextStatus,
        stallName: order.stall?.name || "Food Stall",
      },
    });

    let linkedUserId = order.user ? toIdString(order.user) : "";
    if (!linkedUserId) {
      const linkedUser = await User.findOne({ email: order.customerSnapshot.email })
        .select("_id")
        .lean();
      linkedUserId = linkedUser?._id ? linkedUser._id.toString() : "";
    }

    if (linkedUserId) {
      await createUserNotification({
        userId: linkedUserId,
        eventId,
        type: `food-order-${nextStatus}`,
        title: statusTitle,
        message: statusMessage,
        payload: {
          orderId: orderPayload.orderId,
          orderNumber: order.orderNumber,
          status: nextStatus,
          stallName: order.stall?.name || "Food Stall",
        },
      });
    }

    await logAdminAudit({
      req,
      action: "food.order.status.update",
      resourceType: "food-order",
      resourceId: order._id,
      status: "success",
      details: {
        eventId,
        orderNumber: order.orderNumber,
        previousStatus,
        nextStatus,
      },
    });

    res.json({
      message: "Food order status updated",
      order: orderPayload,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFoodStall,
  getAdminFoodStalls,
  updateFoodStall,
  createFoodItem,
  updateFoodItem,
  getPublicFoodCatalog,
  placeFoodOrder,
  getFoodOrderStatus,
  getAdminFoodOrders,
  updateFoodOrderStatus,
};
