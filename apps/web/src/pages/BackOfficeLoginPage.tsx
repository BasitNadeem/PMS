import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, CalendarDays, Clock3, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Users, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { persistAuthSession, type AuthSession } from "@/services/auth";

function BackOfficeMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const isDark = tone === "dark";

  return (
    <div className="flex items-center gap-3">
      <img src="/brand/mark-clay-tight.svg" alt="" aria-hidden="true" className="h-11 w-11" />
      <div>
        <div className={`serif text-[25px] font-semibold italic tracking-[-0.035em] ${isDark ? "text-white" : "text-ink"}`}>Innflo</div>
        <div className={`-mt-1 text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-white/45" : "text-ink/45"}`}>Back office</div>
      </div>
    </div>
  );
}

export default function BackOfficeLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", hotelSlug: searchParams.get("slug") ?? "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post<AuthSession>("/api/auth/login", {
        email: form.email,
        password: form.password,
        surface: "BACKOFFICE",
        ...(form.hotelSlug.trim() ? { hotelSlug: form.hotelSlug.trim() } : {}),
      });
      persistAuthSession(response.data);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(message ?? "Back Office login failed. Check your property and account details.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "h-[54px] w-full rounded-xl border border-[#D9E6E0] bg-[#F7FAF8] pl-12 pr-4 text-[14px] font-medium text-ink outline-none transition-all placeholder:text-ink-faint focus:border-pine focus:bg-white focus:ring-4 focus:ring-pine/10";

  return (
    <main className="min-h-screen bg-[#EEF5F1] lg:grid lg:grid-cols-[minmax(370px,0.88fr)_minmax(560px,1.12fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-pine-deep px-10 py-10 text-white lg:flex lg:flex-col xl:px-14">
        <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-28 h-[30rem] w-[30rem] rounded-full bg-[#70BFA4]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 top-10 h-80 w-80 rounded-full bg-coral/15 blur-3xl" />

        <div className="relative z-10 flex items-center justify-between">
          <a href="https://innflo.co" aria-label="Innflo home"><BackOfficeMark /></a>
          <span className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Private console</span>
        </div>

        <div className="relative z-10 my-auto max-w-[430px] py-16">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#70BFA4] text-pine-deep shadow-[0_12px_30px_rgba(112,191,164,0.22)]"><Users size={23} /></div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.19em] text-[#A9DDC9]">Back Office · management access</p>
          <h1 className="serif text-[46px] font-medium leading-[1.02] tracking-[-0.04em] xl:text-[56px]">Keep the hotel<br /><span className="italic text-[#A9DDC9]">in control.</span></h1>
          <p className="mt-6 max-w-[370px] text-[14px] leading-6 text-white/60">A focused workspace for attendance, leave, expenses and the management decisions behind every stay.</p>

          <div className="mt-10 grid max-w-[390px] grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3.5"><Clock3 size={16} className="text-[#A9DDC9]" /><span className="mt-3 block text-[11px] font-semibold text-white/75">Attendance</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3.5"><CalendarDays size={16} className="text-[#A9DDC9]" /><span className="mt-3 block text-[11px] font-semibold text-white/75">Leave plans</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3.5"><WalletCards size={16} className="text-[#A9DDC9]" /><span className="mt-3 block text-[11px] font-semibold text-white/75">Expenses</span></div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/45"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#A9DDC9]" /> Authorized owners and managers only</span><span className="hidden xl:inline">backoffice.innflo.co</span></div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-y-auto px-5 py-8 sm:px-10 lg:px-14 xl:px-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#CDE9DD]/75 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-coral-soft/55 blur-3xl" />
        <div className="relative w-full max-w-[500px]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <BackOfficeMark tone="light" />
            <span className="rounded-full border border-pine/25 bg-pine-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-pine-deep">Back Office</span>
          </div>

          <div className="mb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-pine-deep"><ShieldCheck size={13} /> Private management console</div>
            <h2 className="serif text-[40px] font-medium leading-none tracking-[-0.035em] text-ink sm:text-[48px]">Sign in to Back Office.</h2>
            <p className="mt-4 max-w-[450px] text-[15px] leading-6 text-ink-mute">For hotel owners and managers. Daily staff operations still belong in the PMS at <span className="font-semibold text-ink-soft">app.innflo.co</span>.</p>
          </div>

          <div className="rounded-[28px] border border-[#D9E6E0] bg-white p-6 shadow-[0_24px_60px_rgba(31,77,58,0.12)] sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-line-soft pb-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-soft text-pine-deep"><Building2 size={19} /></span><div><div className="text-[13px] font-bold text-ink">Manager access</div><div className="mt-0.5 text-[11px] text-ink-mute">Select your hotel, then continue</div></div></div>

            {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3.5 text-[13px] font-medium text-clay"><LockKeyhole size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">Property ID <span className="normal-case tracking-normal text-ink-faint">(optional for one property)</span></span>
                <span className="group relative block"><Building2 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-pine" /><input name="hotelSlug" autoComplete="organization" className={inputClass} placeholder="e.g. grand-hotel" value={form.hotelSlug} onChange={(event) => setForm({ ...form, hotelSlug: event.target.value })} /></span>
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">Manager or owner email</span>
                <span className="group relative block"><Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-pine" /><input name="email" type="email" autoComplete="username" required className={inputClass} placeholder="you@hotel.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></span>
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">Password</span>
                <span className="group relative block"><KeyRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-pine" /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className={`${inputClass} pr-12`} placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-pine-soft hover:text-pine-deep">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
              </label>
              <button type="submit" disabled={loading} className="group mt-2 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-pine-deep px-5 text-[14px] font-bold text-white shadow-[0_14px_28px_rgba(31,77,58,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#163B2D] disabled:pointer-events-none disabled:opacity-65">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />Opening Back Office…</> : <>Enter Back Office <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>}</button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 border-t border-line-soft pt-5 text-[12px] leading-5 text-ink-mute"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-pine" /><span>Hotel data stays tenant-isolated. Access is limited to authorized management accounts.</span></div>
          </div>

          <div className="mt-6 text-center text-[12px] text-ink-faint">Need daily operations? <a href="https://app.innflo.co/login" className="font-semibold text-ink-mute transition-colors hover:text-pine-deep">Open the PMS login</a></div>
        </div>
      </section>
    </main>
  );
}
