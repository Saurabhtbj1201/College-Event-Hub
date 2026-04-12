import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getEventNavigation, getEventRouteHint } from "../../api/publicApi";

const NavigationPage = () => {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [navigation, setNavigation] = useState(null);
  const [routeHint, setRouteHint] = useState(null);

  const [routeForm, setRouteForm] = useState({
    fromCode: "",
    toCode: "",
  });

  const zones = useMemo(() => navigation?.zones || [], [navigation]);

  useEffect(() => {
    const loadNavigation = async () => {
      try {
        setLoading(true);
        const response = await getEventNavigation(eventId);
        const nav = response.navigation;
        setNavigation(nav);

        if (nav.zones.length >= 2) {
          setRouteForm((current) => ({
            ...current,
            fromCode: current.fromCode || nav.zones[0].code,
            toCode: current.toCode || nav.zones[1].code,
          }));
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load smart navigation map");
      } finally {
        setLoading(false);
      }
    };

    loadNavigation();
  }, [eventId]);

  const handleRouteFormChange = (event) => {
    const { name, value } = event.target;
    setRouteForm((current) => ({ ...current, [name]: value }));
  };

  const handleFindRoute = async (event) => {
    event.preventDefault();

    if (!routeForm.fromCode || !routeForm.toCode) {
      setError("Please select both From and To zones");
      return;
    }

    try {
      setError("");
      const response = await getEventRouteHint(eventId, routeForm.fromCode, routeForm.toCode);
      setRouteHint(response.routeHint);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch route hint");
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading smart navigation map...</p>;
  }

  if (!navigation) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-red-50 p-3 text-red-700">{error || "Navigation data unavailable"}</p>
        <Link to={`/events/${eventId}`} className="text-brand-700">
          Back to Event
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Smart Navigation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Interactive venue zones and route hints to reduce crowd confusion.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">{navigation.title}</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          <svg
            viewBox={`0 0 ${navigation.canvas?.width || 860} ${navigation.canvas?.height || 480}`}
            className="h-auto w-full min-w-[680px]"
            role="img"
            aria-label="Venue map"
          >
            <rect
              x="0"
              y="0"
              width={navigation.canvas?.width || 860}
              height={navigation.canvas?.height || 480}
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="2"
              rx="18"
            />

            {zones.map((zone) => (
              <g key={zone.code}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill={zone.color || "#8ad1bf"}
                  stroke="#334155"
                  strokeWidth="1.2"
                  rx="10"
                />
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + zone.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill="#0f172a"
                  fontWeight="600"
                >
                  {zone.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <p key={zone.code} className="rounded-lg border border-slate-200 px-2 py-1">
              {zone.code} - {zone.label}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Route Hint Finder</h2>
        <form onSubmit={handleFindRoute} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">From</span>
            <select
              name="fromCode"
              value={routeForm.fromCode}
              onChange={handleRouteFormChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {zones.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} ({zone.label})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">To</span>
            <select
              name="toCode"
              value={routeForm.toCode}
              onChange={handleRouteFormChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {zones.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} ({zone.label})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              Find Route
            </button>
          </div>
        </form>

        {routeHint ? (
          <article className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              {routeHint.fromCode} to {routeHint.toCode}
            </p>
            <p className="mt-1 text-sm text-brand-900">Estimated Time: {routeHint.estimatedMinutes} minutes</p>
            <p className="mt-1 text-sm text-brand-900">
              Crowd Advice: {routeHint.crowdRecommendation || "normal"}
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-brand-900">
              {routeHint.instructions?.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ) : null}
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

export default NavigationPage;
