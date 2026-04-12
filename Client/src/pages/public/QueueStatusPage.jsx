import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getEventQueues,
  getQueueTicketStatus,
  joinEventQueue,
} from "../../api/publicApi";
import { formatDateTime } from "../../utils/date";

const QueueStatusPage = () => {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [queueData, setQueueData] = useState({ event: null, queuePoints: [] });
  const [ticketState, setTicketState] = useState(null);
  const [joining, setJoining] = useState(false);

  const [joinForm, setJoinForm] = useState({
    queuePointId: "",
    passId: "",
  });

  const loadQueues = async () => {
    const data = await getEventQueues(eventId);
    setQueueData(data);

    if (data.queuePoints.length > 0) {
      setJoinForm((current) => ({
        ...current,
        queuePointId: current.queuePointId || data.queuePoints[0].queuePointId,
      }));
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await loadQueues();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load queue details");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [eventId]);

  useEffect(() => {
    if (!ticketState?.ticketId || ticketState.status !== "waiting") {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const response = await getQueueTicketStatus(ticketState.ticketId);
        setTicketState(response.ticket);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to refresh ticket status");
      }
    }, 8000);

    return () => clearInterval(timer);
  }, [ticketState]);

  const handleJoinChange = (event) => {
    const { name, value } = event.target;
    setJoinForm((current) => ({ ...current, [name]: value }));
  };

  const handleJoinQueue = async (event) => {
    event.preventDefault();

    if (!joinForm.queuePointId || !joinForm.passId.trim()) {
      setError("Queue point and pass ID are required");
      return;
    }

    setJoining(true);
    setError("");
    setNotice("");

    try {
      const response = await joinEventQueue(eventId, joinForm.queuePointId, {
        passId: joinForm.passId.trim(),
      });

      setTicketState(response.ticket);
      setNotice(`Joined queue at ${response.queuePoint.pointName}`);
      setJoinForm((current) => ({
        ...current,
        passId: "",
      }));
      await loadQueues();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to join queue");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading queue and wait-time board...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Queue and Wait-Time Board</h1>
        <p className="mt-2 text-sm text-slate-600">
          Live wait-times for entry gates, food stalls, and restrooms.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      {queueData.event ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">{queueData.event.title}</p>
          <p className="mt-1 text-sm text-slate-600">{queueData.event.venue}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(queueData.event.date)}</p>
        </article>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Live Queue Points</h2>

          {queueData.queuePoints.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No queue points are configured yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {queueData.queuePoints.map((point) => (
                <article key={point.queuePointId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{point.pointName}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{point.pointType}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {point.status}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                    <p>Waiting: {point.waitingCount}</p>
                    <p>ETA: {point.estimatedWaitMinutes} min</p>
                    <p>Manual: {point.manualWaitTimeMinutes} min</p>
                  </div>
                  {point.note ? <p className="mt-2 text-sm text-slate-600">{point.note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <form onSubmit={handleJoinQueue} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Join Virtual Queue</h2>
            <p className="mt-1 text-sm text-slate-600">Use your event pass ID to join a queue point.</p>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Queue Point</span>
              <select
                name="queuePointId"
                value={joinForm.queuePointId}
                onChange={handleJoinChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {queueData.queuePoints.map((point) => (
                  <option key={point.queuePointId} value={point.queuePointId}>
                    {point.pointName} ({point.pointType})
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Pass ID</span>
              <input
                name="passId"
                value={joinForm.passId}
                onChange={handleJoinChange}
                placeholder="PASS-XXXX"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <button
              type="submit"
              disabled={joining}
              className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {joining ? "Joining..." : "Join Queue"}
            </button>
          </form>

          {ticketState ? (
            <article className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your Queue Ticket</p>
              <p className="mt-2 text-sm text-brand-900">Ticket ID: {ticketState.ticketId}</p>
              <p className="mt-1 text-sm text-brand-900">Pass ID: {ticketState.passId}</p>
              <p className="mt-1 text-sm text-brand-900">Status: {ticketState.status}</p>
              <p className="mt-1 text-sm text-brand-900">Position: {ticketState.position}</p>
            </article>
          ) : null}
        </section>
      </div>

      <div>
        <Link
          to={`/events/${eventId}`}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to Event Details
        </Link>
      </div>
    </div>
  );
};

export default QueueStatusPage;
