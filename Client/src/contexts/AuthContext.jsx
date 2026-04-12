import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMyProfile } from "../api/adminApi";

const AuthContext = createContext(null);

const TOKEN_KEY = "cem_admin_token";
const ADMIN_KEY = "cem_admin_profile";

const getStoredAdmin = () => {
  try {
    const value = localStorage.getItem(ADMIN_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [admin, setAdmin] = useState(() => getStoredAdmin());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getMyProfile();
        setAdmin(profile.admin);
        localStorage.setItem(ADMIN_KEY, JSON.stringify(profile.admin));
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADMIN_KEY);
        setToken("");
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const login = (payload) => {
    setToken(payload.token);
    setAdmin(payload.admin);
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(payload.admin));
  };

  const logout = () => {
    setToken("");
    setAdmin(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  };

  const value = useMemo(
    () => ({
      token,
      admin,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token && admin),
      isSuperAdmin: admin?.role === "super-admin",
    }),
    [token, admin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
