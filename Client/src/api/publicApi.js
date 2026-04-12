import http from "./http";

export const getPublicEvents = async () => {
  const response = await http.get("/public/events");
  return response.data;
};

export const getPublicEventById = async (eventId) => {
  const response = await http.get(`/public/events/${eventId}`);
  return response.data;
};

export const registerForEvent = async (eventId, payload) => {
  const response = await http.post(`/public/events/${eventId}/register`, payload);
  return response.data;
};

export const getPassById = async (passId) => {
  const response = await http.get(`/public/passes/${passId}`);
  return response.data;
};

export const getEventQueues = async (eventId) => {
  const response = await http.get(`/public/events/${eventId}/queues`);
  return response.data;
};

export const joinEventQueue = async (eventId, queuePointId, payload) => {
  const response = await http.post(
    `/public/events/${eventId}/queues/${queuePointId}/join`,
    payload
  );
  return response.data;
};

export const getQueueTicketStatus = async (ticketId) => {
  const response = await http.get(`/public/queues/tickets/${ticketId}`);
  return response.data;
};

export const getEventNavigation = async (eventId) => {
  const response = await http.get(`/public/events/${eventId}/navigation`);
  return response.data;
};

export const getEventRouteHint = async (eventId, fromCode, toCode) => {
  const query = `?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}`;
  const response = await http.get(`/public/events/${eventId}/navigation/route${query}`);
  return response.data;
};

export const getFoodCatalog = async (eventId) => {
  const response = await http.get(`/public/events/${eventId}/food/catalog`);
  return response.data;
};

export const placeFoodOrder = async (eventId, payload) => {
  const response = await http.post(`/public/events/${eventId}/food/orders`, payload);
  return response.data;
};

export const getFoodOrderStatus = async (orderId, passId) => {
  const query = `?passId=${encodeURIComponent(passId)}`;
  const response = await http.get(`/public/food/orders/${orderId}${query}`);
  return response.data;
};
