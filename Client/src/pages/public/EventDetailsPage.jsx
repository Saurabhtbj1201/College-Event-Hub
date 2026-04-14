import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicEventById } from "../../api/publicApi";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/date";

const EventDetailsPage = () => {
  const { eventId } = useParams();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const data = await getPublicEventById(eventId);
        setEvent(data);
      } catch (err) {
        const message = err.response?.data?.message || "Unable to load event details";
        setError(message);
        toast.error(message, "Event details unavailable");
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  if (loading) {
    return <p className="text-slate-600">Loading event details...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>
        <Link to="/" className="text-brand-700">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="mb-3 text-sm font-medium text-brand-700">{formatDateTime(event.date)}</p>
      <h1 className="font-display text-3xl font-semibold text-slate-900">{event.title}</h1>
      <p className="mt-2 text-slate-600">{event.venue}</p>

      <div className="mt-6 grid gap-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Capacity:</span> {event.capacity}
        </p>
        <p>
          <span className="font-semibold">Open for registration:</span> Yes
        </p>
      </div>

      <p className="mt-6 whitespace-pre-line text-slate-700">{event.description}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={`/events/${event._id}/register`}
          className="rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Register Now
        </Link>
        <Link
          to={`/events/${event._id}/queues`}
          className="rounded-full border border-brand-300 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50"
        >
          Queue and Wait Times
        </Link>
        <Link
          to={`/events/${event._id}/navigation`}
          className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Smart Navigation
        </Link>
        <Link
          to={`/events/${event._id}/food`}
          className="rounded-full border border-emerald-300 px-5 py-2.5 font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Food and Services
        </Link>
        <Link
          to={`/events/${event._id}/safety-social`}
          className="rounded-full border border-red-300 px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50"
        >
          Safety and Social
        </Link>
        <Link
          to={`/events/${event._id}/intelligence`}
          className="rounded-full border border-violet-300 px-5 py-2.5 font-semibold text-violet-700 hover:bg-violet-50"
        >
          Smart Guidance
        </Link>
        <Link to="/" className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-700">
          Back to Events
        </Link>
      </div>
    </article>
  );
};

export default EventDetailsPage;
