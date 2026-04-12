const Event = require("../models/Event");
const VenueNavigation = require("../models/VenueNavigation");

const buildDefaultNavigation = (event) => ({
  title: `${event.title} Indoor Navigation`,
  canvas: {
    width: 860,
    height: 480,
  },
  zones: [
    {
      code: "GATE_A",
      label: "Gate A",
      type: "gate",
      x: 40,
      y: 190,
      width: 90,
      height: 90,
      color: "#a7f3d0",
    },
    {
      code: "GATE_B",
      label: "Gate B",
      type: "gate",
      x: 40,
      y: 320,
      width: 90,
      height: 90,
      color: "#86efac",
    },
    {
      code: "GATE_C",
      label: "Gate C",
      type: "gate",
      x: 730,
      y: 320,
      width: 90,
      height: 90,
      color: "#4ade80",
    },
    {
      code: "A12",
      label: "Section A12",
      type: "section",
      x: 220,
      y: 120,
      width: 180,
      height: 120,
      color: "#93c5fd",
    },
    {
      code: "B04",
      label: "Section B04",
      type: "section",
      x: 460,
      y: 120,
      width: 180,
      height: 120,
      color: "#60a5fa",
    },
    {
      code: "FOOD_CT",
      label: "Food Court",
      type: "facility",
      x: 240,
      y: 300,
      width: 170,
      height: 90,
      color: "#fdba74",
    },
    {
      code: "REST_W",
      label: "Restroom Wing",
      type: "facility",
      x: 470,
      y: 300,
      width: 170,
      height: 90,
      color: "#f9a8d4",
    },
    {
      code: "MAIN_STAGE",
      label: "Main Stage",
      type: "stage",
      x: 250,
      y: 20,
      width: 360,
      height: 70,
      color: "#fde68a",
    },
  ],
  routeHints: [
    {
      fromCode: "GATE_B",
      toCode: "A12",
      instructions: [
        "Enter via Gate B and move straight on the central walkway.",
        "Take the first right corridor towards Section A blocks.",
        "Follow A12 markers and climb one short stair segment.",
      ],
      estimatedMinutes: 5,
      crowdRecommendation: "preferred",
    },
    {
      fromCode: "GATE_A",
      toCode: "B04",
      instructions: [
        "Enter from Gate A and head toward the left concourse.",
        "Continue until the blue wayfinding stripe.",
        "Turn right near the beverage kiosk to reach Section B04.",
      ],
      estimatedMinutes: 6,
      crowdRecommendation: "normal",
    },
    {
      fromCode: "GATE_C",
      toCode: "FOOD_CT",
      instructions: [
        "Enter through Gate C and use lower concourse lane.",
        "Keep left at the split near restroom wing.",
        "Food Court is directly ahead after 80 meters.",
      ],
      estimatedMinutes: 4,
      crowdRecommendation: "preferred",
    },
  ],
});

const ensureNavigation = async (eventId) => {
  const event = await Event.findById(eventId).select("title").lean();

  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const existing = await VenueNavigation.findOne({ event: eventId }).lean();
  if (existing) {
    return existing;
  }

  const defaults = buildDefaultNavigation(event);

  const created = await VenueNavigation.create({
    event: eventId,
    ...defaults,
  });

  return created.toObject();
};

const getEventNavigation = async (req, res, next) => {
  try {
    const navigation = await ensureNavigation(req.params.eventId);
    res.json({ navigation });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error);
  }
};

const getRouteHint = async (req, res, next) => {
  try {
    const fromCode = String(req.query.from || "").trim().toUpperCase();
    const toCode = String(req.query.to || "").trim().toUpperCase();

    if (!fromCode || !toCode) {
      res.status(400);
      throw new Error("from and to query parameters are required");
    }

    const navigation = await ensureNavigation(req.params.eventId);

    const exactRoute = navigation.routeHints.find(
      (hint) => hint.fromCode === fromCode && hint.toCode === toCode
    );

    const fallbackRoute = {
      fromCode,
      toCode,
      instructions: [
        `Start from ${fromCode}.`,
        "Use overhead signs and aisle markers for section guidance.",
        `Proceed to ${toCode}.`,
      ],
      estimatedMinutes: 5,
      crowdRecommendation: "normal",
    };

    res.json({
      routeHint: exactRoute || fallbackRoute,
      navigation: {
        event: navigation.event,
        title: navigation.title,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error);
  }
};

const upsertNavigation = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { title, canvas, zones, routeHints } = req.body;

    const event = await Event.findById(eventId).select("title").lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const defaultPayload = buildDefaultNavigation(event);

    const payload = {
      title: title || defaultPayload.title,
      canvas: canvas || defaultPayload.canvas,
      zones: Array.isArray(zones) && zones.length > 0 ? zones : defaultPayload.zones,
      routeHints:
        Array.isArray(routeHints) && routeHints.length > 0
          ? routeHints
          : defaultPayload.routeHints,
      updatedBy: req.admin._id,
    };

    const navigation = await VenueNavigation.findOneAndUpdate(
      { event: eventId },
      payload,
      { upsert: true, new: true, runValidators: true }
    ).lean();

    res.json({
      message: "Navigation map saved",
      navigation,
    });
  } catch (error) {
    next(error);
  }
};

const resetNavigationToDefault = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select("title").lean();

    if (!event) {
      res.status(404);
      throw new Error("Event not found");
    }

    const defaultPayload = buildDefaultNavigation(event);

    const navigation = await VenueNavigation.findOneAndUpdate(
      { event: eventId },
      {
        ...defaultPayload,
        updatedBy: req.admin._id,
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    res.json({
      message: "Navigation reset to default template",
      navigation,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEventNavigation,
  getRouteHint,
  upsertNavigation,
  resetNavigationToDefault,
};
