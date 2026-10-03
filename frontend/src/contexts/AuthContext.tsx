import { api, getToken, setSession } from "@/api/client";
import type { UserMe } from "@/types";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AuthCtx = {
  user: UserMe | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserMe>;
  register: (payload: { email: string; password: string; first_name: string; last_name: string }) => Promise<UserMe>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (module: string) => boolean;
  has: (...perms: string[]) => boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const me = await api.get<UserMe>("/auth/me");
    setUser(me);
  };

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    refresh()
      .catch(() => {
        setSession(null, null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const afterAuth = async (tokens: { access_token: string; refresh_token?: string }) => {
    setSession(tokens.access_token, tokens.refresh_token);
    const me = await api.get<UserMe>("/auth/me");
    setUser(me);
    return me;
  };

  const value: AuthCtx = {
    user,
    loading,
    login: async (email, password) => afterAuth(await api.post("/auth/login", { email, password })),
    register: async (payload) => afterAuth(await api.post("/auth/register", payload)),
    logout: () => {
      setSession(null, null);
      setUser(null);
      window.location.href = "/login";
    },
    refresh,
    can: (module) => !user || user.role_slug === "super_admin" || Boolean(user.modules?.[module]),
    has: (...perms) => !user || user.role_slug === "super_admin" || perms.some((p) => user.permissions?.includes(p)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
