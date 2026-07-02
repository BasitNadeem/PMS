import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BedDouble, Users, Users2, CalendarCheck,
  Landmark, Sparkles, ShoppingCart, FileBarChart, LogOut,
  ChevronsUpDown, PanelLeftClose, PanelLeftOpen, TrendingUp, Menu, X, Settings,
  Receipt, TrendingDown, BookOpen, Wrench, ClipboardList, ChefHat, Monitor, Package,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchBar } from "@/components/layout/GlobalSearchBar";
import { dashboardService } from "@/services/dashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getCurrentUserName, getCurrentUserRole, formatRoleLabel, getInitials } from "@/lib/jwt";
import { applyTheme } from "@/lib/theme";

interface Hotel {
  id: string;
  name: string;
  propertyType: string;
  logoUrl?: string;
  settings?: { themeKey?: string };
}

function formatPropertyType(type?: string): string {
  if (!type) return "Property";
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function PropertyLogo({ hotel, size = 38 }: { hotel?: Hotel | null; size?: number }) {
  if (hotel?.logoUrl) {
    return (
      <img
        src={hotel.logoUrl}
        alt={hotel.name}
        className="rounded-2xl object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Logo size={size} />;
}

interface NavSubItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  permission: string;
  roleOnly?: string;
  newTab?: boolean;
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/kitchen/dashboard", label: "Kitchen Dashboard", icon: ChefHat,   permission: "pos:read",    roleOnly: "KITCHEN" },
  { to: "/kitchen/display",   label: "Display Mode",      icon: Monitor,   permission: "pos:read",    roleOnly: "KITCHEN", newTab: true },
  { to: "/",             label: "Dashboard",    icon: LayoutDashboard, end: true, permission: "dashboard:read" },
  { to: "/reservations", label: "Reservations", icon: CalendarCheck, permission: "reservations:read" },
  { to: "/rooms",        label: "Rooms",        icon: BedDouble, permission: "rooms:read" },
  { to: "/guests",       label: "Guests",       icon: Users, permission: "guests:read" },
  {
    to: "/financials",   label: "Financials",   icon: Landmark,
    permission: "billing:read",
    children: [
      { to: "/financials",          label: "Billing",   icon: Receipt, permission: "billing:read" },
      { to: "/financials/expenses", label: "Expenses",  icon: TrendingDown, permission: "expenses:read" },
      { to: "/financials/cashbook", label: "Balance Book", icon: BookOpen, permission: "cashbook:read" },
    ],
  },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles, permission: "housekeeping:read" },
  { to: "/maintenance",  label: "Maintenance",  icon: Wrench, permission: "maintenance:read" },
  { to: "/team",         label: "Team",         icon: Users2, permission: "team:read" },
  { to: "/pos",          label: "POS",       icon: ShoppingCart,  permission: "pos:read" },
  { to: "/qr-orders",    label: "QR Orders", icon: ClipboardList, permission: "pos:read" },
  { to: "/inventory",    label: "Inventory", icon: Package,       permission: "pos:read" },
  { to: "/reports", label: "Reports", icon: FileBarChart, permission: "reports:read" },
];

function Logo({ size = 38 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl bg-ink shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path d="M3 19 L9 7 L13 14 L16 9 L21 19 Z" fill="rgb(var(--color-accent))" />
        <path d="M9 7 L11 11 L9.6 11.6 Z" fill="#fff" fillOpacity="0.85" />
        <circle cx="17.5" cy="6" r="1.6" fill="#F6C453" />
      </svg>
    </div>
  );
}

function OccupancyMini() {
  const { data: dash } = useQuery({
    queryKey:       ["dashboard"],
    queryFn:        dashboardService.getDashboard,
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  const occ   = dash?.occupancy;
  const pct   = occ ? Math.round((occ.occupiedRooms / Math.max(occ.totalRooms, 1)) * 100) : 0;
  const rooms = occ?.occupiedRooms ?? 0;
  const total = occ?.totalRooms   ?? 0;

  const barColor = pct < 30 ? "#BB4A33" : pct < 70 ? "#B7791A" : "#2F7256";

  return (
    <div className="rounded-xl2 bg-ink p-4 text-white relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-coral/20 blur-xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">Occupancy</span>
          <TrendingUp size={15} className="text-coral" />
        </div>
        <div className="mt-1 flex items-end gap-1.5">
          <span className="serif text-[30px] leading-none tnum">{pct}%</span>
          <span className="mb-1 text-[12px] text-white/55">{rooms}/{total} rooms</span>
        </div>
        <div className="mt-2.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + "%", background: barColor }} />
        </div>
      </div>
    </div>
  );
}

function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect();
          setPos({ top: r.top + r.height / 2, left: r.right + 8 });
        }
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <div
          className="fixed z-[300] -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white pointer-events-none shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}

function SidebarContent({
  onNavigate,
  collapsed = false,
  pinned = true,
  onTogglePin,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const { has, hasAny } = usePermissions();
  const { data: hotel } = useQuery<Hotel>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    applyTheme(undefined);
    navigate("/login");
  }

  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const openSubmenuFor = useCallback((to: string, rect: DOMRect) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setSubmenuPos({ top: rect.top, left: rect.right + 8 });
    setActiveSubmenu(to);
  }, []);

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setActiveSubmenu(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const navItems = NAV_ITEMS
    .filter((item) => {
      if (item.roleOnly && item.roleOnly !== userRole) return false;
      return item.children
        ? hasAny(item.children.map((c) => c.permission))
        : has(item.permission);
    })
    .map((item) => item.children
      ? { ...item, children: item.children.filter((c) => has(c.permission)) }
      : item);

  return (
    <div className="flex flex-col h-full">
      {/* Brand / Property block — toggle lives in the same row to save vertical space */}
      {collapsed ? (
        <>
          {onTogglePin && (
            <div className="flex justify-center pt-3 pb-1">
              <SidebarTooltip label="Expand sidebar">
                <button
                  onClick={onTogglePin}
                  className="grid place-items-center h-8 w-8 rounded-lg text-ink-mute hover:bg-line-soft hover:text-ink transition-colors"
                >
                  <PanelLeftOpen size={19} />
                </button>
              </SidebarTooltip>
            </div>
          )}
          <div className="flex justify-center pb-2">
            <PropertyLogo hotel={hotel} size={34} />
          </div>
        </>
      ) : (
        <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            {(userRole === "OWNER" || userRole === "ADMIN") ? (
              <button
                onClick={() => navigate("/settings")}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left cursor-pointer hover:border-ink hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
              >
                <PropertyLogo hotel={hotel} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="serif text-[18px] text-ink truncate">{hotel?.name ?? "Loading…"}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                    {formatPropertyType(hotel?.propertyType)}
                  </div>
                </div>
                <ChevronsUpDown size={14} className="text-ink-faint group-hover:text-ink-mute shrink-0" />
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1">
                <PropertyLogo hotel={hotel} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="serif text-[18px] text-ink truncate">{hotel?.name ?? "Loading…"}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                    {formatPropertyType(hotel?.propertyType)}
                  </div>
                </div>
              </div>
            )}
          </div>
          {onTogglePin && (
            <SidebarTooltip label="Collapse sidebar">
              <button
                onClick={onTogglePin}
                className="grid place-items-center h-8 w-8 rounded-lg text-ink-mute hover:bg-line-soft hover:text-ink transition-colors"
              >
                <PanelLeftClose size={19} />
              </button>
            </SidebarTooltip>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-area px-3 pt-1 pb-2">
        {!collapsed && (
          <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Operations
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const hasChildren = !!item.children?.length;
            // Parent is active if path starts with its route (ignoring sub-routes)
            const parentActive = hasChildren
              ? pathname.startsWith(item.to)
              : false;

            return (
              <div
                key={item.to}
                onMouseEnter={collapsed && hasChildren ? (e) => openSubmenuFor(item.to, e.currentTarget.getBoundingClientRect()) : undefined}
                onMouseLeave={collapsed && hasChildren ? scheduleClose : undefined}
              >
                {item.newTab ? (
                  <button
                    onClick={() => { window.open(item.to, "_blank"); onNavigate?.(); }}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl py-2.5 text-[14px] font-semibold transition-all duration-200 text-ink-soft hover:bg-line-soft",
                      collapsed ? "justify-center px-0" : "px-3",
                    )}
                  >
                    <item.icon size={19} strokeWidth={1.9} className="text-ink-mute group-hover:text-ink-soft shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-line-soft px-1.5 py-0.5 rounded">TV</span>
                      </>
                    )}
                  </button>
                ) : (
                <NavLink
                  to={item.to}
                  end={item.end ?? (!hasChildren)}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-xl py-2.5 text-[14px] font-semibold transition-all duration-200",
                      "outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-0",
                      collapsed ? "justify-center px-0" : "px-3",
                      (isActive || parentActive)
                        ? "bg-ink text-white shadow-pop"
                        : "text-ink-soft hover:bg-line-soft",
                    )
                  }
                >
                  {({ isActive }) => {
                    const on = isActive || parentActive;
                    return (
                      <>
                        {on && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-coral -ml-3" />
                        )}
                        <item.icon
                          size={19}
                          strokeWidth={on ? 2.1 : 1.9}
                          className={cn("shrink-0", on ? "text-coral" : "text-ink-mute group-hover:text-ink-soft")}
                        />
                        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                      </>
                    );
                  }}
                </NavLink>
                )}

                {/* Sub-items — visible when parent route is active and sidebar is not collapsed */}
                {hasChildren && parentActive && !collapsed && (
                  <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-line-soft flex flex-col gap-0.5">
                    {item.children!.map((sub) => {
                      // Billing is active on /financials and /financials/folio/*
                      // Expenses is active on /financials/expenses
                      const subActive = sub.to === "/financials"
                        ? !pathname.startsWith("/financials/expenses") && !pathname.startsWith("/financials/cashbook")
                        : pathname.startsWith(sub.to);
                      return (
                        <button
                          key={sub.to}
                          onClick={() => { navigate(sub.to); onNavigate?.(); }}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all w-full text-left",
                            subActive
                              ? "text-coral bg-coral/8"
                              : "text-ink-mute hover:text-ink-soft hover:bg-line-soft",
                          )}
                        >
                          <sub.icon
                            size={15}
                            strokeWidth={subActive ? 2.2 : 1.8}
                            className={subActive ? "text-coral" : "text-ink-faint"}
                          />
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Collapsed sidebar hover submenu — rendered in a portal to escape overflow:hidden */}
      {collapsed && (() => {
        const activeItem = activeSubmenu ? navItems.find((i) => i.to === activeSubmenu) : null;
        if (!activeItem?.children?.length) return null;
        return createPortal(
          <div
            style={{ top: submenuPos.top, left: submenuPos.left }}
            className="fixed z-[200] bg-white rounded-xl shadow-float py-1.5 min-w-[180px] border border-line"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              {activeItem.label}
            </div>
            {activeItem.children.map((sub) => {
              const subActive = sub.to === "/financials"
                ? !pathname.startsWith("/financials/expenses") && !pathname.startsWith("/financials/cashbook")
                : pathname.startsWith(sub.to);
              return (
                <button
                  key={sub.to}
                  onClick={() => { navigate(sub.to); setActiveSubmenu(null); onNavigate?.(); }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-semibold text-left transition-colors",
                    subActive
                      ? "text-coral bg-coral/8"
                      : "text-ink-soft hover:bg-line-soft",
                  )}
                >
                  <sub.icon
                    size={15}
                    strokeWidth={subActive ? 2.2 : 1.8}
                    className={subActive ? "text-coral" : "text-ink-faint"}
                  />
                  {sub.label}
                </button>
              );
            })}
          </div>,
          document.body,
        );
      })()}

      {/* Occupancy mini widget */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <OccupancyMini />
        </div>
      )}


      {/* User footer */}
      <div className="border-t border-line p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={logout}
              title="Sign out"
              className="grid place-items-center rounded-full font-bold text-[12px] hover:opacity-80 transition-opacity"
              style={{ width: 32, height: 32, background: "rgb(var(--color-accent-soft))", color: "rgb(var(--color-accent-deep))" }}
            >
              {getInitials(userName) || "?"}
            </button>
            {has("settings:read") && (
              <button
                onClick={() => navigate("/settings")}
                className="grid place-items-center h-8 w-8 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-line-soft transition-colors text-left"
            >
              <div
                className="grid place-items-center rounded-full font-bold text-[13px] shrink-0"
                style={{ width: 36, height: 36, background: "rgb(var(--color-accent-soft))", color: "rgb(var(--color-accent-deep))" }}
              >
                {getInitials(userName) || "?"}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] font-semibold text-ink truncate">{userName ?? "User"}</div>
                <div className="text-[11px] text-ink-mute">{formatRoleLabel(userRole)}</div>
              </div>
            </button>
            <button
              onClick={logout}
              className="grid place-items-center h-9 w-9 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
            {has("settings:read") && (
              <button
                onClick={() => navigate("/settings")}
                className="grid place-items-center h-9 w-9 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TempPasswordBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("tempPasswordBannerDismissed") === "true",
  );
  const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";

  if (!isFirstLogin || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("tempPasswordBannerDismissed", "true");
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-soft border-b border-amber/20 px-5 sm:px-7 lg:px-8 py-2.5">
      <span className="text-[13px] text-ink-soft">
        🔐 You&apos;re using a temporary password. Update it now in Settings → Security
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/settings#security")}
          className="text-[13px] font-semibold text-coral hover:underline whitespace-nowrap"
        >
          Go to Security Settings →
        </button>
        <button
          onClick={dismiss}
          className="grid place-items-center h-6 w-6 rounded-full text-ink-faint hover:bg-amber/10 hover:text-ink-mute"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_RAIL = 80;
const SIDEBAR_FULL = 252;

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEscapeKey(() => setMobileNavOpen(false), mobileNavOpen);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  const { data: hotel } = useQuery<Hotel>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    applyTheme(hotel?.settings?.themeKey);
  }, [hotel?.settings?.themeKey]);

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col bg-mist border-r border-line shrink-0 h-screen sticky top-0 overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? SIDEBAR_RAIL : SIDEBAR_FULL }}
      >
        <SidebarContent
          collapsed={collapsed}
          pinned={!collapsed}
          onTogglePin={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm anim-fade-in" />
          <div
            className="absolute left-0 top-0 h-full w-[270px] bg-mist anim-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-mist/90 backdrop-blur border-b border-line px-4 h-14">
          <div className="flex items-center gap-2.5">
            <PropertyLogo hotel={hotel} size={32} />
            <span className="serif text-[17px] whitespace-nowrap truncate max-w-[160px]">{hotel?.name ?? ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="grid place-items-center h-9 w-9 rounded-lg text-ink-soft hover:bg-line-soft"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop search — shares the same row as the page top padding, saving vertical space */}
        <div className="hidden lg:flex sticky top-0 z-30 items-center justify-end bg-paper/95 backdrop-blur-sm px-7 h-8 border-b border-line/40">
          <GlobalSearchBar />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scroll-area">
          <TempPasswordBanner />
          <div className="px-5 sm:px-7 lg:px-8 py-5 lg:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
