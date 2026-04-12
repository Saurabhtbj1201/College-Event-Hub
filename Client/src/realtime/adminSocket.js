import { io } from "socket.io-client";

let adminSocket = null;

const resolveSocketBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api\/?$/, "");
};

export const connectAdminSocket = (token) => {
  if (!token) {
    return null;
  }

  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }

  adminSocket = io(resolveSocketBaseUrl(), {
    transports: ["websocket"],
    auth: {
      token: `Bearer ${token}`,
    },
  });

  return adminSocket;
};

export const getAdminSocket = () => adminSocket;

export const disconnectAdminSocket = () => {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
};
