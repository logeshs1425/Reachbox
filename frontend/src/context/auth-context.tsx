"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchMe, logout as apiLogout, User } from "@/lib/api";

const TOKEN_KEY = "reachinbox_auth_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(t: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  setToken: (t: string | null) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = getStoredToken();
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }
    setTokenState(stored);
    try {
      const me = await fetchMe(stored);
      setUser(me);
    } catch {
      setStoredToken(null);
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setToken = useCallback(async (t: string | null): Promise<User | null> => {
    setTokenState(t);
    setStoredToken(t);
    if (!t) {
      setUser(null);
      return null;
    }
    try {
      const me = await fetchMe(t);
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    if (token) await apiLogout(token).catch(() => undefined);
    await setToken(null);
  }, [token, setToken]);

  const value = useMemo(
    () => ({ token, user, loading, setToken, logout, refreshUser }),
    [token, user, loading, setToken, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
