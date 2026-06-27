import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ChefHat, ClipboardList, Monitor, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getCurrentUserName, getInitials } from "@/lib/jwt";
import { useEscapeKey } from "@/hooks/useEscapeKey";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const userName = getCurrentUserName();

  function logout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-5 pb-5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-[38px] w-[38px] rounded-2xl bg-ink shrink-0">
            <ChefHat size={20} className="text-amber" />
          </div>
          <div className="leading-tight">
            <div className="serif text-[18px] text-ink">Kitchen</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
              Manager
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Kitchen
        </div>

        <NavLink
          to="/kitchen/dashboard"
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-all duration-200",
              isActive
                ? "bg-ink text-white shadow-pop"
                : "text-ink-soft hover:bg-line-soft",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-coral -ml-3" />
              )}
              <ClipboardList
                size={19}
                strokeWidth={isActive ? 2.1 : 1.9}
                className={isActive ? "text-coral" : "text-ink-mute group-hover:text-ink-soft"}
              />
              <span>Live Orders</span>
            </>
          )}
        </NavLink>

        <button
          onClick={() => { window.open("/kitchen/display", "_blank"); onNavigate?.(); }}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-line-soft transition-all duration-200"
        >
          <Monitor
            size={19}
            strokeWidth={1.9}
            className="text-ink-mute group-hover:text-ink-soft"
          />
          <span>Display Mode</span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-line-soft px-1.5 py-0.5 rounded">
            TV
          </span>
        </button>
      </nav>

      {/* User footer */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2">
            <div
              className="grid place-items-center rounded-full font-bold text-[13px] shrink-0"
              style={{ width: 36, height: 36, background: "#FFF3CD", color: "#7D5A00" }}
            >
              {getInitials(userName) || "K"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13px] font-semibold text-ink truncate">{userName ?? "Kitchen"}</div>
              <div className="text-[11px] text-ink-mute">Kitchen Manager</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="grid place-items-center h-9 w-9 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function KitchenLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEscapeKey(() => setMobileNavOpen(false), mobileNavOpen);

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-mist border-r border-line h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm anim-fade-in" />
          <div
            className="absolute left-0 top-0 h-full w-[240px] bg-mist anim-slide-in"
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
            <div className="grid place-items-center h-8 w-8 rounded-xl bg-ink shrink-0">
              <ChefHat size={16} className="text-amber" />
            </div>
            <span className="serif text-[17px]">Kitchen</span>
          </div>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="grid place-items-center h-9 w-9 rounded-lg text-ink-soft hover:bg-line-soft"
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scroll-area">
          {children}
        </main>
      </div>
    </div>
  );
}
