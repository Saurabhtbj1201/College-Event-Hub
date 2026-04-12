import { useEffect, useState } from "react";
import { getAdminEvents, getRegistrations } from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const AdminDashboardPage = () => {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [eventsData, registrationsData] = await Promise.all([getAdminEvents(), getRegistrations()]);
        setEvents(eventsData);
        setRegistrations(registrationsData);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return <p className="text-slate-600">Loading dashboard...</p>;
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-slate-900">Overview</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm text-brand-700">Total Events</p>
          <p className="mt-2 font-display text-3xl font-semibold text-brand-900">{events.length}</p>
        </article>

        <article className="rounded-2xl border border-sunrise-200 bg-sunrise-200/40 p-4">
          <p className="text-sm text-sunrise-700">Total Registrations</p>
          <p className="mt-2 font-display text-3xl font-semibold text-sunrise-700">{registrations.length}</p>
        </article>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-slate-900">Recent Events</h2>
        {events.length === 0 ? (
          <p className="rounded-xl border border-slate-200 p-4 text-slate-600">No events created yet.</p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <article key={event._id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{event.title}</p>
                <p className="mt-1 text-sm text-slate-600">{event.venue}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.date)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboardPage;
