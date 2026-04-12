import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getUserNotifications,
  getUserTickets,
  markUserNotificationRead,
} from "../../api/userApi";
import { useUserAuth } from "../../contexts/UserAuthContext";
import { connectUserSocket, disconnectUserSocket } from "../../realtime/userSocket";
import { formatDateTime } from "../../utils/date";

const UserDashboardPage = () => {
  const { token, user, logout } = useUserAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticketSummary, setTicketSummary] = useState({
    totalTickets: 0,
    checkedIn: 0,
    upcoming: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [markingNotificationId, setMarkingNotificationId] = useState("");

  const upcomingSchedule = useMemo(() => {
    const now = Date.now();

    return [...tickets]
      .filter((ticket) => {
        const eventDate = new Date(ticket.event.date).getTime();
        return Number.isFinite(eventDate) && eventDate >= now;
      })
      .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
      .slice(0, 8);
  }, [tickets]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);

        const [ticketData, notificationData] = await Promise.all([
          getUserTickets(),
          getUserNotifications(50),
        ]);

        setTicketSummary(ticketData.summary || { totalTickets: 0, checkedIn: 0, upcoming: 0 });
        setTickets(Array.isArray(ticketData.tickets) ? ticketData.tickets : []);

        const nextNotifications = Array.isArray(notificationData.notifications)
          ? notificationData.notifications
          : [];

        setNotifications(nextNotifications);
        setUnreadCount(
          typeof notificationData.unread === "number"
            ? notificationData.unread
            : nextNotifications.filter((item) => !item.isRead).length
        );
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load user dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = connectUserSocket(token);
    if (!socket) {
      return undefined;
    }

    const eventIds = tickets
      .map((ticket) => ticket.event?.id)
      .filter((value, index, items) => value && items.indexOf(value) === index);

    if (eventIds.length > 0) {
      socket.emit("user:subscribe-events", eventIds);
    }

    const onNotification = (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 80));
      setUnreadCount((current) => current + (notification?.isRead ? 0 : 1));
      setLiveUpdates((current) => [
        {
          id: `notification-${notification.id || Date.now()}`,
          title: notification.title || "Notification",
          message: notification.message || "",
          createdAt: notification.createdAt || new Date().toISOString(),
        },
        ...current,
      ].slice(0, 30));
    };

    const onLiveUpdate = (update) => {
      setLiveUpdates((current) => [
        {
          id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: update.title || "Live event update",
          message: update.message || "",
          createdAt: update.createdAt || new Date().toISOString(),
        },
        ...current,
      ].slice(0, 30));
    };

    socket.on("user:notification", onNotification);
    socket.on("user:event-live-update", onLiveUpdate);

    return () => {
      socket.off("user:notification", onNotification);
      socket.off("user:event-live-update", onLiveUpdate);
      disconnectUserSocket();
    };
  }, [token, tickets]);

  const handleMarkRead = async (notificationId) => {
    if (!notificationId) {
      return;
    }

    try {
      setMarkingNotificationId(notificationId);
      const response = await markUserNotificationRead(notificationId);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? response.notification : item
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to mark notification as read");
    } finally {
      setMarkingNotificationId("");
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading your dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">My Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome back, {user?.name || "User"}. Your tickets, schedule, and live updates are here.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm text-brand-700">Total Tickets</p>
          <p className="mt-2 font-display text-3xl font-semibold text-brand-900">{ticketSummary.totalTickets}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Checked In</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-700">{ticketSummary.checkedIn}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-sm text-cyan-700">Upcoming</p>
          <p className="mt-2 font-display text-3xl font-semibold text-cyan-700">{ticketSummary.upcoming}</p>
        </article>
        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm text-violet-700">Unread Alerts</p>
          <p className="mt-2 font-display text-3xl font-semibold text-violet-700">{unreadCount}</p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">My Tickets</h2>

          {tickets.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No tickets linked to your Google email yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {tickets.map((ticket) => (
                <article key={ticket.registrationId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{ticket.event.title}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {ticket.ticketStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Pass ID: {ticket.passId}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateTime(ticket.event.date)} - {ticket.event.venue}</p>
                  <Link
                    to={`/pass/${ticket.passId}`}
                    className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900"
                  >
                    View Pass
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Schedule</h2>

          {upcomingSchedule.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No upcoming events in your schedule.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {upcomingSchedule.map((ticket) => (
                <li key={`${ticket.registrationId}-schedule`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-900">{ticket.event.title}</p>
                  <p>{formatDateTime(ticket.event.date)}</p>
                  <p className="text-slate-600">{ticket.event.venue}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">In-App Notifications</h2>

          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {notifications.map((notification) => (
                <article key={notification.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{notification.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        notification.isRead
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {notification.isRead ? "Read" : "Unread"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>

                  {!notification.isRead ? (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markingNotificationId === notification.id}
                      className="mt-2 rounded-full border border-brand-300 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {markingNotificationId === notification.id ? "Marking..." : "Mark as read"}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Live Updates</h2>

          {liveUpdates.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No live updates received in this session yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {liveUpdates.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UserDashboardPage;
