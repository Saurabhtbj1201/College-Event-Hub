import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminEvents,
  getNavigationMap,
  resetNavigationMap,
  saveNavigationMap,
} from "../../api/adminApi";

const normalizeZone = (zone, index) => ({
  code: String(zone?.code || `ZONE_${index + 1}`)
    .trim()
    .toUpperCase(),
  label: String(zone?.label || `Zone ${index + 1}`).trim(),
  type: zone?.type || "section",
  x: Number(zone?.x || 0),
  y: Number(zone?.y || 0),
  width: Math.max(1, Number(zone?.width || 120)),
  height: Math.max(1, Number(zone?.height || 80)),
  color: String(zone?.color || "#8ad1bf"),
});

const normalizeRouteHint = (hint) => ({
  fromCode: String(hint?.fromCode || "").trim().toUpperCase(),
  toCode: String(hint?.toCode || "").trim().toUpperCase(),
  instructions: Array.isArray(hint?.instructions)
    ? hint.instructions.map((item) => String(item).trim()).filter(Boolean)
    : [],
  estimatedMinutes: Math.max(1, Number(hint?.estimatedMinutes || 4)),
  crowdRecommendation: hint?.crowdRecommendation || "normal",
});

const cloneNavigation = (navigation) => ({
  title: String(navigation?.title || "Venue Navigation").trim(),
  canvas: {
    width: Math.max(200, Number(navigation?.canvas?.width || 860)),
    height: Math.max(200, Number(navigation?.canvas?.height || 480)),
  },
  zones: Array.isArray(navigation?.zones)
    ? navigation.zones.map((zone, index) => normalizeZone(zone, index))
    : [],
  routeHints: Array.isArray(navigation?.routeHints)
    ? navigation.routeHints.map((hint) => normalizeRouteHint(hint))
    : [],
});

const toInstructionsText = (instructions) => instructions.join("\n");

const fromInstructionsText = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const HISTORY_LIMIT = 80;

const getSvgPoint = (svgElement, clientX, clientY) => {
  if (!svgElement) {
    return null;
  }

  // Convert browser pointer coordinates to SVG viewBox coordinates.
  const point = svgElement.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const ctm = svgElement.getScreenCTM();
  if (!ctm) {
    return null;
  }

  return point.matrixTransform(ctm.inverse());
};

const buildZoneCodeFrequency = (zones) => {
  const frequency = new Map();

  (zones || []).forEach((zone) => {
    const code = String(zone?.code || "").trim().toUpperCase();
    if (!code) {
      return;
    }

    frequency.set(code, (frequency.get(code) || 0) + 1);
  });

  return frequency;
};

const getRouteHintDiagnostics = (hint, zoneCodeFrequency, routePairCount) => {
  const warnings = [];
  const issues = {
    fromCode: false,
    toCode: false,
    estimatedMinutes: false,
    instructions: false,
  };

  const fromCode = String(hint?.fromCode || "").trim().toUpperCase();
  const toCode = String(hint?.toCode || "").trim().toUpperCase();
  const instructions = Array.isArray(hint?.instructions)
    ? hint.instructions.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!fromCode) {
    warnings.push("From zone is required.");
    issues.fromCode = true;
  }

  if (!toCode) {
    warnings.push("To zone is required.");
    issues.toCode = true;
  }

  if (fromCode && !zoneCodeFrequency.has(fromCode)) {
    warnings.push(`From zone ${fromCode} does not exist in Zones.`);
    issues.fromCode = true;
  }

  if (toCode && !zoneCodeFrequency.has(toCode)) {
    warnings.push(`To zone ${toCode} does not exist in Zones.`);
    issues.toCode = true;
  }

  if (fromCode && zoneCodeFrequency.get(fromCode) > 1) {
    warnings.push(`From zone ${fromCode} is duplicated in Zones.`);
    issues.fromCode = true;
  }

  if (toCode && zoneCodeFrequency.get(toCode) > 1) {
    warnings.push(`To zone ${toCode} is duplicated in Zones.`);
    issues.toCode = true;
  }

  if (fromCode && toCode && fromCode === toCode) {
    warnings.push("From and To zones should be different.");
    issues.fromCode = true;
    issues.toCode = true;
  }

  if (fromCode && toCode && routePairCount > 1) {
    warnings.push(`Duplicate route pair detected for ${fromCode} -> ${toCode}.`);
    issues.fromCode = true;
    issues.toCode = true;
  }

  if (instructions.length === 0) {
    warnings.push("Add at least one instruction step.");
    issues.instructions = true;
  }

  if (Number(hint?.estimatedMinutes) < 1) {
    warnings.push("Estimated minutes must be at least 1.");
    issues.estimatedMinutes = true;
  }

  return {
    warnings,
    issues,
  };
};

const validateNavigation = (navigation) => {
  if (!String(navigation.title || "").trim()) {
    return "Map title is required";
  }

  if (!Array.isArray(navigation.zones) || navigation.zones.length === 0) {
    return "Add at least one zone before saving";
  }

  const zoneCodes = new Set();

  for (const zone of navigation.zones) {
    const code = String(zone.code || "").trim().toUpperCase();
    const label = String(zone.label || "").trim();

    if (!code) {
      return "Each zone needs a code";
    }

    if (zoneCodes.has(code)) {
      return `Duplicate zone code found: ${code}`;
    }

    if (!label) {
      return `Zone ${code} needs a label`;
    }

    if (Number(zone.width) < 1 || Number(zone.height) < 1) {
      return `Zone ${code} has invalid size`;
    }

    zoneCodes.add(code);
  }

  for (const hint of navigation.routeHints || []) {
    const fromCode = String(hint.fromCode || "").trim().toUpperCase();
    const toCode = String(hint.toCode || "").trim().toUpperCase();
    const instructions = Array.isArray(hint.instructions)
      ? hint.instructions.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!fromCode || !toCode) {
      return "Each route hint must include both From and To zones";
    }

    if (!zoneCodes.has(fromCode) || !zoneCodes.has(toCode)) {
      return `Route hint ${fromCode} -> ${toCode} references missing zones`;
    }

    if (fromCode === toCode) {
      return `Route hint ${fromCode} -> ${toCode} must use different zones`;
    }

    if (instructions.length === 0) {
      return `Route hint ${fromCode} -> ${toCode} needs at least one instruction`;
    }
  }

  return "";
};

const AdminNavigationPage = () => {
  const mapSvgRef = useRef(null);
  const historyRef = useRef({ past: [], future: [] });
  const dragHistoryRecordedRef = useRef(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [navigation, setNavigation] = useState(null);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(0);
  const [dragState, setDragState] = useState(null);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const syncHistoryState = () => {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  };

  const clearHistory = () => {
    historyRef.current = {
      past: [],
      future: [],
    };
    syncHistoryState();
  };

  const recordHistorySnapshot = (snapshot) => {
    if (!snapshot) {
      return;
    }

    historyRef.current.past.push(cloneNavigation(snapshot));

    if (historyRef.current.past.length > HISTORY_LIMIT) {
      historyRef.current.past.shift();
    }

    historyRef.current.future = [];
    syncHistoryState();
  };

  const applyNavigationUpdate = (updater, options = {}) => {
    const { recordHistory = true } = options;

    setNavigation((current) => {
      if (!current) {
        return current;
      }

      const next = updater(current);

      if (!next) {
        return current;
      }

      if (recordHistory) {
        recordHistorySnapshot(current);
      }

      return next;
    });
  };

  const handleUndo = () => {
    if (!navigation || historyRef.current.past.length === 0) {
      return;
    }

    const previous = historyRef.current.past.pop();
    historyRef.current.future.unshift(cloneNavigation(navigation));

    if (historyRef.current.future.length > HISTORY_LIMIT) {
      historyRef.current.future.pop();
    }

    setNavigation(cloneNavigation(previous));
    syncHistoryState();
  };

  const handleRedo = () => {
    if (!navigation || historyRef.current.future.length === 0) {
      return;
    }

    const next = historyRef.current.future.shift();
    historyRef.current.past.push(cloneNavigation(navigation));

    if (historyRef.current.past.length > HISTORY_LIMIT) {
      historyRef.current.past.shift();
    }

    setNavigation(cloneNavigation(next));
    syncHistoryState();
  };

  const zoneOptions = useMemo(() => {
    if (!navigation) {
      return [];
    }

    return navigation.zones.map((zone) => ({
      value: zone.code,
      label: `${zone.code} (${zone.label})`,
    }));
  }, [navigation]);

  const selectedZone = useMemo(() => {
    if (!navigation || !navigation.zones.length) {
      return null;
    }

    if (selectedZoneIndex < 0 || selectedZoneIndex >= navigation.zones.length) {
      return navigation.zones[0];
    }

    return navigation.zones[selectedZoneIndex];
  }, [navigation, selectedZoneIndex]);

    const routeHintDiagnostics = useMemo(() => {
      if (!navigation) {
        return [];
      }

      const zoneCodeFrequency = buildZoneCodeFrequency(navigation.zones);
      const pairFrequency = new Map();

      navigation.routeHints.forEach((hint) => {
        const fromCode = String(hint?.fromCode || "").trim().toUpperCase();
        const toCode = String(hint?.toCode || "").trim().toUpperCase();

        if (!fromCode || !toCode) {
          return;
        }

        const key = `${fromCode}->${toCode}`;
        pairFrequency.set(key, (pairFrequency.get(key) || 0) + 1);
      });

      return navigation.routeHints.map((hint) => {
        const fromCode = String(hint?.fromCode || "").trim().toUpperCase();
        const toCode = String(hint?.toCode || "").trim().toUpperCase();
        const key = fromCode && toCode ? `${fromCode}->${toCode}` : "";
        const routePairCount = key ? pairFrequency.get(key) || 0 : 0;

        return getRouteHintDiagnostics(hint, zoneCodeFrequency, routePairCount);
      });
    }, [navigation]);

    const totalRouteWarnings = useMemo(
      () => routeHintDiagnostics.reduce((sum, item) => sum + item.warnings.length, 0),
      [routeHintDiagnostics]
    );

    const getRouteInputClass = (hasIssue) =>
      `w-full rounded-xl border px-3 py-2 outline-none ${
        hasIssue
          ? "border-red-300 bg-red-50 focus:border-red-500"
          : "border-slate-300 focus:border-brand-500"
      }`;

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await getAdminEvents();
        const eventList = Array.isArray(response) ? response : [];
        setEvents(eventList);

        if (eventList.length > 0) {
          setSelectedEventId(eventList[0]._id);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load events");
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    const loadNavigation = async () => {
      if (!selectedEventId) {
        setNavigation(null);
        clearHistory();
        return;
      }

      try {
        setLoadingMap(true);
        setError("");
        const response = await getNavigationMap(selectedEventId);
        const nextNavigation = cloneNavigation(response.navigation);
        setNavigation(nextNavigation);
        setSelectedZoneIndex(0);
        setDragState(null);
        dragHistoryRecordedRef.current = false;
        clearHistory();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load navigation map");
      } finally {
        setLoadingMap(false);
      }
    };

    loadNavigation();
  }, [selectedEventId]);

  const handleEventChange = (event) => {
    setSelectedEventId(event.target.value);
    setNotice("");
  };

  const handleNavigationFieldChange = (event) => {
    const { name, value } = event.target;

    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const handleCanvasChange = (event) => {
    const { name, value } = event.target;

    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        canvas: {
          ...current.canvas,
          [name]: Math.max(200, Number(value || 200)),
        },
      };
    });
  };

  const updateZoneAtIndex = (index, updater) => {
    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      const zones = current.zones.map((zone, zoneIndex) =>
        zoneIndex === index ? updater(zone) : zone
      );

      return {
        ...current,
        zones,
      };
    });
  };

  const handleZonePointerDown = (event, zoneIndex) => {
    if (!navigation) {
      return;
    }

    const zone = navigation.zones[zoneIndex];
    const point = getSvgPoint(mapSvgRef.current, event.clientX, event.clientY);

    if (!zone || !point) {
      return;
    }

    setSelectedZoneIndex(zoneIndex);
    setDragState({
      zoneIndex,
      offsetX: point.x - zone.x,
      offsetY: point.y - zone.y,
    });
    dragHistoryRecordedRef.current = false;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handleMapPointerMove = (event) => {
    if (!dragState) {
      return;
    }

    const point = getSvgPoint(mapSvgRef.current, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    applyNavigationUpdate(
      (current) => {
      if (!current) {
        return current;
      }

      const zone = current.zones[dragState.zoneIndex];
      if (!zone) {
        return current;
      }

      const maxX = Math.max(0, current.canvas.width - zone.width);
      const maxY = Math.max(0, current.canvas.height - zone.height);
      const nextX = clamp(Math.round(point.x - dragState.offsetX), 0, maxX);
      const nextY = clamp(Math.round(point.y - dragState.offsetY), 0, maxY);

      if (zone.x === nextX && zone.y === nextY) {
        return current;
      }

      if (!dragHistoryRecordedRef.current) {
        dragHistoryRecordedRef.current = true;
        recordHistorySnapshot(current);
      }

      return {
        ...current,
        zones: current.zones.map((item, index) =>
          index === dragState.zoneIndex
            ? {
                ...item,
                x: nextX,
                y: nextY,
              }
            : item
        ),
      };
        },
        { recordHistory: false }
      );
  };

  const handleMapPointerEnd = () => {
    setDragState(null);
      dragHistoryRecordedRef.current = false;
  };

  const handleZoneFieldChange = (event) => {
    const { name, value } = event.target;

    if (!selectedZone) {
      return;
    }

    updateZoneAtIndex(selectedZoneIndex, (zone) => {
      if (["x", "y", "width", "height"].includes(name)) {
        const numericValue = Number(value || 0);
        return {
          ...zone,
          [name]: name === "width" || name === "height" ? Math.max(1, numericValue) : Math.max(0, numericValue),
        };
      }

      if (name === "code") {
        return {
          ...zone,
          code: value.toUpperCase(),
        };
      }

      return {
        ...zone,
        [name]: value,
      };
    });
  };

  const nudgeSelectedZone = (dx, dy) => {
    if (!selectedZone) {
      return;
    }

    updateZoneAtIndex(selectedZoneIndex, (zone) => ({
      ...zone,
      x: Math.max(0, zone.x + dx),
      y: Math.max(0, zone.y + dy),
    }));
  };

  const handleAddZone = () => {
    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      const used = new Set(current.zones.map((zone) => zone.code));
      let nextNumber = current.zones.length + 1;
      let nextCode = `ZONE_${nextNumber}`;

      while (used.has(nextCode)) {
        nextNumber += 1;
        nextCode = `ZONE_${nextNumber}`;
      }

      const zone = normalizeZone(
        {
          code: nextCode,
          label: `Zone ${nextNumber}`,
          type: "section",
          x: 60,
          y: 60,
          width: 120,
          height: 80,
          color: "#8ad1bf",
        },
        current.zones.length
      );

      const nextZones = [...current.zones, zone];
      setSelectedZoneIndex(nextZones.length - 1);

      return {
        ...current,
        zones: nextZones,
      };
    });
  };

  const handleRemoveZone = () => {
    if (!navigation || !navigation.zones.length) {
      return;
    }

    const removingCode = selectedZone?.code;

    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      const nextZones = current.zones.filter((_, index) => index !== selectedZoneIndex);
      const nextHints = current.routeHints.filter(
        (hint) => hint.fromCode !== removingCode && hint.toCode !== removingCode
      );

      return {
        ...current,
        zones: nextZones,
        routeHints: nextHints,
      };
    });

    setSelectedZoneIndex((current) => Math.max(0, current - 1));
  };

  const updateRouteHintAtIndex = (index, updater) => {
    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      const routeHints = current.routeHints.map((hint, hintIndex) =>
        hintIndex === index ? updater(hint) : hint
      );

      return {
        ...current,
        routeHints,
      };
    });
  };

  const handleRouteHintChange = (index, event) => {
    const { name, value } = event.target;

    updateRouteHintAtIndex(index, (hint) => {
      if (name === "estimatedMinutes") {
        return {
          ...hint,
          estimatedMinutes: Math.max(1, Number(value || 1)),
        };
      }

      if (name === "instructions") {
        return {
          ...hint,
          instructions: fromInstructionsText(value),
        };
      }

      if (name === "fromCode" || name === "toCode") {
        return {
          ...hint,
          [name]: value.toUpperCase(),
        };
      }

      return {
        ...hint,
        [name]: value,
      };
    });
  };

  const handleAddRouteHint = () => {
    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      const first = current.zones[0]?.code || "";
      const second = current.zones[1]?.code || first;

      return {
        ...current,
        routeHints: [
          ...current.routeHints,
          {
            fromCode: first,
            toCode: second,
            instructions: ["Use aisle markers to reach destination."],
            estimatedMinutes: 4,
            crowdRecommendation: "normal",
          },
        ],
      };
    });
  };

  const handleRemoveRouteHint = (index) => {
    applyNavigationUpdate((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        routeHints: current.routeHints.filter((_, hintIndex) => hintIndex !== index),
      };
    });
  };

  const getZoneIndexByCode = (code) => {
    if (!navigation) {
      return -1;
    }

    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) {
      return -1;
    }

    return navigation.zones.findIndex(
      (zone) => String(zone.code || "").trim().toUpperCase() === normalizedCode
    );
  };

  const handleSelectZoneByCode = (code) => {
    const index = getZoneIndexByCode(code);
    if (index >= 0) {
      setSelectedZoneIndex(index);
    }
  };

  const handleRouteHintQuickFix = (index, type) => {
    if (!navigation) {
      return;
    }

    if (type === "auto-endpoints") {
      applyNavigationUpdate((current) => {
        if (!current) {
          return current;
        }

        const routeHint = current.routeHints[index];
        if (!routeHint || current.zones.length === 0) {
          return current;
        }

        const normalizedZones = current.zones.map((zone) =>
          String(zone.code || "").trim().toUpperCase()
        );

        const firstCode = normalizedZones[0];
        const currentFromCode = String(routeHint.fromCode || "").trim().toUpperCase();
        const currentToCode = String(routeHint.toCode || "").trim().toUpperCase();

        const fixedFromCode = normalizedZones.includes(currentFromCode)
          ? currentFromCode
          : firstCode;

        const fallbackToCode =
          normalizedZones.find((zoneCode) => zoneCode !== fixedFromCode) || fixedFromCode;

        const fixedToCode =
          normalizedZones.includes(currentToCode) && currentToCode !== fixedFromCode
            ? currentToCode
            : fallbackToCode;

        return {
          ...current,
          routeHints: current.routeHints.map((hint, hintIndex) =>
            hintIndex === index
              ? {
                  ...hint,
                  fromCode: fixedFromCode,
                  toCode: fixedToCode,
                }
              : hint
          ),
        };
      });

      return;
    }

    updateRouteHintAtIndex(index, (hint) => {
      if (type === "swap") {
        return {
          ...hint,
          fromCode: String(hint.toCode || "").trim().toUpperCase(),
          toCode: String(hint.fromCode || "").trim().toUpperCase(),
        };
      }

      if (type === "instructions") {
        return {
          ...hint,
          instructions:
            Array.isArray(hint.instructions) && hint.instructions.length > 0
              ? hint.instructions
              : [
                  "Follow the nearest overhead directional signs.",
                  "Stay on the marked aisle toward your destination.",
                ],
        };
      }

      if (type === "minutes") {
        return {
          ...hint,
          estimatedMinutes: Math.max(1, Number(hint.estimatedMinutes || 4)),
        };
      }

      return hint;
    });
  };

  const handleSave = async () => {
    if (!selectedEventId || !navigation) {
      return;
    }

    const validationMessage = validateNavigation(navigation);
    if (validationMessage) {
      setError(validationMessage);
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const normalizedZones = navigation.zones
        .map((zone, index) => normalizeZone(zone, index))
        .map((zone) => ({
          ...zone,
          x: clamp(zone.x, 0, Math.max(0, navigation.canvas.width - zone.width)),
          y: clamp(zone.y, 0, Math.max(0, navigation.canvas.height - zone.height)),
        }));

      const payload = {
        title: navigation.title,
        canvas: navigation.canvas,
        zones: normalizedZones,
        routeHints: navigation.routeHints.map((hint) => normalizeRouteHint(hint)),
      };

      const response = await saveNavigationMap(selectedEventId, payload);
      setNavigation(cloneNavigation(response.navigation));
      setNotice("Navigation map saved successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save navigation map");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedEventId) {
      return;
    }

    setResetting(true);
    setError("");
    setNotice("");

    try {
      const response = await resetNavigationMap(selectedEventId);

      if (navigation) {
        recordHistorySnapshot(navigation);
      }

      setNavigation(cloneNavigation(response.navigation));
      setSelectedZoneIndex(0);
      setNotice("Navigation map reset to default template");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset navigation map");
    } finally {
      setResetting(false);
    }
  };

  if (loadingEvents) {
    return <p className="text-slate-600">Loading navigation editor...</p>;
  }

  if (!events.length) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Navigation Editor</h1>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          Create at least one event before configuring venue navigation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Navigation Editor</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage venue zones and route hints used by the Smart Navigation public page.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Event</span>
            <select
              value={selectedEventId}
              onChange={handleEventChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {events.map((eventItem) => (
                <option key={eventItem._id} value={eventItem._id}>
                  {eventItem.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Canvas Width</span>
            <input
              name="width"
              type="number"
              min={200}
              value={navigation?.canvas.width || 860}
              onChange={handleCanvasChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Canvas Height</span>
            <input
              name="height"
              type="number"
              min={200}
              value={navigation?.canvas.height || 480}
              onChange={handleCanvasChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Map Title</span>
          <input
            name="title"
            value={navigation?.title || ""}
            onChange={handleNavigationFieldChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!historyState.canUndo || loadingMap || saving || resetting}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!historyState.canRedo || loadingMap || saving || resetting}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!navigation || saving || loadingMap}
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Navigation"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || loadingMap}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resetting ? "Resetting..." : "Reset to Default"}
          </button>
        </div>
      </section>

      {loadingMap ? (
        <p className="text-slate-600">Loading map data...</p>
      ) : navigation ? (
        <>
          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Map Preview</h2>
            <p className="mt-1 text-sm text-slate-600">
              Drag zones directly on the map to reposition them.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              <svg
                ref={mapSvgRef}
                viewBox={`0 0 ${navigation.canvas.width} ${navigation.canvas.height}`}
                className="h-auto w-full min-w-[680px]"
                role="img"
                aria-label="Navigation map preview"
                onPointerMove={handleMapPointerMove}
                onPointerUp={handleMapPointerEnd}
                onPointerCancel={handleMapPointerEnd}
              >
                <rect
                  x="0"
                  y="0"
                  width={navigation.canvas.width}
                  height={navigation.canvas.height}
                  fill="#f8fafc"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  rx="16"
                />

                {navigation.zones.map((zone, index) => (
                  <g
                    key={`${zone.code}-${index}`}
                    onClick={() => setSelectedZoneIndex(index)}
                    onPointerDown={(event) => handleZonePointerDown(event, index)}
                  >
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      fill={zone.color || "#8ad1bf"}
                      stroke={selectedZoneIndex === index ? "#0f172a" : "#334155"}
                      strokeWidth={selectedZoneIndex === index ? "2.6" : "1.2"}
                      rx="10"
                      className={
                        dragState?.zoneIndex === index
                          ? "cursor-grabbing"
                          : "cursor-grab"
                      }
                    />
                    <text
                      x={zone.x + zone.width / 2}
                      y={zone.y + zone.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="14"
                      fill="#0f172a"
                      fontWeight="600"
                    >
                      {zone.code}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-slate-900">Zones</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddZone}
                    className="rounded-full border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Add Zone
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveZone}
                    disabled={!selectedZone}
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove Selected
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {navigation.zones.map((zone, index) => (
                  <button
                    key={`${zone.code}-${index}`}
                    type="button"
                    onClick={() => setSelectedZoneIndex(index)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selectedZoneIndex === index
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {zone.code}
                  </button>
                ))}
              </div>

              {selectedZone ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Code</span>
                    <input
                      name="code"
                      value={selectedZone.code}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Label</span>
                    <input
                      name="label"
                      value={selectedZone.label}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
                    <select
                      name="type"
                      value={selectedZone.type}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    >
                      <option value="gate">Gate</option>
                      <option value="section">Section</option>
                      <option value="facility">Facility</option>
                      <option value="stage">Stage</option>
                      <option value="path">Path</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Color</span>
                    <input
                      name="color"
                      value={selectedZone.color}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">X</span>
                    <input
                      name="x"
                      type="number"
                      min={0}
                      value={selectedZone.x}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Y</span>
                    <input
                      name="y"
                      type="number"
                      min={0}
                      value={selectedZone.y}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Width</span>
                    <input
                      name="width"
                      type="number"
                      min={1}
                      value={selectedZone.width}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Height</span>
                    <input
                      name="height"
                      type="number"
                      min={1}
                      value={selectedZone.height}
                      onChange={handleZoneFieldChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                    />
                  </label>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Select a zone to edit.</p>
              )}

              {selectedZone ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedZone(-5, 0)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Nudge Left
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedZone(5, 0)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Nudge Right
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedZone(0, -5)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Nudge Up
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedZone(0, 5)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Nudge Down
                  </button>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-slate-900">Route Hints</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      totalRouteWarnings > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {totalRouteWarnings > 0
                      ? `${totalRouteWarnings} warning${totalRouteWarnings > 1 ? "s" : ""}`
                      : "All routes healthy"}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRouteHint}
                    className="rounded-full border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Add Route Hint
                  </button>
                </div>
              </div>

              {navigation.routeHints.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No route hints yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {navigation.routeHints.map((hint, index) => {
                    const diagnostics = routeHintDiagnostics[index] || { warnings: [] };
                    const hasWarnings = diagnostics.warnings.length > 0;

                    return (
                    <article
                      key={`${hint.fromCode}-${hint.toCode}-${index}`}
                      className={`rounded-xl border p-3 ${
                        hasWarnings
                          ? "border-amber-200 bg-amber-50/70"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">From</span>
                          <select
                            name="fromCode"
                            value={hint.fromCode}
                            onChange={(event) => handleRouteHintChange(index, event)}
                            aria-invalid={diagnostics.issues?.fromCode ? "true" : "false"}
                            className={getRouteInputClass(diagnostics.issues?.fromCode)}
                          >
                            {zoneOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">To</span>
                          <select
                            name="toCode"
                            value={hint.toCode}
                            onChange={(event) => handleRouteHintChange(index, event)}
                            aria-invalid={diagnostics.issues?.toCode ? "true" : "false"}
                            className={getRouteInputClass(diagnostics.issues?.toCode)}
                          >
                            {zoneOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Estimated Minutes</span>
                          <input
                            name="estimatedMinutes"
                            type="number"
                            min={1}
                            value={hint.estimatedMinutes}
                            onChange={(event) => handleRouteHintChange(index, event)}
                            aria-invalid={diagnostics.issues?.estimatedMinutes ? "true" : "false"}
                            className={getRouteInputClass(diagnostics.issues?.estimatedMinutes)}
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Crowd Advice</span>
                          <select
                            name="crowdRecommendation"
                            value={hint.crowdRecommendation}
                            onChange={(event) => handleRouteHintChange(index, event)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                          >
                            <option value="normal">Normal</option>
                            <option value="preferred">Preferred</option>
                            <option value="avoid">Avoid</option>
                          </select>
                        </label>
                      </div>

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Instructions (one step per line)</span>
                        <textarea
                          name="instructions"
                          rows={4}
                          value={toInstructionsText(hint.instructions)}
                          onChange={(event) => handleRouteHintChange(index, event)}
                          aria-invalid={diagnostics.issues?.instructions ? "true" : "false"}
                          className={getRouteInputClass(diagnostics.issues?.instructions)}
                        />
                      </label>

                      {hasWarnings ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                            Route Quality Warnings
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-900">
                            {diagnostics.warnings.map((warning, warningIndex) => (
                              <li key={`${warning}-${warningIndex}`}>{warning}</li>
                            ))}
                          </ul>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {(diagnostics.issues?.fromCode || diagnostics.issues?.toCode) && (
                              <button
                                type="button"
                                onClick={() => handleRouteHintQuickFix(index, "auto-endpoints")}
                                className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Auto Fix Endpoints
                              </button>
                            )}

                            {diagnostics.issues?.instructions && (
                              <button
                                type="button"
                                onClick={() => handleRouteHintQuickFix(index, "instructions")}
                                className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Add Default Steps
                              </button>
                            )}

                            {diagnostics.issues?.estimatedMinutes && (
                              <button
                                type="button"
                                onClick={() => handleRouteHintQuickFix(index, "minutes")}
                                className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Set Minimum Minutes
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRouteHintQuickFix(index, "swap")}
                              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Swap From/To
                            </button>

                            {getZoneIndexByCode(hint.fromCode) >= 0 ? (
                              <button
                                type="button"
                                onClick={() => handleSelectZoneByCode(hint.fromCode)}
                                className="rounded-full border border-brand-300 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                              >
                                Jump to From Zone
                              </button>
                            ) : null}

                            {getZoneIndexByCode(hint.toCode) >= 0 ? (
                              <button
                                type="button"
                                onClick={() => handleSelectZoneByCode(hint.toCode)}
                                className="rounded-full border border-brand-300 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                              >
                                Jump to To Zone
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                          Route quality looks good.
                        </p>
                      )}

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveRouteHint(index)}
                          className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Remove Route Hint
                        </button>
                      </div>
                    </article>
                  );})}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminNavigationPage;
