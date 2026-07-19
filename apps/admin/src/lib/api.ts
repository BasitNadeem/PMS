import axios from "axios";
import { getToken, clearToken } from "./auth";

// vite.config.ts already fails the production build if VITE_API_URL is unset —
// this is defense-in-depth in case that build-time check is ever bypassed.
// No localhost fallback: an empty baseURL means relative requests against
// whatever origin actually served this bundle, which fails loudly and
// visibly (network errors in the console) instead of silently hitting a
// dead localhost:4000 that only exists on a developer's machine.
if (!import.meta.env.VITE_API_URL) {
  // eslint-disable-next-line no-console -- deliberate, load-bearing production warning
  console.error(
    "VITE_API_URL was not set when this bundle was built — API requests will fail. " +
    "Rebuild with VITE_API_URL=https://api.innflo.co set."
  );
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
