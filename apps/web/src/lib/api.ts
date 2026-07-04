import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({ baseURL: BASE_URL, timeout: 12_000 });

// Backend error envelope is always { error: string, details?: unknown } —
// extract the real message instead of showing a generic "something went
// wrong" everywhere a mutation can fail for a specific, useful reason
// (room conflicts, duplicate guests, validation, etc).
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return fallback;
}

export function getErrorDetails(err: unknown): unknown {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { details?: unknown } | undefined)?.details;
  }
  return undefined;
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Silent refresh on 401 ─────────────────────────────────────────────────────
// Only one refresh call fires at a time. Concurrent 401s are queued and
// retried automatically once the new access token arrives.

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function flushQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login";
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    // Don't intercept non-401s, already-retried requests, or the refresh call itself
    if (
      err.response?.status !== 401 ||
      original._retry ||
      (original.url as string | undefined)?.includes("/auth/refresh")
    ) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) { clearSession(); return Promise.reject(err); }

    // Queue this request while another refresh is already in flight
    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
      const newToken: string = data.accessToken;
      localStorage.setItem("accessToken", newToken);
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      flushQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      clearSession();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
