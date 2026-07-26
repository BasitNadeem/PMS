import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { unlockNotificationSound } from "@/lib/notificationSound";

function InnFloMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-ink shadow-[0_10px_24px_rgba(33,30,26,0.18)]">
        <svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M6 23V7.8C6 6.81 6.81 6 7.8 6h9.4c.99 0 1.8.81 1.8 1.8V23" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M11 23V11.4c0-.77.63-1.4 1.4-1.4h5.2c.77 0 1.4.63 1.4 1.4V23" fill="rgb(var(--color-accent))" />
          <path d="M3.5 23c3.7-5.1 7.6-5.2 11.4-1.5 2.6 2.5 5.4 2.5 9.6-1.4" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="16.1" cy="15.2" r="1" fill="#fff" />
        </svg>
      </div>
      {!compact && (
        <div>
          <div className="text-[22px] font-extrabold tracking-[-0.04em] text-ink">
            Inn<span className="text-coral">Flo</span>
          </div>
          <div className="-mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">
            Hotel operations
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  // ?slug= pre-fills the hotel slug field as a convenience when arriving from
  // a Booking Engine's "Property Login" link — UX only, never used for auth;
  // the field stays a normal editable input the user can change.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", hotelSlug: searchParams.get("slug") ?? "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="min-h-screen bg-mist lg:grid lg:grid-cols-[minmax(420px,0.92fr)_minmax(560px,1.08fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-[42%] h-80 w-80 rounded-full bg-coral/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#EAB28E]/10 blur-3xl" />

        <a href="https://innflo.co" className="relative z-10 flex w-fit items-center gap-3" aria-label="InnFlo home">
          <div className="grid h-11 w-11 place-items-center rounded-[15px] bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path d="M6 23V7.8C6 6.81 6.81 6 7.8 6h9.4c.99 0 1.8.81 1.8 1.8V23" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
              <path d="M11 23V11.4c0-.77.63-1.4 1.4-1.4h5.2c.77 0 1.4.63 1.4 1.4V23" fill="rgb(var(--color-accent))" />
              <path d="M3.5 23c3.7-5.1 7.6-5.2 11.4-1.5 2.6 2.5 5.4 2.5 9.6-1.4" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
              <circle cx="16.1" cy="15.2" r="1" fill="#fff" />
            </svg>
          </div>
          <div>
            <div className="text-[22px] font-extrabold tracking-[-0.04em]">
              Inn<span className="text-coral">Flo</span>
            </div>
            <div className="-mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
              Hotel operations
            </div>
          </div>
        </a>

        <div className="relative z-10 my-auto max-w-[520px] py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2 text-[12px] font-semibold text-white/75 backdrop-blur">
            <Sparkles size={14} className="text-[#F4A184]" />
            One clear view of your entire property
          </div>
          <h1 className="serif max-w-[500px] text-[52px] font-medium leading-[1.02] tracking-[-0.035em] xl:text-[60px]">
            Your hotel,
            <br />
            <span className="italic text-[#F4A184]">beautifully in flow.</span>
          </h1>
          <p className="mt-6 max-w-[450px] text-[16px] leading-7 text-white/58">
            Reservations, guests, billing, housekeeping and daily operations—connected in one calm workspace.
          </p>

          <div className="mt-10 grid max-w-[470px] grid-cols-2 gap-3">
            {[
              "Live room visibility",
              "Faster front desk",
              "Mobile housekeeping",
              "Direct booking engine",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5 text-[13px] font-medium text-white/72">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-coral/20 text-[#F4A184]">
                  <Check size={12} strokeWidth={3} />
                </span>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-white/35">
          <span>Built for independent hotels</span>
          <span>Simple · Secure · Always on</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-coral-soft/75 blur-3xl lg:hidden" />
        <div className="relative w-full max-w-[480px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <a href="https://innflo.co" aria-label="InnFlo home">
              <InnFloMark />
            </a>
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-ink-mute backdrop-blur">
              <ShieldCheck size={13} className="text-pine" />
              Secure login
            </div>
          </div>

          <div className="mb-9">
            <div className="mb-5 hidden lg:block">
              <InnFloMark />
            </div>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-coral">
              Property workspace
            </p>
            <h2 className="serif text-[40px] font-medium leading-none tracking-[-0.035em] text-ink sm:text-[46px]">
              Welcome back.
            </h2>
            <p className="mt-4 text-[15px] leading-6 text-ink-mute">
              Sign in to pick up exactly where your team left off.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-clay/20 bg-clay-soft px-4 py-3.5 text-[13px] font-medium text-clay">
              <LockKeyhole size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                Property ID
              </span>
              <span className="group relative block">
                <Building2
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-coral"
                />
                <input
                  name="hotelSlug"
                  autoComplete="organization"
                  className="h-[54px] w-full rounded-2xl border border-line bg-white pl-12 pr-4 text-[14px] font-medium text-ink shadow-pop outline-none transition-all placeholder:text-ink-faint focus:border-coral/45 focus:ring-4 focus:ring-coral/10"
                  placeholder="e.g. grand-hotel"
                  value={form.hotelSlug}
                  onChange={(e) => setForm({ ...form, hotelSlug: e.target.value })}
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                Work email
              </span>
              <span className="group relative block">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-coral"
                />
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  className="h-[54px] w-full rounded-2xl border border-line bg-white pl-12 pr-4 text-[14px] font-medium text-ink shadow-pop outline-none transition-all placeholder:text-ink-faint focus:border-coral/45 focus:ring-4 focus:ring-coral/10"
                  placeholder="you@hotel.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                Password
              </span>
              <span className="group relative block">
                <KeyRound
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-coral"
                />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-[54px] w-full rounded-2xl border border-line bg-white pl-12 pr-12 text-[14px] font-medium text-ink shadow-pop outline-none transition-all placeholder:text-ink-faint focus:border-coral/45 focus:ring-4 focus:ring-coral/10"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-coral px-5 text-[14px] font-bold text-white shadow-[0_14px_28px_rgba(224,83,43,0.24)] transition-all hover:-translate-y-0.5 hover:bg-coral-dark hover:shadow-[0_18px_34px_rgba(224,83,43,0.3)] focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25 disabled:pointer-events-none disabled:opacity-65"
          >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Opening your workspace…
                </>
              ) : (
                <>
                  Sign in to InnFlo
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
          </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-center text-[12px] text-ink-faint">
            <ShieldCheck size={14} className="text-pine" />
            Your property data is protected and tenant-isolated.
          </div>
        </div>
      </section>
    </main>
  );
}
