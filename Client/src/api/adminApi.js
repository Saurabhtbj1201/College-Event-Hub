import http from "./http";

export const registerAdmin = async (payload) => {
  const response = await http.post("/auth/admin/register", payload);
  return response.data;
};

export const loginAdmin = async (payload) => {
  const response = await http.post("/auth/admin/login", payload);
  return response.data;
};

export const getMyProfile = async () => {
  const response = await http.get("/auth/admin/me");
  return response.data;
};

export const createEvent = async (payload) => {
  const response = await http.post("/admin/events", payload);
  return response.data;
};

export const getAdminEvents = async () => {
  const response = await http.get("/admin/events");
  return response.data;
};

export const getRegistrations = async () => {
  const response = await http.get("/admin/registrations");
  return response.data;
};

export const getCommandSummary = async () => {
  const response = await http.get("/admin/command/summary");
  return response.data;
};

export const getAdminIntelligenceInsights = async (eventId) => {
  const response = await http.get(`/admin/events/${eventId}/intelligence/insights`);
  return response.data;
};

export const scanTicketCheckIn = async (payload) => {
  const response = await http.post("/admin/scanner/check-in", payload);
  return response.data;
};

export const updateEventLiveOperations = async (eventId, payload) => {
  const response = await http.patch(`/admin/events/${eventId}/live-ops`, payload);
  return response.data;
};

export const sendEventBroadcast = async (eventId, payload) => {
  const response = await http.post(`/admin/events/${eventId}/broadcast`, payload);
  return response.data;
};

export const getQueueOverview = async (eventId = "") => {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
  const response = await http.get(`/admin/queues/overview${query}`);
  return response.data;
};

export const getQueueAnalytics = async (eventId = "") => {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
  const response = await http.get(`/admin/queues/analytics${query}`);
  return response.data;
};

export const createQueuePoint = async (eventId, payload) => {
  const response = await http.post(`/admin/events/${eventId}/queues`, payload);
  return response.data;
};

export const updateQueuePoint = async (queuePointId, payload) => {
  const response = await http.patch(`/admin/queues/${queuePointId}`, payload);
  return response.data;
};

export const serveNextQueueTicket = async (queuePointId) => {
  const response = await http.post(`/admin/queues/${queuePointId}/serve-next`);
  return response.data;
};

export const getSimulatorStatus = async () => {
  const response = await http.get("/admin/simulator/status");
  return response.data;
};

export const startSimulator = async (intervalSeconds) => {
  const response = await http.post("/admin/simulator/start", { intervalSeconds });
  return response.data;
};

export const stopSimulator = async () => {
  const response = await http.post("/admin/simulator/stop");
  return response.data;
};

export const getNavigationMap = async (eventId) => {
  const response = await http.get(`/admin/events/${eventId}/navigation`);
  return response.data;
};

export const saveNavigationMap = async (eventId, payload) => {
  const response = await http.put(`/admin/events/${eventId}/navigation`, payload);
  return response.data;
};

export const resetNavigationMap = async (eventId) => {
  const response = await http.post(`/admin/events/${eventId}/navigation/reset`);
  return response.data;
};

export const createFoodStall = async (eventId, payload) => {
  const response = await http.post(`/admin/events/${eventId}/food/stalls`, payload);
  return response.data;
};

export const getAdminFoodStalls = async (eventId) => {
  const response = await http.get(`/admin/events/${eventId}/food/stalls`);
  return response.data;
};

export const updateFoodStall = async (stallId, payload) => {
  const response = await http.patch(`/admin/food/stalls/${stallId}`, payload);
  return response.data;
};

export const createFoodItem = async (stallId, payload) => {
  const response = await http.post(`/admin/food/stalls/${stallId}/items`, payload);
  return response.data;
};

export const updateFoodItem = async (itemId, payload) => {
  const response = await http.patch(`/admin/food/items/${itemId}`, payload);
  return response.data;
};

export const getAdminFoodOrders = async (eventId, options = {}) => {
  const queryParams = new URLSearchParams();

  if (options.status) {
    queryParams.set("status", options.status);
  }

  if (options.stallId) {
    queryParams.set("stallId", options.stallId);
  }

  if (typeof options.limit !== "undefined") {
    queryParams.set("limit", String(options.limit));
  }

  const query = queryParams.toString();
  const response = await http.get(`/admin/events/${eventId}/food/orders${query ? `?${query}` : ""}`);
  return response.data;
};

export const updateFoodOrderStatus = async (orderId, payload) => {
  const response = await http.patch(`/admin/food/orders/${orderId}/status`, payload);
  return response.data;
};

export const sendEmergencyBroadcast = async (eventId, payload) => {
  const response = await http.post(`/admin/events/${eventId}/emergency/broadcast`, payload);
  return response.data;
};

export const getEmergencyIncidents = async (eventId, options = {}) => {
  const queryParams = new URLSearchParams();

  if (options.status) {
    queryParams.set("status", options.status);
  }

  if (typeof options.limit !== "undefined") {
    queryParams.set("limit", String(options.limit));
  }

  const query = queryParams.toString();
  const response = await http.get(
    `/admin/events/${eventId}/emergency/incidents${query ? `?${query}` : ""}`
  );
  return response.data;
};

export const updateEmergencyIncident = async (incidentId, payload) => {
  const response = await http.patch(`/admin/emergency/incidents/${incidentId}`, payload);
  return response.data;
};

export const getAdminSocialGroups = async (eventId, options = {}) => {
  const queryParams = new URLSearchParams();

  if (typeof options.activeOnly !== "undefined") {
    queryParams.set("activeOnly", String(Boolean(options.activeOnly)));
  }

  if (typeof options.limit !== "undefined") {
    queryParams.set("limit", String(options.limit));
  }

  const query = queryParams.toString();
  const response = await http.get(
    `/admin/events/${eventId}/social/groups${query ? `?${query}` : ""}`
  );
  return response.data;
};

export const getPendingAdmins = async () => {
  const response = await http.get("/admin/admins/pending");
  return response.data;
};

export const updateAdminApproval = async (adminId, approved) => {
  const response = await http.patch(`/admin/admins/${adminId}/approval`, { approved });
  return response.data;
};
