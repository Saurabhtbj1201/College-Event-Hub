import { useEffect, useMemo, useState } from "react";
import {
  createFoodItem,
  createFoodStall,
  getAdminEvents,
  getAdminFoodOrders,
  getAdminFoodStalls,
  updateFoodItem,
  updateFoodOrderStatus,
  updateFoodStall,
} from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "picked-up", "cancelled"];
const STALL_STATUSES = ["open", "busy", "closed", "paused"];

const AdminFoodOperationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [stalls, setStalls] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderFilterStatus, setOrderFilterStatus] = useState("");
  const [orderFilterStallId, setOrderFilterStallId] = useState("");

  const [creatingStall, setCreatingStall] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [updatingStallId, setUpdatingStallId] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");

  const [stallForm, setStallForm] = useState({
    name: "",
    code: "",
    operatingStatus: "open",
    estimatedPrepMinutes: "10",
    zoneCode: "",
    locationHint: "",
  });

  const [itemForm, setItemForm] = useState({
    stallId: "",
    name: "",
    category: "general",
    price: "",
    prepMinutes: "8",
    isVeg: false,
    isAvailable: true,
  });

  const [orderStatusDraft, setOrderStatusDraft] = useState({});

  const selectedEvent = useMemo(
    () => events.find((eventItem) => eventItem._id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const loadEvents = async () => {
    const data = await getAdminEvents();
    setEvents(Array.isArray(data) ? data : []);

    if (Array.isArray(data) && data.length > 0) {
      setSelectedEventId((current) => current || data[0]._id);
    }
  };

  const loadFoodData = async (eventId, statusFilter = "", stallFilter = "") => {
    if (!eventId) {
      setStalls([]);
      setOrders([]);
      return;
    }

    const [stallData, orderData] = await Promise.all([
      getAdminFoodStalls(eventId),
      getAdminFoodOrders(eventId, {
        status: statusFilter || undefined,
        stallId: stallFilter || undefined,
      }),
    ]);

    const nextStalls = Array.isArray(stallData.stalls) ? stallData.stalls : [];
    const nextOrders = Array.isArray(orderData.orders) ? orderData.orders : [];

    setStalls(nextStalls);
    setOrders(nextOrders);

    if (nextStalls.length > 0) {
      setItemForm((current) => ({
        ...current,
        stallId: current.stallId || nextStalls[0].stallId,
      }));
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await loadEvents();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load food operations");
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

    loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId).catch((err) => {
      setError(err.response?.data?.message || "Unable to refresh food operations data");
    });
  }, [selectedEventId, orderFilterStatus, orderFilterStallId]);

  const handleStallFieldChange = (eventHandle) => {
    const { name, value } = eventHandle.target;
    setStallForm((current) => ({ ...current, [name]: value }));
  };

  const handleItemFieldChange = (eventHandle) => {
    const { name, value, type, checked } = eventHandle.target;
    setItemForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateStall = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!selectedEventId || !stallForm.name.trim()) {
      setError("Event and stall name are required");
      return;
    }

    setCreatingStall(true);
    setError("");
    setNotice("");

    try {
      const response = await createFoodStall(selectedEventId, {
        name: stallForm.name.trim(),
        code: stallForm.code.trim(),
        operatingStatus: stallForm.operatingStatus,
        estimatedPrepMinutes: Number(stallForm.estimatedPrepMinutes || 10),
        zoneCode: stallForm.zoneCode.trim(),
        locationHint: stallForm.locationHint.trim(),
      });

      setNotice(`Food stall created: ${response.stall.name}`);
      setStallForm((current) => ({
        ...current,
        name: "",
        code: "",
        zoneCode: "",
        locationHint: "",
      }));

      await loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create food stall");
    } finally {
      setCreatingStall(false);
    }
  };

  const handleCreateItem = async (eventHandle) => {
    eventHandle.preventDefault();

    if (!itemForm.stallId || !itemForm.name.trim()) {
      setError("Select stall and provide item name");
      return;
    }

    if (Number(itemForm.price || 0) <= 0) {
      setError("Item price must be greater than 0");
      return;
    }

    setCreatingItem(true);
    setError("");
    setNotice("");

    try {
      const response = await createFoodItem(itemForm.stallId, {
        name: itemForm.name.trim(),
        category: itemForm.category.trim(),
        price: Number(itemForm.price),
        prepMinutes: Number(itemForm.prepMinutes || 8),
        isVeg: Boolean(itemForm.isVeg),
        isAvailable: Boolean(itemForm.isAvailable),
      });

      setNotice(`Food item created: ${response.item.name}`);
      setItemForm((current) => ({
        ...current,
        name: "",
        price: "",
      }));

      await loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create food item");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleUpdateStallStatus = async (stallId, operatingStatus) => {
    setUpdatingStallId(stallId);
    setError("");

    try {
      await updateFoodStall(stallId, { operatingStatus });
      await loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update stall status");
    } finally {
      setUpdatingStallId("");
    }
  };

  const handleToggleItemAvailability = async (itemId, currentValue) => {
    setUpdatingItemId(itemId);
    setError("");

    try {
      await updateFoodItem(itemId, { isAvailable: !currentValue });
      await loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update item availability");
    } finally {
      setUpdatingItemId("");
    }
  };

  const handleUpdateOrderStatus = async (order) => {
    const nextStatus = orderStatusDraft[order.orderId] || order.status;

    if (nextStatus === order.status) {
      setNotice("Order status is unchanged");
      return;
    }

    setUpdatingOrderId(order.orderId);
    setError("");

    try {
      await updateFoodOrderStatus(order.orderId, {
        status: nextStatus,
      });

      setNotice(`Order ${order.orderNumber} moved to ${nextStatus}`);
      await loadFoodData(selectedEventId, orderFilterStatus, orderFilterStallId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update order status");
    } finally {
      setUpdatingOrderId("");
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading food operations...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Food Operations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage stalls, menu catalog, and order lifecycle for each event.
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

        {selectedEvent ? (
          <p className="mt-2 text-sm text-slate-600">
            {selectedEvent.venue} • {formatDateTime(selectedEvent.date)}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleCreateStall} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Create Stall</h2>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Stall Name</span>
            <input
              name="name"
              value={stallForm.name}
              onChange={handleStallFieldChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Stall Code</span>
            <input
              name="code"
              value={stallForm.code}
              onChange={handleStallFieldChange}
              placeholder="STALL-A"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
              <select
                name="operatingStatus"
                value={stallForm.operatingStatus}
                onChange={handleStallFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {STALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Est. Prep (min)</span>
              <input
                name="estimatedPrepMinutes"
                type="number"
                min={0}
                value={stallForm.estimatedPrepMinutes}
                onChange={handleStallFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creatingStall || !selectedEventId}
            className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creatingStall ? "Creating..." : "Create Stall"}
          </button>
        </form>

        <form onSubmit={handleCreateItem} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Add Menu Item</h2>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Stall</span>
            <select
              name="stallId"
              value={itemForm.stallId}
              onChange={handleItemFieldChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            >
              {stalls.map((stall) => (
                <option key={stall.stallId} value={stall.stallId}>
                  {stall.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Item Name</span>
              <input
                name="name"
                value={itemForm.name}
                onChange={handleItemFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Price</span>
              <input
                name="price"
                type="number"
                min={1}
                value={itemForm.price}
                onChange={handleItemFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
              <input
                name="category"
                value={itemForm.category}
                onChange={handleItemFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Prep (min)</span>
              <input
                name="prepMinutes"
                type="number"
                min={0}
                value={itemForm.prepMinutes}
                onChange={handleItemFieldChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isVeg"
              checked={itemForm.isVeg}
              onChange={handleItemFieldChange}
            />
            Vegetarian
          </label>

          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isAvailable"
              checked={itemForm.isAvailable}
              onChange={handleItemFieldChange}
            />
            Available for orders
          </label>

          <button
            type="submit"
            disabled={creatingItem || !selectedEventId}
            className="mt-4 rounded-full border border-brand-300 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creatingItem ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Stalls and Catalog</h2>

        {stalls.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No stalls configured yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {stalls.map((stall) => (
              <article key={stall.stallId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{stall.name}</p>
                    <p className="text-xs text-slate-500">{stall.code}</p>
                    <p className="mt-1 text-sm text-slate-600">{stall.locationHint || "No location hint"}</p>
                  </div>
                  <select
                    value={stall.operatingStatus}
                    disabled={updatingStallId === stall.stallId}
                    onChange={(eventHandle) =>
                      handleUpdateStallStatus(stall.stallId, eventHandle.target.value)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    {STALL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {stall.items?.length ? (
                  <div className="mt-3 space-y-2">
                    {stall.items.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            ₹{item.price} • {item.category} • {item.isVeg ? "Veg" : "Non-veg"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={updatingItemId === item.itemId}
                          onClick={() => handleToggleItemAvailability(item.itemId, item.isAvailable)}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {updatingItemId === item.itemId
                            ? "Updating..."
                            : item.isAvailable
                            ? "Mark Unavailable"
                            : "Mark Available"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No menu items yet for this stall.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">Food Orders</h2>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Status Filter
            </span>
            <select
              value={orderFilterStatus}
              onChange={(eventHandle) => setOrderFilterStatus(eventHandle.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">All</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Stall Filter
            </span>
            <select
              value={orderFilterStallId}
              onChange={(eventHandle) => setOrderFilterStallId(eventHandle.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">All Stalls</option>
              {stalls.map((stall) => (
                <option key={stall.stallId} value={stall.stallId}>
                  {stall.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No food orders found for this filter.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {orders.map((order) => (
              <article key={order.orderId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {order.stall?.name || "Food Stall"} • {order.passId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={orderStatusDraft[order.orderId] || order.status}
                      onChange={(eventHandle) =>
                        setOrderStatusDraft((current) => ({
                          ...current,
                          [order.orderId]: eventHandle.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={updatingOrderId === order.orderId}
                      onClick={() => handleUpdateOrderStatus(order)}
                      className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingOrderId === order.orderId ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>Total: ₹{order.totalAmount}</p>
                  <p>Status: {order.status}</p>
                  <p>Customer: {order.customer?.name || "N/A"}</p>
                  <p>Ready ETA: {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "N/A"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminFoodOperationsPage;
