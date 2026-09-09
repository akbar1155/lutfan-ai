import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "../api/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  loginDev: (asAdmin?: boolean) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  loginPhone: (payload: { phone: string; password: string }) => Promise<void>;
  registerPhone: (payload: {
    phone: string;
    password: string;
    first_name: string;
    last_name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    setLoading(true);
    try {
      // localStorage may be empty after a hard refresh while httpOnly
      // refresh cookie is still valid — restore before calling /auth/me.
      if (!localStorage.getItem("access_token")) {
        const restored = await api.ensureSession();
        if (!restored) {
          setUser(null);
          return;
        }
      }
      const me = await api.me();
      setUser(me);
    } catch {
      if (!localStorage.getItem("access_token")) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const handler = () => {
      void refreshMe();
    };
    window.addEventListener("auth:changed", handler);
    return () => window.removeEventListener("auth:changed", handler);
  }, [refreshMe]);

  const applyAuth = useCallback(
    (data: { user: User; access: string; refresh?: string }) => {
      localStorage.setItem("access_token", data.access);
      if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
      setUser(data.user);
    },
    [],
  );

  const loginDev = useCallback(
    async (asAdmin = false) => {
      try {
        const data = await api.devLogin({
          telegram_id: asAdmin ? 900001 : 1001,
          as_admin: asAdmin,
          first_name: asAdmin ? "Admin" : "Dev User",
          username: asAdmin ? "admin_dev" : "dev_user",
        });
        applyAuth(data);
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        throw err instanceof Error ? err : new Error("Login failed");
      }
    },
    [applyAuth],
  );

  const loginAdmin = useCallback(
    async (username: string, password: string) => {
      try {
        const data = await api.adminLogin({ username, password });
        applyAuth(data);
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        throw err instanceof Error ? err : new Error("Login failed");
      }
    },
    [applyAuth],
  );

  const loginPhone = useCallback(
    async (payload: { phone: string; password: string }) => {
      try {
        const data = await api.phoneLogin(payload);
        applyAuth(data);
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        throw err instanceof Error ? err : new Error("Login failed");
      }
    },
    [applyAuth],
  );

  const registerPhone = useCallback(
    async (payload: {
      phone: string;
      password: string;
      first_name: string;
      last_name?: string;
    }) => {
      try {
        const data = await api.phoneRegister(payload);
        applyAuth(data);
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        throw err instanceof Error ? err : new Error("Register failed");
      }
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginDev,
      loginAdmin,
      loginPhone,
      registerPhone,
      logout,
      refreshMe,
    }),
    [
      user,
      loading,
      loginDev,
      loginAdmin,
      loginPhone,
      registerPhone,
      logout,
      refreshMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
