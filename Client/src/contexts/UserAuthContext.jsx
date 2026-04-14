import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getUserProfile } from "../api/userApi";

const UserAuthContext = createContext(null);

const USER_TOKEN_KEY = "cem_user_token";
const USER_PROFILE_KEY = "cem_user_profile";

const getStoredUser = () => {
  try {
    const value = localStorage.getItem(USER_PROFILE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

export const UserAuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(USER_TOKEN_KEY) || "");
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(USER_TOKEN_KEY)));

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile();
        setUser(profile.user);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile.user));
      } catch (error) {
        localStorage.removeItem(USER_TOKEN_KEY);
        localStorage.removeItem(USER_PROFILE_KEY);
        setToken("");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const login = (payload) => {
    setToken(payload.token);
    setUser(payload.user);
    localStorage.setItem(USER_TOKEN_KEY, payload.token);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(payload.user));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
  };

  const value = useMemo(
    () => ({
      featureEnabled: true,
      token,
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, loading]
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
};

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);

  if (!context) {
    throw new Error("useUserAuth must be used within UserAuthProvider");
  }

  return context;
};
