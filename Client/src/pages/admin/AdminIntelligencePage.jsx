import { useEffect, useMemo, useState } from "react";
import {
  getAdminEvents,
  getAdminIntelligenceInsights,
} from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const levelBadgeClass = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const bucketLabel = (bucket) => {
  if (!bucket?.startAt) {
    return "-";
  }

  return new Date(bucket.startAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminIntelligencePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [insights, setInsights] = useState(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = async () => {
    const data = await getAdminEvents();
    const nextEvents = Array.isArray(data) ? data : [];

    setEvents(nextEvents);

    if (nextEvents.length > 0) {
      setSelectedEventId((current) => current || nextEvents[0]._id);
    }
  };

  const loadInsights = async (eventId) => {
    if (!eventId) {
      setInsights(null);
      return;
    }

    const data = await getAdminIntelligenceInsights(eventId);
    setInsights(data);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await loadEvents();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load intelligence workspace");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    loadInsights(selectedEventId).catch((err) => {
      setError(err.response?.data?.message || "Unable to load intelligence insights");
    });
  }, [selectedEventId]);

  const maxCheckInBucket = useMemo(() => {
    const values = insights?.historicalSnapshots?.checkInsPer15Minutes?.map((item) => item.count) || [];
    return values.length ? Math.max(...values, 1) : 1;
  }, [insights]);

  const maxJoinBucket = useMemo(() => {
    const values = insights?.historicalSnapshots?.queueJoinsPer15Minutes?.map((item) => item.count) || [];
    return values.length ? Math.max(...values, 1) : 1;
  }, [insights]);

  if (loading) {
    return <p className="text-slate-600">Loading intelligence workspace...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Intelligence Insights</h1>
          <p className="mt-2 text-sm text-slate-600">
            Rule-based guidance using registrations, queue flow, check-ins, and live operations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedEventId) {
              return;
            }

            setRefreshing(true);
            setNotice("");
            setError("");

            loadInsights(selectedEventId)
              .then(() => setNotice("Insights refreshed"))
              .catch((err) => setError(err.response?.data?.message || "Unable to refresh insights"))
              .finally(() => setRefreshing(false));
          }}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={refreshing || !selectedEventId}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-medium text-slate-700">Event Scope</span>
          <select
            value={selectedEventId}
            onChange={(eventHandle) => setSelectedEventId(eventHandle.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          >
            {events.map((eventItem) => (
              <option key={eventItem._id} value={eventItem._id}>
                {eventItem.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!insights ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">
          Select an event to load intelligence insights.
        </p>
      ) : (
        <>
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <article>
              <p className="text-xs uppercase tracking-wide text-slate-500">Registrations</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{insights.telemetry.registrationsTotal}</p>
              <p className="mt-1 text-xs text-slate-500">+{insights.telemetry.registrationsLast60m} in last 60 min</p>
            </article>
            <article>
              <p className="text-xs uppercase tracking-wide text-slate-500">Check-ins</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{insights.telemetry.checkedInTotal}</p>
              <p className="mt-1 text-xs text-slate-500">+{insights.telemetry.checkedInLast60m} in last 60 min</p>
            </article>
            <article>
              <p className="text-xs uppercase tracking-wide text-slate-500">Entry Waiting</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{insights.telemetry.entryQueueWaiting}</p>
              <p className="mt-1 text-xs text-slate-500">Across {insights.telemetry.entryQueueCount} gates</p>
            </article>
            <article>
              <p className="text-xs uppercase tracking-wide text-slate-500">Minutes to Start</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{insights.telemetry.minutesToStart}</p>
              <p className="mt-1 text-xs text-slate-500">Updated {formatDateTime(insights.generatedAt)}</p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">Gate Ranking</h2>
              {insights.insights.gate?.available ? (
                <div className="mt-3 space-y-2">
                  {insights.insights.gate.rankedGates.map((gate) => (
                    <div key={gate.queuePointId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{gate.pointName}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        ETA {gate.estimatedWaitMinutes} min • Waiting {gate.waitingCount} • Score {gate.score}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">{insights.insights.gate?.summary}</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">Rush Forecast</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                <span
                  className={`rounded-full px-3 py-1 ${
                    levelBadgeClass[insights.insights.rushPrediction.current] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  Now: {insights.insights.rushPrediction.current}
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    levelBadgeClass[insights.insights.rushPrediction.next30Minutes] ||
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  +30 min: {insights.insights.rushPrediction.next30Minutes}
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    levelBadgeClass[insights.insights.rushPrediction.next60Minutes] ||
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  +60 min: {insights.insights.rushPrediction.next60Minutes}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-700">Trend: {insights.insights.rushPrediction.trend}</p>

              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {(insights.insights.rushPrediction.reasons || []).map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Arrival Window Guidance</h2>
            <p className="mt-2 text-sm text-slate-700">{insights.insights.arrivalWindow.summary}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
              <p>Event Start: {formatDateTime(insights.event.date)}</p>
              <p>Window Start: {formatDateTime(insights.insights.arrivalWindow.window.startAt)}</p>
              <p>Window End: {formatDateTime(insights.insights.arrivalWindow.window.endAt)}</p>
              <p>Lead: {insights.insights.arrivalWindow.suggestedLeadMinutes} min</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">Check-in Velocity (15 min buckets)</h2>
              <div className="mt-3 space-y-2">
                {(insights.historicalSnapshots.checkInsPer15Minutes || []).map((bucket) => (
                  <div key={bucket.startAt} className="grid grid-cols-[58px_1fr_32px] items-center gap-2 text-xs">
                    <span className="text-slate-500">{bucketLabel(bucket)}</span>
                    <div className="h-2 rounded bg-slate-200">
                      <div
                        className="h-2 rounded bg-brand-500"
                        style={{ width: `${Math.max((bucket.count / maxCheckInBucket) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-right text-slate-600">{bucket.count}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">Queue Join Velocity (15 min buckets)</h2>
              <div className="mt-3 space-y-2">
                {(insights.historicalSnapshots.queueJoinsPer15Minutes || []).map((bucket) => (
                  <div key={bucket.startAt} className="grid grid-cols-[58px_1fr_32px] items-center gap-2 text-xs">
                    <span className="text-slate-500">{bucketLabel(bucket)}</span>
                    <div className="h-2 rounded bg-slate-200">
                      <div
                        className="h-2 rounded bg-sunrise-700"
                        style={{ width: `${Math.max((bucket.count / maxJoinBucket) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-right text-slate-600">{bucket.count}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminIntelligencePage;
