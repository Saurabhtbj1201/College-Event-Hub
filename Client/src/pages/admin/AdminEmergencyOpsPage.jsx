import { useEffect, useState } from "react";
import {
  getAdminEvents,
  getAdminSocialGroups,
  getEmergencyIncidents,
  sendEmergencyBroadcast,
  updateEmergencyIncident,
} from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const INCIDENT_STATUSES = ["open", "acknowledged", "resolved", "dismissed"];
const BROADCAST_SEVERITIES = ["info", "warning", "critical"];

const AdminEmergencyOpsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [incidents, setIncidents] = useState([]);
  const [incidentMetrics, setIncidentMetrics] = useState({ total: 0, byStatus: {} });
  const [incidentFilterStatus, setIncidentFilterStatus] = useState("");
  const [incidentStatusDraft, setIncidentStatusDraft] = useState({});

  const [socialGroups, setSocialGroups] = useState([]);

  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    severity: "warning",
    zoneCode: "",
  });

  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [updatingIncidentId, setUpdatingIncidentId] = useState("");

  const loadEvents = async () => {
    const data = await getAdminEvents();
    const nextEvents = Array.isArray(data) ? data : [];
    setEvents(nextEvents);

    if (nextEvents.length > 0) {
      setSelectedEventId((current) => current || nextEvents[0]._id);
    }
  };

  const loadEmergencyData = async (eventId, statusFilter = "") => {
    if (!eventId) {
      setIncidents([]);
      setIncidentMetrics({ total: 0, byStatus: {} });
      setSocialGroups([]);
      return;
    }

    const [incidentData, groupData] = await Promise.all([
      getEmergencyIncidents(eventId, { status: statusFilter || undefined }),
      getAdminSocialGroups(eventId, { activeOnly: true }),
    ]);

    const nextIncidents = Array.isArray(incidentData.incidents) ? incidentData.incidents : [];
    setIncidents(nextIncidents);
    setIncidentMetrics(incidentData.metrics || { total: 0, byStatus: {} });
    setSocialGroups(Array.isArray(groupData.groups) ? groupData.groups : []);

    setIncidentStatusDraft((current) => {
      const draft = { ...current };
      nextIncidents.forEach((incident) => {
        if (!draft[incident.incidentId]) {
          draft[incident.incidentId] = incident.status;
        }
      });
      return draft;
    });
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await loadEvents();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load emergency operations");
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

    loadEmergencyData(selectedEventId, incidentFilterStatus).catch((err) => {
      setError(err.response?.data?.message || "Unable to refresh emergency data");
    });
  }, [selectedEventId, incidentFilterStatus]);

  const handleUpdateIncident = async (incident) => {
    const nextStatus = incidentStatusDraft[incident.incidentId] || incident.status;

    if (nextStatus === incident.status) {
      setNotice("Incident status is unchanged");
      return;
    }

    setUpdatingIncidentId(incident.incidentId);
    setError("");

    try {
      await updateEmergencyIncident(incident.incidentId, { status: nextStatus });
      setNotice(`Incident ${incident.incidentId.slice(-6)} moved to ${nextStatus}`);
      await loadEmergencyData(selectedEventId, incidentFilterStatus);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update incident status");
    } finally {
      setUpdatingIncidentId("");
    }
  };

  const handleBroadcast = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!selectedEventId) {
      setError("Select an event first");
      return;
    }

    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      setError("Broadcast title and message are required");
      return;
    }

    setSendingBroadcast(true);
    setError("");

    try {
      const response = await sendEmergencyBroadcast(selectedEventId, {
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        severity: broadcastForm.severity,
        zoneCode: broadcastForm.zoneCode.trim(),
      });

      setNotice(`Emergency broadcast sent to ${response.broadcast.recipients} user(s)`);
      setBroadcastForm((current) => ({ ...current, title: "", message: "" }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send emergency broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading emergency operations...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Emergency Operations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Monitor SOS incidents, send emergency broadcasts, and observe social group activity.
        </p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Emergency Broadcast</h2>

        <form onSubmit={handleBroadcast} className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Severity</span>
            <select
              value={broadcastForm.severity}
              onChange={(eventHandle) =>
                setBroadcastForm((current) => ({ ...current, severity: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {BROADCAST_SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Zone Code (optional)</span>
            <input
              value={broadcastForm.zoneCode}
              onChange={(eventHandle) =>
                setBroadcastForm((current) => ({ ...current, zoneCode: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
            <input
              value={broadcastForm.title}
              onChange={(eventHandle) =>
                setBroadcastForm((current) => ({ ...current, title: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              value={broadcastForm.message}
              onChange={(eventHandle) =>
                setBroadcastForm((current) => ({ ...current, message: eventHandle.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={sendingBroadcast}
              className="rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sendingBroadcast ? "Sending..." : "Send Emergency Broadcast"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">SOS Incidents</h2>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Status Filter
            </span>
            <select
              value={incidentFilterStatus}
              onChange={(eventHandle) => setIncidentFilterStatus(eventHandle.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">All</option>
              {INCIDENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-2 text-sm text-slate-600">Total incidents: {incidentMetrics.total || 0}</p>

        {incidents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No incidents found for this filter.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {incidents.map((incident) => (
              <article key={incident.incidentId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">Pass: {incident.passId}</p>
                    <p className="mt-1 text-sm text-slate-700">
                      Severity: {incident.severity} • Zone: {incident.zoneCode || "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(incident.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={incidentStatusDraft[incident.incidentId] || incident.status}
                      onChange={(eventHandle) =>
                        setIncidentStatusDraft((current) => ({
                          ...current,
                          [incident.incidentId]: eventHandle.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    >
                      {INCIDENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={updatingIncidentId === incident.incidentId}
                      onClick={() => handleUpdateIncident(incident)}
                      className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingIncidentId === incident.incidentId ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>

                {incident.message ? <p className="mt-2 text-sm text-slate-700">{incident.message}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Social Group Snapshot</h2>

        {socialGroups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active social groups found for this event.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {socialGroups.map((group) => (
              <article key={group.groupId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {group.groupName} ({group.groupCode})
                </p>
                <p className="mt-1 text-sm text-slate-600">Members: {group.memberCount}</p>
                <p className="mt-1 text-xs text-slate-500">{group.seatClusterSuggestion}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminEmergencyOpsPage;
