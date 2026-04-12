import { io } from "socket.io-client";

let userSocket = null;

const resolveSocketBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api\/?$/, "");
};

export const connectUserSocket = (token) => {
  if (!token) {
    return null;
  }

  if (userSocket) {
    userSocket.disconnect();
    userSocket = null;
  }

  userSocket = io(`${resolveSocketBaseUrl()}/user`, {
    transports: ["websocket"],
    auth: {
      token: `Bearer ${token}`,
    },
  });

  return userSocket;
};

export const disconnectUserSocket = () => {
  if (userSocket) {
    userSocket.disconnect();
    userSocket = null;
  }
};

export const getUserSocket = () => userSocket;
