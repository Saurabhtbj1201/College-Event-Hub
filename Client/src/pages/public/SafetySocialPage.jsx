import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createSocialGroup,
  getEventNavigation,
  getNearestExit,
  getPublicEventById,
  getSocialGroup,
  joinSocialGroup,
  triggerSOS,
  updateSocialGroupLocation,
} from "../../api/publicApi";
import { useToast } from "../../contexts/ToastContext";

const SafetySocialPage = () => {
  const { eventId } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);

  const [sosForm, setSosForm] = useState({ passId: "", zoneCode: "", message: "" });
  const [sendingSos, setSendingSos] = useState(false);

  const [nearestExitFrom, setNearestExitFrom] = useState("");
  const [nearestExitData, setNearestExitData] = useState(null);
  const [loadingNearestExit, setLoadingNearestExit] = useState(false);

  const [createGroupForm, setCreateGroupForm] = useState({
    leaderPassId: "",
    groupName: "",
    preferredZoneCode: "",
    alias: "",
    consentShareLocation: true,
  });
  const [joiningGroupForm, setJoiningGroupForm] = useState({
    groupCode: "",
    passId: "",
    alias: "",
    consentShareLocation: true,
  });
  const [presenceForm, setPresenceForm] = useState({
    groupCode: "",
    passId: "",
    zoneCode: "",
    consentShareLocation: true,
  });

  const [group, setGroup] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const zoneOptions = useMemo(
    () => zones.map((zone) => ({ code: zone.code, label: zone.label })),
    [zones]
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);

        const [eventData, navigationData] = await Promise.all([
          getPublicEventById(eventId),
          getEventNavigation(eventId),
        ]);

        setEvent(eventData || null);

        const nextZones = Array.isArray(navigationData.navigation?.zones)
          ? navigationData.navigation.zones
          : [];

        setZones(nextZones);

        if (nextZones.length > 0) {
          const firstZoneCode = nextZones[0].code;
          setSosForm((current) => ({ ...current, zoneCode: current.zoneCode || firstZoneCode }));
          setNearestExitFrom((current) => current || firstZoneCode);
          setCreateGroupForm((current) => ({
            ...current,
            preferredZoneCode: current.preferredZoneCode || firstZoneCode,
          }));
          setPresenceForm((current) => ({ ...current, zoneCode: current.zoneCode || firstZoneCode }));
        }
      } catch (err) {
        const message = err.response?.data?.message || "Unable to load safety and social module";
        setError(message);
        toast.error(message, "Safety module unavailable");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [eventId]);

  const handleSos = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!sosForm.passId.trim()) {
      const message = "Pass ID is required for SOS";
      setError(message);
      toast.warning(message);
      return;
    }

    setSendingSos(true);
    setError("");
    setNotice("");

    try {
      const response = await triggerSOS(eventId, {
        passId: sosForm.passId.trim(),
        zoneCode: sosForm.zoneCode,
        message: sosForm.message,
      });

      setNotice(`SOS submitted. Incident ID: ${response.incident.incidentId}`);
      toast.success(`Incident ID ${response.incident.incidentId} has been raised.`, "SOS submitted");
      setSosForm((current) => ({ ...current, message: "" }));
    } catch (err) {
      const message = err.response?.data?.message || "Unable to submit SOS";
      setError(message);
      toast.error(message, "SOS failed");
    } finally {
      setSendingSos(false);
    }
  };

  const handleNearestExit = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!nearestExitFrom) {
      const message = "Select a source zone";
      setError(message);
      toast.warning(message);
      return;
    }

    setLoadingNearestExit(true);
    setError("");

    try {
      const response = await getNearestExit(eventId, nearestExitFrom);
      setNearestExitData(response);
      toast.info(`Nearest exit is ${response.nearestExit?.code || "available now"}.`, "Exit guidance ready");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to find nearest exit";
      setError(message);
      toast.error(message, "Exit lookup failed");
    } finally {
      setLoadingNearestExit(false);
    }
  };

  const handleCreateGroup = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!createGroupForm.leaderPassId.trim()) {
      const message = "Leader pass ID is required";
      setError(message);
      toast.warning(message);
      return;
    }

    setGroupLoading(true);
    setError("");

    try {
      const response = await createSocialGroup(eventId, {
        leaderPassId: createGroupForm.leaderPassId.trim(),
        groupName: createGroupForm.groupName,
        preferredZoneCode: createGroupForm.preferredZoneCode,
        alias: createGroupForm.alias,
        consentShareLocation: createGroupForm.consentShareLocation,
      });

      setGroup(response.group || null);
      setNotice(`Group created: ${response.group.groupCode}`);
      toast.success(`Group code ${response.group.groupCode} created successfully.`, "Social group created");

      setJoiningGroupForm((current) => ({
        ...current,
        groupCode: response.group.groupCode,
        passId: current.passId || createGroupForm.leaderPassId.trim(),
      }));

      setPresenceForm((current) => ({
        ...current,
        groupCode: response.group.groupCode,
        passId: current.passId || createGroupForm.leaderPassId.trim(),
      }));
    } catch (err) {
      const message = err.response?.data?.message || "Unable to create social group";
      setError(message);
      toast.error(message, "Create group failed");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleJoinGroup = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!joiningGroupForm.groupCode.trim() || !joiningGroupForm.passId.trim()) {
      const message = "Group code and pass ID are required";
      setError(message);
      toast.warning(message);
      return;
    }

    setGroupLoading(true);
    setError("");

    try {
      const response = await joinSocialGroup(eventId, joiningGroupForm.groupCode.trim(), {
        passId: joiningGroupForm.passId.trim(),
        alias: joiningGroupForm.alias,
        consentShareLocation: joiningGroupForm.consentShareLocation,
      });

      setGroup(response.group || null);
      setNotice(`Joined group: ${response.group.groupCode}`);
      toast.success(`You joined group ${response.group.groupCode}.`, "Group joined");

      setPresenceForm((current) => ({
        ...current,
        groupCode: response.group.groupCode,
        passId: joiningGroupForm.passId.trim(),
      }));
    } catch (err) {
      const message = err.response?.data?.message || "Unable to join social group";
      setError(message);
      toast.error(message, "Join group failed");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleUpdatePresence = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!presenceForm.groupCode.trim() || !presenceForm.passId.trim()) {
      const message = "Group code and pass ID are required for location update";
      setError(message);
      toast.warning(message);
      return;
    }

    setGroupLoading(true);
    setError("");

    try {
      const response = await updateSocialGroupLocation(
        eventId,
        presenceForm.groupCode.trim(),
        {
          passId: presenceForm.passId.trim(),
          zoneCode: presenceForm.zoneCode,
          consentShareLocation: presenceForm.consentShareLocation,
        }
      );

      setGroup(response.group || null);
      setNotice("Group location updated");
      toast.success("Group location updated successfully.", "Presence updated");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update group location";
      setError(message);
      toast.error(message, "Presence update failed");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleFetchGroup = async () => {
    if (!presenceForm.groupCode.trim() || !presenceForm.passId.trim()) {
      const message = "Group code and pass ID are required to fetch group status";
      setError(message);
      toast.warning(message);
      return;
    }

    setGroupLoading(true);
    setError("");

    try {
      const response = await getSocialGroup(
        eventId,
        presenceForm.groupCode.trim(),
        presenceForm.passId.trim()
      );

      setGroup(response.group || null);
      setNotice(`Loaded group ${response.group.groupCode}`);
      toast.info(`Fetched latest details for ${response.group.groupCode}.`, "Group loaded");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load social group";
      setError(message);
      toast.error(message, "Fetch group failed");
    } finally {
      setGroupLoading(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading safety and social module...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Safety and Social</h1>
        <p className="mt-2 text-sm text-slate-600">
          Emergency SOS, nearest-exit assistance, and consent-based group coordination.
        </p>
        {event ? <p className="mt-1 text-xs text-slate-500">{event.title}</p> : null}
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleSos} className="rounded-2xl border border-red-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Emergency SOS</h2>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Pass ID</span>
            <input
              value={sosForm.passId}
              onChange={(eventHandle) =>
                setSosForm((current) => ({ ...current, passId: eventHandle.target.value }))
              }
              placeholder="PASS-XXXX"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-red-400"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Current Zone</span>
            <select
              value={sosForm.zoneCode}
              onChange={(eventHandle) =>
                setSosForm((current) => ({ ...current, zoneCode: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-red-400"
            >
              {zoneOptions.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} ({zone.label})
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              value={sosForm.message}
              onChange={(eventHandle) =>
                setSosForm((current) => ({ ...current, message: eventHandle.target.value }))
              }
              rows={2}
              placeholder="Need immediate assistance"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-red-400"
            />
          </label>

          <button
            type="submit"
            disabled={sendingSos}
            className="mt-4 rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sendingSos ? "Sending..." : "Send SOS"}
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Nearest Exit Finder</h2>

          <form onSubmit={handleNearestExit} className="mt-3 flex flex-wrap gap-2">
            <select
              value={nearestExitFrom}
              onChange={(eventHandle) => setNearestExitFrom(eventHandle.target.value)}
              className="min-w-[220px] rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {zoneOptions.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} ({zone.label})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loadingNearestExit}
              className="rounded-full border border-brand-300 px-4 py-2 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingNearestExit ? "Finding..." : "Find Exit"}
            </button>
          </form>

          {nearestExitData ? (
            <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">
                Nearest Exit: {nearestExitData.nearestExit.code} ({nearestExitData.nearestExit.label})
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Approx Distance: {nearestExitData.nearestExit.approxDistance}
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {nearestExitData.routeHint?.instructions?.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ) : null}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleCreateGroup} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Create Group</h2>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Leader Pass ID</span>
            <input
              value={createGroupForm.leaderPassId}
              onChange={(eventHandle) =>
                setCreateGroupForm((current) => ({ ...current, leaderPassId: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Group Name</span>
              <input
                value={createGroupForm.groupName}
                onChange={(eventHandle) =>
                  setCreateGroupForm((current) => ({ ...current, groupName: eventHandle.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Preferred Zone</span>
              <select
                value={createGroupForm.preferredZoneCode}
                onChange={(eventHandle) =>
                  setCreateGroupForm((current) => ({
                    ...current,
                    preferredZoneCode: eventHandle.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {zoneOptions.map((zone) => (
                  <option key={zone.code} value={zone.code}>
                    {zone.code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Display Alias (optional)</span>
            <input
              value={createGroupForm.alias}
              onChange={(eventHandle) =>
                setCreateGroupForm((current) => ({ ...current, alias: eventHandle.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createGroupForm.consentShareLocation}
              onChange={(eventHandle) =>
                setCreateGroupForm((current) => ({
                  ...current,
                  consentShareLocation: eventHandle.target.checked,
                }))
              }
            />
            Consent to share live location
          </label>

          <button
            type="submit"
            disabled={groupLoading}
            className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {groupLoading ? "Processing..." : "Create Group"}
          </button>
        </form>

        <form onSubmit={handleJoinGroup} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Join Group</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Group Code</span>
              <input
                value={joiningGroupForm.groupCode}
                onChange={(eventHandle) =>
                  setJoiningGroupForm((current) => ({ ...current, groupCode: eventHandle.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Pass ID</span>
              <input
                value={joiningGroupForm.passId}
                onChange={(eventHandle) =>
                  setJoiningGroupForm((current) => ({ ...current, passId: eventHandle.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Display Alias (optional)</span>
              <input
                value={joiningGroupForm.alias}
                onChange={(eventHandle) =>
                  setJoiningGroupForm((current) => ({ ...current, alias: eventHandle.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={joiningGroupForm.consentShareLocation}
              onChange={(eventHandle) =>
                setJoiningGroupForm((current) => ({
                  ...current,
                  consentShareLocation: eventHandle.target.checked,
                }))
              }
            />
            Consent to share live location
          </label>

          <button
            type="submit"
            disabled={groupLoading}
            className="mt-4 rounded-full border border-brand-300 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {groupLoading ? "Processing..." : "Join Group"}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Location Presence and Group Status</h2>

        <form onSubmit={handleUpdatePresence} className="mt-3 grid gap-3 lg:grid-cols-4">
          <input
            placeholder="Group Code"
            value={presenceForm.groupCode}
            onChange={(eventHandle) =>
              setPresenceForm((current) => ({ ...current, groupCode: eventHandle.target.value }))
            }
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
          <input
            placeholder="Pass ID"
            value={presenceForm.passId}
            onChange={(eventHandle) =>
              setPresenceForm((current) => ({ ...current, passId: eventHandle.target.value }))
            }
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
          <select
            value={presenceForm.zoneCode}
            onChange={(eventHandle) =>
              setPresenceForm((current) => ({ ...current, zoneCode: eventHandle.target.value }))
            }
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          >
            {zoneOptions.map((zone) => (
              <option key={zone.code} value={zone.code}>
                {zone.code}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={presenceForm.consentShareLocation}
              onChange={(eventHandle) =>
                setPresenceForm((current) => ({
                  ...current,
                  consentShareLocation: eventHandle.target.checked,
                }))
              }
            />
            Share location
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={groupLoading}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Update
            </button>
            <button
              type="button"
              disabled={groupLoading}
              onClick={handleFetchGroup}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Fetch
            </button>
          </div>
        </form>

        {group ? (
          <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">
              {group.groupName} ({group.groupCode})
            </p>
            <p className="mt-1 text-sm text-slate-700">Members: {group.memberCount}</p>
            <p className="mt-1 text-sm text-slate-700">{group.seatClusterSuggestion}</p>

            <div className="mt-3 space-y-2">
              {group.members?.map((member) => (
                <div key={`${member.passId}-${member.joinedAt}`} className="rounded-lg bg-white px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{member.displayName}</p>
                  <p className="text-xs text-slate-600">
                    Pass: {member.passId} • Zone: {member.currentZoneCode || "hidden"}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </section>

      <div>
        <Link
          to={`/events/${eventId}`}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to Event
        </Link>
      </div>
    </div>
  );
};

export default SafetySocialPage;
