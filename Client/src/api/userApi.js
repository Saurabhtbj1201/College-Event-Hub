import http from "./http";

export const loginUserWithGoogle = async (idToken) => {
  const response = await http.post("/user/auth/google", { idToken });
  return response.data;
};

export const getUserProfile = async () => {
  const response = await http.get("/user/me");
  return response.data;
};

export const getUserTickets = async () => {
  const response = await http.get("/user/tickets");
  return response.data;
};

export const getUserNotifications = async (limit = 30) => {
  const response = await http.get(`/user/notifications?limit=${encodeURIComponent(limit)}`);
  return response.data;
};

export const markUserNotificationRead = async (notificationId) => {
  const response = await http.patch(`/user/notifications/${notificationId}/read`);
  return response.data;
};
