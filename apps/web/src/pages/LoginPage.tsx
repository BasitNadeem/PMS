import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { unlockNotificationSound } from "@/lib/notificationSound";

export default function LoginPage() {
  const navigate = useNavigate();
  // ?slug= pre-fills the hotel slug field as a convenience when arriving from
  // a Booking Engine's "Property Login" link — UX only, never used for auth;
  // the field stays a normal editable input the user can change.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", hotelSlug: searchParams.get("slug") ?? "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // This submit event is a trusted user gesture, so use it to unlock the
    // chime before navigating into the PMS and waiting for background events.
    unlockNotificationSound();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", form);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userName", data.user.name);
      localStorage.setItem("userRole", data.user.role ?? "");
      localStorage.setItem("isFirstLogin", data.user.isFirstLogin.toString());
      localStorage.setItem("onboardingCompleted", data.hotel.onboardingCompleted.toString());
      if (data.user.role === "KITCHEN") {
        navigate("/kitchen/dashboard");
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        .response?.data?.error ?? "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Hotel PMS</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your property</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Hotel slug (e.g. grand-hotel)"
            value={form.hotelSlug}
            onChange={(e) => setForm({ ...form, hotelSlug: e.target.value })}
            required
          />
          <input
            type="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
