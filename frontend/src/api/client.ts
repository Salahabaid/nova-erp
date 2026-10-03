const TOKEN_KEY = "nova_token";
const REFRESH_KEY = "nova_refresh";

export const apiUrl = import.meta.env.VITE_API_URL || "/api/v1";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setSession(access: string | null, refresh?: string | null) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  else localStorage.removeItem(TOKEN_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (refresh === null) localStorage.removeItem(REFRESH_KEY);
}

export function setToken(token: string | null) {
  setSession(token, token ? undefined : null);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        setSession(body.access_token, body.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const isAuthPath = path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh") || path === "/auth/me";
  if (res.status === 401 && !retried && !isAuthPath) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, true);
    setSession(null, null);
    const here = window.location.pathname;
    if (here !== "/login" && here !== "/register") {
      window.location.assign("/login");
    }
  }
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let message = "Une erreur est survenue.";
    if (contentType.includes("application/json")) {
      const body = await res.json();
      message = body?.detail?.message || body?.message || message;
    }
    throw new ApiError(res.status, message);
  }
  if (contentType.includes("application/json")) return res.json();
  return res as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  blob: async (path: string) => {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res = await fetch(`${apiUrl}${path}`, { headers });
    if (res.status === 401) {
      const ok = await tryRefresh();
      if (ok) {
        headers.set("Authorization", `Bearer ${getToken()}`);
        res = await fetch(`${apiUrl}${path}`, { headers });
      }
    }
    if (!res.ok) throw new ApiError(res.status, "Téléchargement impossible.");
    return res.blob();
  },
};

export async function downloadBlob(path: string, filename: string) {
  const blob = await api.blob(path);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
