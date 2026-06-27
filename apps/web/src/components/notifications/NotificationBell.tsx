import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Bell, CalendarPlus, LogIn, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { notificationsService, type AppNotification } from "@/services/notifications";
import { useEscapeKey } from "@/hooks/useEscapeKey";

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

interface TypeConfig { icon: React.ElementType; bg: string; fg: string }

const TYPE_CONFIG: Record<string, TypeConfig> = {
  NEW_BOOKING:  { icon: CalendarPlus, bg: "#E7EEF3", fg: "#3D5A73" },
  CHECK_IN:     { icon: LogIn,        bg: "#E6F0EA", fg: "#1F4D3A" },
  CHECK_OUT:    { icon: LogOut,       bg: "#FBEAE1", fg: "#9E3417" },
  HOUSEKEEPING: { icon: Sparkles,     bg: "#EDE9F4", fg: "#5B4B82" },
};

function notificationHref(n: AppNotification): string {
  const entityId = n.metadata?.entityId;
  if (n.type === "HOUSEKEEPING") return "/housekeeping";
  if (entityId) return `/reservations/${entityId}`;
  return "/notifications";
}

function NotificationItem({ notification: n, onRead }: { notification: AppNotification; onRead: (n: AppNotification) => void }) {
  const cfg  = TYPE_CONFIG[n.type] ?? { icon: Bell, bg: "#F1ECE4", fg: "#938C81" };
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => onRead(n)}
      className={cn(
        "w-full text-left flex items-start gap-3 py-3.5 px-4 hover:bg-mist transition-colors",
        !n.isRead && "bg-coral/5 border-l-2 border-coral/40",
      )}
    >
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.fg }}
      >
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-ink leading-snug">{n.title}</p>
        <p className="text-[12px] text-ink-mute mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
        <p className="text-[11px] text-ink-faint mt-1">{timeAgo(n.createdAt)}</p>
      </div>
    </button>
  );
}

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 py-3.5 px-4 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-line-soft shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-line-soft rounded w-2/3" />
        <div className="h-3 bg-line-soft rounded w-full" />
        <div className="h-2 bg-line-soft rounded w-1/4" />
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate        = useNavigate();
  const qc              = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  const { data: countData } = useQuery({
    queryKey:             ["notifications-count"],
    queryFn:              notificationsService.getUnreadCount,
    staleTime:            30_000,
    refetchInterval:      30_000,
    refetchOnWindowFocus: true,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey:  ["notifications"],
    queryFn:   notificationsService.getNotifications,
    enabled:   open,
    staleTime: 0,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleRead(n: AppNotification) {
    if (!n.isRead) readMutation.mutate(n.id);
    setOpen(false);
    navigate(notificationHref(n));
  }

  const unreadCount = countData?.count ?? 0;
  const badgeLabel  = unreadCount > 9 ? "9+" : String(unreadCount);
  const items       = notifications ?? [];

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid place-items-center h-9 w-9 rounded-xl transition-colors",
          open ? "text-coral bg-coral-soft" : "text-ink-mute hover:text-ink-soft hover:bg-line-soft",
        )}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-1">
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-[380px] bg-paper rounded-xl2 shadow-float border border-line z-50 overflow-hidden anim-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
            <div className="flex items-center gap-2.5">
              <span className="serif text-[17px] text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-coral-soft text-coral-deep px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending}
                className="text-[12px] text-coral hover:text-coral-dark font-semibold transition-colors disabled:opacity-40"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto scroll-area">
            {isLoading ? (
              <><SkeletonItem /><SkeletonItem /><SkeletonItem /></>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-ink-faint">
                <Bell size={28} className="text-line" />
                <p className="text-[13px] text-ink-mute">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={handleRead} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line-soft px-4 py-3">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-[13px] text-coral hover:text-coral-dark font-semibold transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
