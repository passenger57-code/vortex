import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("vortex_token"));
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(() => Number(sessionStorage.getItem("vortex_profile")) || null);
  const [loading, setLoading] = useState(!!localStorage.getItem("vortex_token"));

  const applySession = useCallback((data) => {
    localStorage.setItem("vortex_token", data.token);
    setToken(data.token);
    setUser(data.user);
    setProfiles(data.profiles);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("vortex_token");
    sessionStorage.removeItem("vortex_profile");
    setToken(null); setUser(null); setProfiles([]); setProfileId(null);
  }, []);

  // Validate a stored token on first load.
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((d) => { setUser(d.user); setProfiles(d.profiles); })
      .catch(() => logout())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener("vortex:unauthorized", logout);
    return () => window.removeEventListener("vortex:unauthorized", logout);
  }, [logout]);

  const login = async (email, password) => applySession(await api.post("/auth/login", { email, password }));
  const register = async (email, password, name) => {
    const data = await api.post("/auth/register", { email, password, name });
    if (data.token) applySession(data);
    return data;
  };

  const selectProfile = (id) => {
    sessionStorage.setItem("vortex_profile", String(id));
    setProfileId(id);
  };
  const addProfile = async (name) => {
    const p = await api.post("/me/profiles", { name });
    setProfiles((list) => [...list, p]);
    return p;
  };
  const removeProfile = async (id) => {
    await api.del(`/me/profiles/${id}`);
    setProfiles((list) => list.filter((p) => p.id !== id));
    if (id === profileId) { sessionStorage.removeItem("vortex_profile"); setProfileId(null); }
  };

  const profile = profiles.find((p) => p.id === profileId) || null;
  const value = useMemo(
    () => ({ token, user, profiles, profile, profileId, loading, login, register, logout, selectProfile, addProfile, removeProfile }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, user, profiles, profileId, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
