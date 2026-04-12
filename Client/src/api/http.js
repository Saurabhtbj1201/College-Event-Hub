import axios from "axios";

const ADMIN_TOKEN_KEY = "cem_admin_token";
const USER_TOKEN_KEY = "cem_user_token";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

http.interceptors.request.use((config) => {
  const requestPath = String(config.url || "");

  const token = requestPath.startsWith("/user")
    ? localStorage.getItem(USER_TOKEN_KEY)
    : localStorage.getItem(ADMIN_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default http;
