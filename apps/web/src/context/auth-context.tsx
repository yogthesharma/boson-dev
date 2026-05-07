import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiPrefix } from "@/lib/api";
import { getStoredToken, setStoredToken } from "@/lib/auth-token";

type AuthValue = {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  authHeaders: Record<string, string>;
};

const AuthContext = createContext<AuthValue | null>(null);

type AuthResponse = {
  ok?: boolean;
  token?: string;
  error?: string;
};

async function postCreds(
  endpoint: "login" | "register",
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${apiPrefix}/v1/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = (await res.json().catch(() => ({}))) as AuthResponse;
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(
      data.error ?? `${endpoint === "login" ? "Login" : "Sign-up"} failed (${res.status})`,
    );
  }
  return data.token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const login = useCallback(async (email: string, password: string) => {
    const t = await postCreds("login", email, password);
    setStoredToken(t);
    setToken(t);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const t = await postCreds("register", email, password);
    setStoredToken(t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
  }, []);

  const authHeaders = useMemo((): Record<string, string> => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const value = useMemo<AuthValue>(
    () => ({
      token,
      login,
      register,
      logout,
      authHeaders,
    }),
    [authHeaders, login, logout, register, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
