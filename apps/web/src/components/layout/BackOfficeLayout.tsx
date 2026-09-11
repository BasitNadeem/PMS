import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  FileBarChart,
  LogOut,
  Menu,
  Users,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { formatRoleLabel, getCurrentUserName, getCurrentUserRole, getInitials } from "@/lib/jwt";

interface HotelSummary {
  name: string;
  slug: string;
  propertyType: string;
  city: string | null;
}

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: BarChart3, end: true },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/attendance", label: "Attendance & shifts", icon: ClipboardCheck },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/finance", label: "Expenses & payroll", icon: DollarSign },
  { to: "/reports", label: "Reports", icon: FileBarChart },
] as const;

function dailyPmsUrl(path = "/"): string {
  const isLocal = window.location.hostname.endsWith(".localhost");
  return `${isLocal ? "http://localhost:5173" : "https://app.innflo.co"}${path}`;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/mark-clay-tight.svg" alt="" aria-hidden="true" className="h-10 w-10" />
      <div>
        <div className="serif text-[24px] font-semibold italic tracking-[-0.035em] text-white">Innflo</div>
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Back office</div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { data: hotel } = useQuery<HotelSummary>({
    queryKey: ["backoffice", "hotel"],
    queryFn: () => api.get("/api/hotels/me").then((response) => response.data.data as HotelSummary),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <aside className="flex h-full w-[274px] shrink-0 flex-col overflow-y-auto bg-ink px-4 py-5 text-white">
      <div className="border-b border-white/10 px-2 pb-5">
        <Brand />
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-coral">Current property</div>
          <div className="mt-1 truncate text-[15px] font-semibold text-white">{hotel?.name ?? "Loading property…"}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/45">{hotel?.city ?? "Tenant workspace"}</div>
        </div>
      </div>

      <nav aria-label="Back Office" className="flex-1 space-y-1 py-6">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Management desk</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors",
                active ? "bg-coral text-white shadow-[0_10px_24px_rgba(224,83,43,0.22)]" : "text-white/60 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 pt-4">
        <a
          href={dailyPmsUrl()}
          className="mb-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-[12px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          Open daily PMS
          <ArrowUpRight size={15} />
        </a>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("userName");
            localStorage.removeItem("userRole");
            localStorage.removeItem("onboardingCompleted");
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

export function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userName = getCurrentUserName();
  const role = getCurrentUserRole();

  return (
    <div className="min-h-screen bg-mist text-ink lg:flex">
      <div className="hidden h-screen lg:sticky lg:top-0 lg:block">
        <Sidebar />
      </div>
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex h-[74px] items-center justify-between border-b border-line bg-card/90 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-mute lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-coral">Innflo back office</div>
              <div className="mt-0.5 text-[13px] font-medium text-ink-mute">Manager workspace · hotel operations</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-semibold text-ink">{userName ?? "Manager"}</div>
              <div className="text-[11px] text-ink-mute">{formatRoleLabel(role)}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-coral-soft text-[12px] font-bold text-coral-deep">
              {getInitials(userName) || "M"}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1360px] px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
