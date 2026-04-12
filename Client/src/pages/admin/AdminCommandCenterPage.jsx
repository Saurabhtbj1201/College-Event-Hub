import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createQueuePoint,
  getCommandSummary,
  getQueueAnalytics,
  getQueueOverview,
  sendEventBroadcast,
  getSimulatorStatus,
  serveNextQueueTicket,
  startSimulator,
  stopSimulator,
  updateEventLiveOperations,
  updateQueuePoint,
} from "../../api/adminApi";
import { useAuth } from "../../contexts/AuthContext";
import { connectAdminSocket, disconnectAdminSocket } from "../../realtime/adminSocket";
import { formatDateTime } from "../../utils/date";

const toFeedItem = (type, payload) => ({
  id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  payload,
  createdAt: new Date().toISOString(),
});

const defaultQueueAnalytics = {
  metrics: {
    points: 0,
    totalServed: 0,
    totalWaiting: 0,
    averageWaitMinutes: 0,
    busiestPointName: null,
  },
  perPoint: [],
};

const defaultSimulator = {
  running: false,
  intervalSeconds: 15,
  startedAt: null,
  lastTickAt: null,
  tickCount: 0,
};

const AdminCommandCenterPage = () => {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feed, setFeed] = useState([]);
  const [summary, setSummary] = useState(null);
  const [queueOverview, setQueueOverview] = useState({
    metrics: { queuePoints: 0, totalWaiting: 0 },
    queuePoints: [],
  });
  const [queueAnalytics, setQueueAnalytics] = useState(defaultQueueAnalytics);
  const [simulator, setSimulator] = useState(defaultSimulator);
  const [queueFilterEventId, setQueueFilterEventId] = useState("");

  const [updatingCrowd, setUpdatingCrowd] = useState(false);
  const [creatingQueuePoint, setCreatingQueuePoint] = useState(false);
  const [updatingQueuePoint, setUpdatingQueuePoint] = useState(false);
  const [servingQueuePointId, setServingQueuePointId] = useState("");
  const [startingSimulator, setStartingSimulator] = useState(false);
  const [stoppingSimulator, setStoppingSimulator] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [crowdForm, setCrowdForm] = useState({
    eventId: "",
    crowdLevel: "medium",
    entryGateStatus: "open",
    note: "",
  });
  const [simulatorIntervalInput, setSimulatorIntervalInput] = useState("15");

  const [queueCreateForm, setQueueCreateForm] = useState({
    eventId: "",
    pointType: "entry",
    pointName: "",
    status: "normal",
    manualWaitTimeMinutes: "",
    note: "",
  });

  const [queueUpdateForm, setQueueUpdateForm] = useState({
    queuePointId: "",
    status: "normal",
    manualWaitTimeMinutes: "",
    note: "",
    isActive: true,
  });

  const [broadcastForm, setBroadcastForm] = useState({
    eventId: "",
    audience: "all-registrants",
    title: "",
    message: "",
  });

  const eventOptions = useMemo(() => summary?.eventStatuses || [], [summary]);
  const queuePointOptions = useMemo(() => queueOverview.queuePoints || [], [queueOverview]);

  const maxThroughput = useMemo(() => {
    const values = queueAnalytics.perPoint.map((item) => item.throughput || 0);
    const highest = values.length ? Math.max(...values) : 0;
    return highest > 0 ? highest : 1;
  }, [queueAnalytics]);

  const loadSummary = useCallback(async () => {
    const data = await getCommandSummary();
    setSummary(data);

    if (data.eventStatuses.length > 0) {
      setCrowdForm((current) => ({
        ...current,
        eventId: current.eventId || data.eventStatuses[0].eventId,
      }));

      setQueueCreateForm((current) => ({
        ...current,
        eventId: current.eventId || data.eventStatuses[0].eventId,
      }));

      setBroadcastForm((current) => ({
        ...current,
        eventId: current.eventId || data.eventStatuses[0].eventId,
      }));
    }
  }, []);

  const loadQueueOverview = useCallback(async () => {
    const data = await getQueueOverview(queueFilterEventId);
    setQueueOverview(data);

    if (data.queuePoints.length > 0) {
      setQueueUpdateForm((current) => ({
        ...current,
        queuePointId: current.queuePointId || data.queuePoints[0].queuePointId,
      }));
    }
  }, [queueFilterEventId]);

  const loadQueueAnalytics = useCallback(async () => {
    const data = await getQueueAnalytics(queueFilterEventId);
    setQueueAnalytics(data);
  }, [queueFilterEventId]);

  const loadSimulator = useCallback(async () => {
    const data = await getSimulatorStatus();
    setSimulator(data.simulator || defaultSimulator);

    if (data.simulator?.intervalSeconds) {
      setSimulatorIntervalInput(String(data.simulator.intervalSeconds));
    }
  }, []);

  const refreshQueueData = useCallback(async () => {
    await Promise.all([loadQueueOverview(), loadQueueAnalytics()]);
  }, [loadQueueOverview, loadQueueAnalytics]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await Promise.all([loadSummary(), refreshQueueData(), loadSimulator()]);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load command center");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [loadSummary, refreshQueueData, loadSimulator]);

  useEffect(() => {
    if (!summary) {
      return;
    }

    refreshQueueData().catch(() => {
      // Keep existing queue data if filter reload fails.
    });
  }, [queueFilterEventId, summary, refreshQueueData]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = connectAdminSocket(token);
    if (!socket) {
      return undefined;
    }

    const onRegistrationCreated = (payload) => {
      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          metrics: {
            ...current.metrics,
            totalRegistrations: current.metrics.totalRegistrations + 1,
          },
          recentRegistrations: [payload, ...current.recentRegistrations].slice(0, 10),
        };
      });

      setFeed((current) => [toFeedItem("registration", payload), ...current].slice(0, 25));
    };

    const onCheckIn = (payload) => {
      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          metrics: {
            ...current.metrics,
            totalCheckedIn: current.metrics.totalCheckedIn + 1,
          },
          recentCheckIns: [payload, ...current.recentCheckIns].slice(0, 10),
        };
      });

      setFeed((current) => [toFeedItem("checkin", payload), ...current].slice(0, 25));
    };

    const onCrowdUpdated = (payload) => {
      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          eventStatuses: current.eventStatuses.map((item) =>
            item.eventId === payload.eventId
              ? {
                  ...item,
                  liveOperations: payload.liveOperations,
                }
              : item
          ),
        };
      });

      setFeed((current) => [toFeedItem("crowd", payload), ...current].slice(0, 25));
    };

    const onQueueUpdated = (payload) => {
      refreshQueueData().catch(() => {
        // Keep UI alive even if refresh fails.
      });
      setFeed((current) => [toFeedItem("queue", payload), ...current].slice(0, 25));
    };

    const onQueueServed = (payload) => {
      refreshQueueData().catch(() => {
        // Keep UI alive even if refresh fails.
      });
      setFeed((current) => [toFeedItem("queue-served", payload), ...current].slice(0, 25));
    };

    const onBroadcastSent = (payload) => {
      setFeed((current) => [toFeedItem("broadcast", payload), ...current].slice(0, 25));
    };

    socket.on("realtime:registration-created", onRegistrationCreated);
    socket.on("realtime:check-in", onCheckIn);
    socket.on("realtime:crowd-updated", onCrowdUpdated);
    socket.on("realtime:queue-updated", onQueueUpdated);
    socket.on("realtime:queue-ticket-served", onQueueServed);
    socket.on("realtime:user-broadcast-sent", onBroadcastSent);

    return () => {
      socket.off("realtime:registration-created", onRegistrationCreated);
      socket.off("realtime:check-in", onCheckIn);
      socket.off("realtime:crowd-updated", onCrowdUpdated);
      socket.off("realtime:queue-updated", onQueueUpdated);
      socket.off("realtime:queue-ticket-served", onQueueServed);
      socket.off("realtime:user-broadcast-sent", onBroadcastSent);
      disconnectAdminSocket();
    };
  }, [token, refreshQueueData]);

  const handleCrowdFieldChange = (event) => {
    const { name, value } = event.target;
    setCrowdForm((current) => ({ ...current, [name]: value }));
  };

  const handleQueueCreateChange = (event) => {
    const { name, value } = event.target;
    setQueueCreateForm((current) => ({ ...current, [name]: value }));
  };

  const handleBroadcastFieldChange = (event) => {
    const { name, value } = event.target;
    setBroadcastForm((current) => ({ ...current, [name]: value }));
  };

  const handleQueueUpdateChange = (event) => {
    const { name, value, type, checked } = event.target;
    setQueueUpdateForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLiveOpsSubmit = async (event) => {
    event.preventDefault();

    if (!crowdForm.eventId) {
      setError("Please select an event first");
      return;
    }

    setUpdatingCrowd(true);
    setError("");
    setNotice("");

    try {
      const response = await updateEventLiveOperations(crowdForm.eventId, {
        crowdLevel: crowdForm.crowdLevel,
        entryGateStatus: crowdForm.entryGateStatus,
        note: crowdForm.note,
      });

      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          eventStatuses: current.eventStatuses.map((item) =>
            item.eventId === response.eventStatus.eventId
              ? response.eventStatus
              : item
          ),
        };
      });

      setNotice(`Live crowd status updated for ${response.eventStatus.title}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update crowd status");
    } finally {
      setUpdatingCrowd(false);
    }
  };

  const handleCreateQueuePoint = async (event) => {
    event.preventDefault();

    if (!queueCreateForm.eventId || !queueCreateForm.pointName.trim()) {
      setError("Event and queue point name are required");
      return;
    }

    setCreatingQueuePoint(true);
    setError("");
    setNotice("");

    try {
      const response = await createQueuePoint(queueCreateForm.eventId, {
        pointType: queueCreateForm.pointType,
        pointName: queueCreateForm.pointName.trim(),
        status: queueCreateForm.status,
        manualWaitTimeMinutes: Number(queueCreateForm.manualWaitTimeMinutes || 0),
        note: queueCreateForm.note,
      });

      await refreshQueueData();

      setNotice(`Queue point created: ${response.queuePoint.pointName}`);
      setQueueCreateForm((current) => ({
        ...current,
        pointName: "",
        note: "",
        manualWaitTimeMinutes: "",
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create queue point");
    } finally {
      setCreatingQueuePoint(false);
    }
  };

  const handleUpdateQueuePoint = async (event) => {
    event.preventDefault();

    if (!queueUpdateForm.queuePointId) {
      setError("Select a queue point to update");
      return;
    }

    setUpdatingQueuePoint(true);
    setError("");
    setNotice("");

    try {
      const response = await updateQueuePoint(queueUpdateForm.queuePointId, {
        status: queueUpdateForm.status,
        manualWaitTimeMinutes: Number(queueUpdateForm.manualWaitTimeMinutes || 0),
        note: queueUpdateForm.note,
        isActive: queueUpdateForm.isActive,
      });

      await refreshQueueData();
      setNotice(`Queue point updated: ${response.queuePoint.pointName}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update queue point");
    } finally {
      setUpdatingQueuePoint(false);
    }
  };

  const handleQueuePointSelection = (event) => {
    const queuePointId = event.target.value;
    const selected = queuePointOptions.find((item) => item.queuePointId === queuePointId);

    if (!selected) {
      setQueueUpdateForm((current) => ({
        ...current,
        queuePointId,
      }));
      return;
    }

    setQueueUpdateForm((current) => ({
      ...current,
      queuePointId,
      status: selected.status,
      manualWaitTimeMinutes: String(selected.manualWaitTimeMinutes || 0),
      note: selected.note || "",
      isActive: true,
    }));
  };

  const handleQueueFilterChange = (event) => {
    setQueueFilterEventId(event.target.value);
    setNotice("");
    setError("");
  };

  const handleServeNext = async (queuePointId) => {
    setServingQueuePointId(queuePointId);
    setError("");
    setNotice("");

    try {
      const response = await serveNextQueueTicket(queuePointId);
      await refreshQueueData();
      setNotice(`Served next ticket: ${response.ticket.passId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to serve next ticket");
    } finally {
      setServingQueuePointId("");
    }
  };

  const handleStartSimulator = async () => {
    setStartingSimulator(true);
    setError("");
    setNotice("");

    try {
      const intervalSeconds = Number(simulatorIntervalInput || 15);
      const response = await startSimulator(intervalSeconds);
      setSimulator(response.simulator || defaultSimulator);
      setNotice("Simulation started for auto crowd and wait-time updates");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start simulator");
    } finally {
      setStartingSimulator(false);
    }
  };

  const handleStopSimulator = async () => {
    setStoppingSimulator(true);
    setError("");
    setNotice("");

    try {
      const response = await stopSimulator();
      setSimulator(response.simulator || defaultSimulator);
      setNotice("Simulation stopped");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to stop simulator");
    } finally {
      setStoppingSimulator(false);
    }
  };

  const handleSendBroadcast = async (event) => {
    event.preventDefault();

    const title = broadcastForm.title.trim();
    const message = broadcastForm.message.trim();

    if (!broadcastForm.eventId) {
      setError("Please select an event for broadcast");
      return;
    }

    if (!title || !message) {
      setError("Broadcast title and message are required");
      return;
    }

    setSendingBroadcast(true);
    setError("");
    setNotice("");

    try {
      const response = await sendEventBroadcast(broadcastForm.eventId, {
        title,
        message,
        audience: broadcastForm.audience,
        type: "event-broadcast",
      });

      setNotice(
        `Broadcast sent to ${response.broadcast.recipients} user(s) for ${response.broadcast.eventTitle}`
      );

      setBroadcastForm((current) => ({
        ...current,
        title: "",
        message: "",
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading command center...</p>;
  }

  if (!summary) {
    return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error || "No data available"}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Real-Time Command Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Live registration, check-in, queue analytics, and simulated operations controls.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm text-brand-700">Active Events</p>
          <p className="mt-2 font-display text-3xl font-semibold text-brand-900">
            {summary.metrics.activeEvents}
          </p>
        </article>
        <article className="rounded-2xl border border-sunrise-200 bg-sunrise-200/40 p-4">
          <p className="text-sm text-sunrise-700">Total Registrations</p>
          <p className="mt-2 font-display text-3xl font-semibold text-sunrise-700">
            {summary.metrics.totalRegistrations}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Checked In</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-700">
            {summary.metrics.totalCheckedIn}
          </p>
        </article>
        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm text-violet-700">Total Waiting</p>
          <p className="mt-2 font-display text-3xl font-semibold text-violet-700">
            {queueOverview.metrics.totalWaiting}
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-sm text-cyan-700">Served Tickets</p>
          <p className="mt-2 font-display text-3xl font-semibold text-cyan-700">
            {queueAnalytics.metrics.totalServed}
          </p>
        </article>
        <article className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-orange-700">Avg Wait (min)</p>
          <p className="mt-2 font-display text-3xl font-semibold text-orange-700">
            {queueAnalytics.metrics.averageWaitMinutes}
          </p>
        </article>
        <article className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4">
          <p className="text-sm text-fuchsia-700">Busiest Point</p>
          <p className="mt-2 text-lg font-semibold text-fuchsia-700">
            {queueAnalytics.metrics.busiestPointName || "N/A"}
          </p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Live Feed</h2>
          <div className="mt-3 space-y-3">
            {feed.length === 0 ? (
              <p className="text-sm text-slate-500">No live updates received yet.</p>
            ) : (
              feed.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.type}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {item.payload.eventTitle || item.payload.message || "Live update"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Simulator Controls</h2>
          <p className="mt-1 text-sm text-slate-600">
            Auto-update crowd intensity and queue wait-time using simulated data.
          </p>

          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p>Running: {simulator.running ? "Yes" : "No"}</p>
            <p>Interval: {simulator.intervalSeconds}s</p>
            <p>Ticks: {simulator.tickCount}</p>
            <p>
              Last Tick: {simulator.lastTickAt ? formatDateTime(simulator.lastTickAt) : "Not started"}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Interval (seconds)</span>
              <input
                type="number"
                min={3}
                max={120}
                value={simulatorIntervalInput}
                onChange={(event) => setSimulatorIntervalInput(event.target.value)}
                className="w-32 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
            <button
              type="button"
              onClick={handleStartSimulator}
              disabled={startingSimulator}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {startingSimulator ? "Starting..." : "Start Simulator"}
            </button>
            <button
              type="button"
              onClick={handleStopSimulator}
              disabled={stoppingSimulator}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {stoppingSimulator ? "Stopping..." : "Stop Simulator"}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Queue Throughput Chart</h2>
        <p className="mt-1 text-sm text-slate-600">
          Throughput, served count, and average wait-time per queue point.
        </p>

        <div className="mt-3 max-w-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Analytics Scope</span>
            <select
              value={queueFilterEventId}
              onChange={handleQueueFilterChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              <option value="">All Events</option>
              {eventOptions.map((eventOption) => (
                <option key={eventOption.eventId} value={eventOption.eventId}>
                  {eventOption.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {queueAnalytics.perPoint.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No queue analytics data yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {queueAnalytics.perPoint.map((point) => {
              const width = Math.max(8, Math.round((point.throughput / maxThroughput) * 100));

              return (
                <article key={point.queuePointId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{point.pointName}</p>
                    <p className="text-xs text-slate-500">{point.eventTitle}</p>
                  </div>

                  <div className="mt-2 h-3 rounded-full bg-slate-200">
                    <div
                      className="h-3 rounded-full bg-brand-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
                    <p>Throughput: {point.throughput}</p>
                    <p>Served: {point.servedCount}</p>
                    <p>Waiting: {point.waitingCount}</p>
                    <p>Avg Wait: {point.averageWaitMinutes} min</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">User Broadcast Alerts</h2>
        <p className="mt-1 text-sm text-slate-600">
          Send immediate announcements to users linked to this event by registration email.
        </p>

        <form onSubmit={handleSendBroadcast} className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Event</span>
            <select
              name="eventId"
              value={broadcastForm.eventId}
              onChange={handleBroadcastFieldChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {eventOptions.map((eventOption) => (
                <option key={eventOption.eventId} value={eventOption.eventId}>
                  {eventOption.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Audience</span>
            <select
              name="audience"
              value={broadcastForm.audience}
              onChange={handleBroadcastFieldChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              <option value="all-registrants">All Registrants</option>
              <option value="checked-in">Checked-In Only</option>
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
            <input
              name="title"
              value={broadcastForm.title}
              onChange={handleBroadcastFieldChange}
              placeholder="Gate A is now faster for entry"
              maxLength={160}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              name="message"
              value={broadcastForm.message}
              onChange={handleBroadcastFieldChange}
              placeholder="Use Gate A for quicker access. Follow volunteer signs near the main lawn."
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={sendingBroadcast}
              className="rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sendingBroadcast ? "Sending..." : "Send Broadcast"}
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Update Crowd Status</h2>
          <form className="mt-4 space-y-3" onSubmit={handleLiveOpsSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Event</span>
              <select
                name="eventId"
                value={crowdForm.eventId}
                onChange={handleCrowdFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {eventOptions.map((eventOption) => (
                  <option key={eventOption.eventId} value={eventOption.eventId}>
                    {eventOption.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Crowd Level</span>
              <select
                name="crowdLevel"
                value={crowdForm.crowdLevel}
                onChange={handleCrowdFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Entry Gate Status</span>
              <select
                name="entryGateStatus"
                value={crowdForm.entryGateStatus}
                onChange={handleCrowdFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="open">Open</option>
                <option value="busy">Busy</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Ops Note</span>
              <input
                name="note"
                value={crowdForm.note}
                onChange={handleCrowdFieldChange}
                placeholder="Gate B slower due to security check"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <button
              type="submit"
              disabled={updatingCrowd}
              className="rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {updatingCrowd ? "Updating..." : "Update Live Status"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Queue and Wait-Time Board</h2>
          <p className="mt-1 text-sm text-slate-600">Points: {queueOverview.metrics.queuePoints}</p>

          {queueOverview.queuePoints.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No queue points created yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {queueOverview.queuePoints.map((point) => (
                <article
                  key={point.queuePointId}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{point.pointName}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {point.pointType} • {point.eventTitle}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {point.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                    <p>Waiting: {point.waitingCount}</p>
                    <p>ETA: {point.estimatedWaitMinutes} min</p>
                    <p>Manual Wait: {point.manualWaitTimeMinutes} min</p>
                  </div>

                  {point.note ? <p className="mt-2 text-sm text-slate-600">{point.note}</p> : null}

                  <button
                    type="button"
                    onClick={() => handleServeNext(point.queuePointId)}
                    disabled={servingQueuePointId === point.queuePointId}
                    className="mt-3 rounded-full border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {servingQueuePointId === point.queuePointId
                      ? "Serving..."
                      : "Serve Next Ticket"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleCreateQueuePoint} className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Create Queue Point</h2>

          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Event</span>
              <select
                name="eventId"
                value={queueCreateForm.eventId}
                onChange={handleQueueCreateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {eventOptions.map((eventOption) => (
                  <option key={eventOption.eventId} value={eventOption.eventId}>
                    {eventOption.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Queue Type</span>
              <select
                name="pointType"
                value={queueCreateForm.pointType}
                onChange={handleQueueCreateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="entry">Entry Gate</option>
                <option value="food">Food Stall</option>
                <option value="restroom">Restroom</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Point Name</span>
              <input
                name="pointName"
                value={queueCreateForm.pointName}
                onChange={handleQueueCreateChange}
                placeholder="Gate B"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
              <select
                name="status"
                value={queueCreateForm.status}
                onChange={handleQueueCreateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="free">Free</option>
                <option value="normal">Normal</option>
                <option value="busy">Busy</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Manual Wait (minutes)</span>
              <input
                type="number"
                min={0}
                name="manualWaitTimeMinutes"
                value={queueCreateForm.manualWaitTimeMinutes}
                onChange={handleQueueCreateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creatingQueuePoint}
            className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creatingQueuePoint ? "Creating..." : "Create Queue Point"}
          </button>
        </form>

        <form onSubmit={handleUpdateQueuePoint} className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Update Queue Point</h2>

          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Queue Point</span>
              <select
                name="queuePointId"
                value={queueUpdateForm.queuePointId}
                onChange={handleQueuePointSelection}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {queuePointOptions.map((queuePoint) => (
                  <option key={queuePoint.queuePointId} value={queuePoint.queuePointId}>
                    {queuePoint.pointName} ({queuePoint.eventTitle})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
              <select
                name="status"
                value={queueUpdateForm.status}
                onChange={handleQueueUpdateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="free">Free</option>
                <option value="normal">Normal</option>
                <option value="busy">Busy</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Manual Wait (minutes)</span>
              <input
                type="number"
                min={0}
                name="manualWaitTimeMinutes"
                value={queueUpdateForm.manualWaitTimeMinutes}
                onChange={handleQueueUpdateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Note</span>
              <input
                name="note"
                value={queueUpdateForm.note}
                onChange={handleQueueUpdateChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                checked={queueUpdateForm.isActive}
                onChange={handleQueueUpdateChange}
              />
              Queue point is active
            </label>
          </div>

          <button
            type="submit"
            disabled={updatingQueuePoint}
            className="mt-4 rounded-full border border-brand-300 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {updatingQueuePoint ? "Updating..." : "Update Queue Point"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminCommandCenterPage;
