import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicEvents } from "../../api/publicApi";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/date";

const HomePage = () => {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await getPublicEvents();
        setEvents(data);
      } catch (err) {
        const message = err.response?.data?.message || "Unable to load events right now";
        setError(message);
        toast.error(message, "Events unavailable");
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-sunrise-200 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-sunrise-700">
          Public Events Portal
        </p>
        <h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
          Discover campus events and grab your pass in minutes
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Browse all available college events, view details, and register instantly without creating an account.
        </p>
      </section>

      {loading ? (
        <p role="status" aria-live="polite" className="text-slate-600">
          Loading events...
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">No events are currently available.</p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <article
            key={event._id}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
          >
            <p className="text-sm font-medium text-brand-700">{formatDateTime(event.date)}</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{event.venue}</p>
            <p className="mt-4 line-clamp-3 text-sm text-slate-700">{event.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                Capacity {event.capacity}
              </span>
              <Link
                to={`/events/${event._id}`}
                className="text-sm font-semibold text-brand-700 transition group-hover:text-brand-900"
              >
                View details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
