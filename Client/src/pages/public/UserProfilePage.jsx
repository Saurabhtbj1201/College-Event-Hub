import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUserHistory, getUserTickets } from "../../api/userApi";
import { useUserAuth } from "../../contexts/UserAuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/date";

const emptyTicketSummary = {
  totalTickets: 0,
  checkedIn: 0,
  upcoming: 0,
};

const emptyHistorySummary = {
  tickets: 0,
  queueActions: 0,
  foodOrders: 0,
  emergencies: 0,
  socialGroups: 0,
};

const UserProfilePage = () => {
  const { user } = useUserAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [ticketSummary, setTicketSummary] = useState(emptyTicketSummary);
  const [historySummary, setHistorySummary] = useState(emptyHistorySummary);
  const [tickets, setTickets] = useState([]);

  const loadProfileData = async (options = {}) => {
    const isRefresh = Boolean(options.isRefresh);

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [ticketData, historyData] = await Promise.all([
        getUserTickets(),
        getUserHistory(20),
      ]);

      setTicketSummary(ticketData.summary || emptyTicketSummary);
      setTickets(Array.isArray(ticketData.tickets) ? ticketData.tickets : []);
      setHistorySummary(historyData.summary || emptyHistorySummary);

      if (isRefresh) {
        toast.success("Your profile insights are up to date.", "Profile refreshed");
      }
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load profile data";
      setError(message);
      toast.error(message, "Profile unavailable");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  if (loading) {
    return <p className="text-slate-600">Loading your profile...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={user?.picture || "https://placehold.co/96x96/e2e8f0/334155?text=User"}
              alt={user?.name || "User"}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
            <div>
              <h1 className="font-display text-2xl font-semibold text-slate-900">My Profile</h1>
              <p className="mt-1 text-sm text-slate-600">Google-linked user identity and activity snapshot.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadProfileData({ isRefresh: true })}
            disabled={refreshing}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing ? "Refreshing..." : "Refresh Profile"}
          </button>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Account Details</h2>
          <dl className="mt-3 grid gap-3 text-sm text-slate-700">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Name</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.name || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.email || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Google ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-700">{user?.googleId || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Last Login</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Not available"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Quick Metrics</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Tickets: {ticketSummary.totalTickets}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Checked In: {ticketSummary.checkedIn}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Queue Actions: {historySummary.queueActions}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Food Orders: {historySummary.foodOrders}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Emergencies: {historySummary.emergencies}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Social Groups: {historySummary.socialGroups}</p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-slate-900">Recent Tickets</h2>

        {tickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tickets linked with your account yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tickets.slice(0, 6).map((ticket) => (
              <article key={ticket.registrationId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{ticket.event.title}</p>
                <p className="mt-1 text-xs text-slate-600">Pass: {ticket.passId}</p>
                <p className="mt-1 text-xs text-slate-600">{formatDateTime(ticket.event.date)}</p>
                <Link
                  to={`/pass/${ticket.passId}`}
                  className="mt-2 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900"
                >
                  View Pass
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/dashboard"
          className="rounded-full border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          Go to Dashboard
        </Link>
        <Link
          to="/"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Browse Events
        </Link>
      </div>
    </div>
  );
};

export default UserProfilePage;
