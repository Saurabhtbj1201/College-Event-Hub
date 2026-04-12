import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getFoodCatalog,
  getFoodOrderStatus,
  placeFoodOrder,
} from "../../api/publicApi";
import { formatDateTime } from "../../utils/date";

const TERMINAL_ORDER_STATUSES = ["picked-up", "cancelled"];

const FoodServicesPage = () => {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [event, setEvent] = useState(null);
  const [stalls, setStalls] = useState([]);
  const [selectedStallId, setSelectedStallId] = useState("");

  const [passId, setPassId] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState({});
  const [placingOrder, setPlacingOrder] = useState(false);

  const [latestOrder, setLatestOrder] = useState(null);
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [trackingPassId, setTrackingPassId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(false);

  const selectedStall = useMemo(
    () => stalls.find((stall) => stall.stallId === selectedStallId) || null,
    [stalls, selectedStallId]
  );

  const selectedItems = useMemo(() => selectedStall?.items || [], [selectedStall]);

  const previewTotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const quantity = Number(quantities[item.itemId] || 0);
        return sum + quantity * Number(item.price || 0);
      }, 0),
    [selectedItems, quantities]
  );

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const response = await getFoodCatalog(eventId);

        const nextStalls = Array.isArray(response.stalls) ? response.stalls : [];

        setEvent(response.event || null);
        setStalls(nextStalls);

        if (nextStalls.length > 0) {
          setSelectedStallId((current) => current || nextStalls[0].stallId);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load food catalog");
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [eventId]);

  useEffect(() => {
    if (!trackedOrder || !trackingOrderId || !trackingPassId) {
      return undefined;
    }

    if (TERMINAL_ORDER_STATUSES.includes(trackedOrder.status)) {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const response = await getFoodOrderStatus(trackingOrderId, trackingPassId.trim());
        setTrackedOrder(response.order || null);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to refresh order status");
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [trackedOrder, trackingOrderId, trackingPassId]);

  const handleQuantityChange = (itemId, value) => {
    const parsed = Math.max(0, Math.min(20, Number(value || 0)));

    setQuantities((current) => ({
      ...current,
      [itemId]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const handlePlaceOrder = async (eventHandle) => {
    eventHandle.preventDefault();

    const normalizedPassId = passId.trim().toUpperCase();

    if (!normalizedPassId) {
      setError("Pass ID is required to place food order");
      return;
    }

    if (!selectedStallId) {
      setError("Please select a stall");
      return;
    }

    const orderItems = Object.entries(quantities)
      .map(([itemId, quantity]) => ({
        itemId,
        quantity: Number(quantity || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (orderItems.length === 0) {
      setError("Select at least one menu item quantity");
      return;
    }

    setPlacingOrder(true);
    setError("");
    setNotice("");

    try {
      const response = await placeFoodOrder(eventId, {
        passId: normalizedPassId,
        stallId: selectedStallId,
        notes,
        items: orderItems,
      });

      setLatestOrder(response.order || null);
      setTrackedOrder(response.order || null);
      setTrackingOrderId(response.order?.orderId || "");
      setTrackingPassId(normalizedPassId);
      setNotice(`Order ${response.order?.orderNumber || ""} placed successfully`);
      setQuantities({});
      setNotes("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to place food order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleTrackOrder = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!trackingOrderId.trim() || !trackingPassId.trim()) {
      setError("Order ID and Pass ID are required to track order");
      return;
    }

    setCheckingOrder(true);
    setError("");

    try {
      const response = await getFoodOrderStatus(
        trackingOrderId.trim(),
        trackingPassId.trim().toUpperCase()
      );
      setTrackedOrder(response.order || null);
      setNotice(`Order ${response.order?.orderNumber || ""} status refreshed`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch order status");
    } finally {
      setCheckingOrder(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading food and services catalog...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Food and Services</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pre-order from event stalls and track pickup progress in real time.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      {event ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">{event.title}</p>
          <p className="mt-1 text-sm text-slate-600">{event.venue}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.date)}</p>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Stalls and Menu</h2>

          {stalls.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No food stalls are published yet for this event.</p>
          ) : (
            <>
              <label className="mt-3 block max-w-sm">
                <span className="mb-1 block text-sm font-medium text-slate-700">Select Stall</span>
                <select
                  value={selectedStallId}
                  onChange={(eventHandle) => setSelectedStallId(eventHandle.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
                >
                  {stalls.map((stall) => (
                    <option key={stall.stallId} value={stall.stallId}>
                      {stall.name} ({stall.operatingStatus})
                    </option>
                  ))}
                </select>
              </label>

              {selectedStall ? (
                <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedStall.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedStall.description || "No description"}</p>
                      {selectedStall.locationHint ? (
                        <p className="mt-1 text-xs text-slate-500">{selectedStall.locationHint}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {selectedStall.operatingStatus}
                    </span>
                  </div>

                  {selectedItems.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No items listed for this stall yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedItems.map((item) => (
                        <div
                          key={item.itemId}
                          className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {item.category} • {item.isVeg ? "Veg" : "Non-veg"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-700">₹{item.price}</p>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={quantities[item.itemId] || 0}
                            onChange={(eventHandle) =>
                              handleQuantityChange(item.itemId, eventHandle.target.value)
                            }
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ) : null}
            </>
          )}
        </section>

        <section className="space-y-4">
          <form onSubmit={handlePlaceOrder} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Place Food Order</h2>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Pass ID</span>
              <input
                value={passId}
                onChange={(eventHandle) => setPassId(eventHandle.target.value)}
                placeholder="PASS-XXXX"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Special Note</span>
              <textarea
                value={notes}
                onChange={(eventHandle) => setNotes(eventHandle.target.value)}
                rows={2}
                placeholder="No onion please"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <p className="mt-3 text-sm text-slate-700">
              Estimated Amount: <span className="font-semibold">₹{previewTotal.toFixed(2)}</span>
            </p>

            <button
              type="submit"
              disabled={placingOrder}
              className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {placingOrder ? "Placing..." : "Place Order"}
            </button>
          </form>

          {latestOrder ? (
            <article className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Latest Order</p>
              <p className="mt-2 text-sm text-brand-900">Order: {latestOrder.orderNumber}</p>
              <p className="mt-1 text-sm text-brand-900">Status: {latestOrder.status}</p>
              <p className="mt-1 text-sm text-brand-900">
                Total: ₹{latestOrder.totalAmount} ({latestOrder.currency})
              </p>
            </article>
          ) : null}

          <form onSubmit={handleTrackOrder} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Track Order Status</h2>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Order ID</span>
              <input
                value={trackingOrderId}
                onChange={(eventHandle) => setTrackingOrderId(eventHandle.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Pass ID</span>
              <input
                value={trackingPassId}
                onChange={(eventHandle) => setTrackingPassId(eventHandle.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <button
              type="submit"
              disabled={checkingOrder}
              className="mt-4 rounded-full border border-brand-300 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {checkingOrder ? "Checking..." : "Check Status"}
            </button>

            {trackedOrder ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{trackedOrder.orderNumber}</p>
                <p className="mt-1 text-sm text-slate-700">Status: {trackedOrder.status}</p>
                <p className="mt-1 text-sm text-slate-700">
                  Stall: {trackedOrder.stall?.name || "Food Stall"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Updated: {formatDateTime(trackedOrder.updatedAt)}
                </p>
              </div>
            ) : null}
          </form>
        </section>
      </div>

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
          Queue Board
        </Link>
      </div>
    </div>
  );
};

export default FoodServicesPage;
