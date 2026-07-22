import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarPlus, LogIn, LogOut, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { notificationsService, type AppNotification } from "../../services/notifications";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (mins > 0)  return `${mins} min${mins > 1 ? "s" : ""} ago`;
  return "just now";
}

const TYPE_ICON: Record<string, React.ElementType> = {
  NEW_BOOKING:  CalendarPlus,
  CHECK_IN:     LogIn,
  CHECK_OUT:    LogOut,
  HOUSEKEEPING: Sparkles,
};
const TYPE_COLOR: Record<string, string> = {
  NEW_BOOKING:  "bg-blue-100 text-blue-600",
  CHECK_IN:     "bg-green-100 text-green-600",
  CHECK_OUT:    "bg-orange-100 text-orange-600",
  HOUSEKEEPING: "bg-purple-100 text-purple-600",
};

function NotificationRow({ n }: { n: AppNotification }) {
  const Icon     = TYPE_ICON[n.type] ?? Bell;
  const colorCls = TYPE_COLOR[n.type] ?? "bg-gray-100 text-gray-600";

  return (
    <tr className={cn("border-b border-line-soft hover:bg-mist transition-colors", !n.isRead && "bg-coral-tint/50")}>
      <td className="px-5 py-3">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colorCls)}>
          <Icon size={14} />
        </div>
      </td>
      <td className="px-5 py-3 text-[14px] font-semibold text-ink">{n.title}</td>
      <td className="px-5 py-3 text-[13px] text-ink-mute max-w-xs truncate">{n.body}</td>
      <td className="px-5 py-3 text-[12px] text-ink-faint whitespace-nowrap">{timeAgo(n.createdAt)}</td>
      <td className="px-5 py-3">
        <span className={cn(
          "text-[11px] px-2.5 py-1 rounded-full font-semibold",
          n.isRead
            ? "bg-line-soft text-ink-mute"
            : "bg-pine-soft text-pine-deep",
        )}>
          {n.isRead ? "Read" : "Unread"}
        </span>
      </td>
    </tr>
  );
}

export default function NotificationsPage() {
  const qc      = useQueryClient();
  useRealtimeSync();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-all", page],
    queryFn:  () => notificationsService.getAllNotifications(page),
    refetchInterval: 15_000,
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const notifications = data?.data ?? [];
  const meta          = data?.meta;

  return (
    <div>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Activity</div>
            <h1 className="serif text-[34px] leading-[1.05] text-ink">Notifications</h1>
            <p className="mt-1.5 text-[15px] text-ink-mute">All activity and alerts</p>
          </div>
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-sm text-coral hover:text-coral-dark font-semibold border border-coral/30 rounded-full px-4 py-2 hover:bg-coral-soft transition-colors whitespace-nowrap"
          >
            {markAllMutation.isPending ? "Marking…" : "Mark all as read"}
          </button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl2 border border-line shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-mist">
                <th className="px-5 py-3 w-12" />
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Title</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Message</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Time</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-line-soft animate-pulse">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-3 bg-line-soft rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-ink-faint">
                      <Bell size={32} className="text-ink-faint" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                notifications.map((n) => <NotificationRow key={n.id} n={n} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-mute">Page {meta.page} of {meta.totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className={cn("border border-line rounded-full px-4 py-1.5 text-sm text-ink-mute bg-card", page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
                className={cn("border border-line rounded-full px-4 py-1.5 text-sm text-ink-mute bg-card", page >= meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
