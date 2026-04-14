import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicIntelligenceRecommendations } from "../../api/publicApi";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/date";

const levelBadgeClass = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const SmartGuidancePage = () => {
  const { eventId } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState(null);

  const loadGuidance = async (options = {}) => {
    const response = await getPublicIntelligenceRecommendations(eventId);
    setGuidance(response);

    if (options.notify) {
      toast.info("Smart guidance has been refreshed.", "Guidance updated");
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await loadGuidance();
      } catch (err) {
        const message = err.response?.data?.message || "Unable to load smart guidance";
        setError(message);
        toast.error(message, "Smart guidance unavailable");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [eventId]);

  if (loading) {
    return <p className="text-slate-600">Loading smart guidance...</p>;
  }

  if (!guidance) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-red-50 p-3 text-red-700">{error || "Guidance unavailable"}</p>
        <Link to={`/events/${eventId}`} className="text-brand-700">
          Back to Event
        </Link>
      </div>
    );
  }

  const gate = guidance.recommendations?.gate;
  const arrivalWindow = guidance.recommendations?.arrivalWindow;
  const rush = guidance.recommendations?.rushPrediction;
  const telemetry = guidance.telemetrySnapshot || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Smart Arrival Guidance</h1>
          <p className="mt-2 text-sm text-slate-600">
            Rule-based recommendations for best gate, arrival timing, and rush forecast.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Updated at {formatDateTime(guidance.generatedAt)} for {guidance.event?.title}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            loadGuidance({ notify: true }).catch((err) => {
              const message = err.response?.data?.message || "Unable to refresh smart guidance";
              setError(message);
              toast.error(message, "Refresh failed");
            });
          }}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Registered</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{telemetry.registrationsTotal || 0}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Checked In</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{telemetry.checkedInTotal || 0}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Entry Waiting</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{telemetry.entryQueueWaiting || 0}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Live Crowd</p>
          <p className="mt-1">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                levelBadgeClass[telemetry.crowdLevel] || "bg-slate-100 text-slate-700"
              }`}
            >
              {telemetry.crowdLevel || "medium"}
            </span>
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Least-Crowded Gate Recommendation</h2>

        {gate?.available ? (
          <div className="mt-3 space-y-3">
            <article className="rounded-xl border border-brand-100 bg-brand-50 p-3">
              <p className="text-xs uppercase tracking-wide text-brand-700">Best Gate</p>
              <p className="mt-1 text-lg font-semibold text-brand-900">{gate.bestGate.pointName}</p>
              <p className="mt-1 text-sm text-brand-900">
                ETA {gate.bestGate.estimatedWaitMinutes} min • Waiting {gate.bestGate.waitingCount}
              </p>
              <p className="mt-1 text-xs text-brand-700">{gate.bestGate.rationale}</p>
            </article>

            {gate.alternatives?.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Alternatives</p>
                <div className="space-y-2">
                  {gate.alternatives.map((item) => (
                    <p key={item.queuePointId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {item.pointName} - ETA {item.estimatedWaitMinutes} min (waiting {item.waitingCount})
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{gate?.summary || "No gate guidance available yet."}</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Best Arrival Window</h2>
          <p className="mt-2 text-sm text-slate-700">{arrivalWindow?.summary}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>Event starts: {formatDateTime(guidance.event?.date)}</p>
            <p>Recommended from: {formatDateTime(arrivalWindow?.window?.startAt)}</p>
            <p>Recommended to: {formatDateTime(arrivalWindow?.window?.endAt)}</p>
            <p>Lead time: {arrivalWindow?.suggestedLeadMinutes || 0} minutes</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Rush Forecast</h2>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
            <span
              className={`rounded-full px-3 py-1 ${
                levelBadgeClass[rush?.current] || "bg-slate-100 text-slate-700"
              }`}
            >
              Now: {rush?.current || "unknown"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                levelBadgeClass[rush?.next30Minutes] || "bg-slate-100 text-slate-700"
              }`}
            >
              +30 min: {rush?.next30Minutes || "unknown"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                levelBadgeClass[rush?.next60Minutes] || "bg-slate-100 text-slate-700"
              }`}
            >
              +60 min: {rush?.next60Minutes || "unknown"}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-700">Trend: {rush?.trend || "steady"}</p>

          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {(rush?.reasons || []).map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </article>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/events/${eventId}`}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to Event
        </Link>
        <Link
          to={`/events/${eventId}/queues`}
          className="rounded-full border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700"
        >
          View Queue Board
        </Link>
      </div>
    </div>
  );
};

export default SmartGuidancePage;
