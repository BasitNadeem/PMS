import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Moon, AlertTriangle, CheckCircle2, X, ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  nightAuditService,
  type NightAuditRecord,
  type PreflightCheck,
  type NoShowCandidate,
} from "@/services/nightAudit";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePermissions } from "@/hooks/usePermissions";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
}

// ── Review Modal ──────────────────────────────────────────────────────────────

interface ReviewModalProps {
  businessDate: string;
  preflight: PreflightCheck;
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({ businessDate, preflight, onClose, onSuccess }: ReviewModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canMarkNoShow = has("nightAudit:markNoShow");

  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [exceptionReason, setExceptionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const noShowMutation = useMutation({
    mutationFn: (reservationId: string) => nightAuditService.convertToNoShow(reservationId),
    onSuccess: (_data, reservationId) => {
      setConvertedIds((prev) => new Set([...prev, reservationId]));
      setActionedIds((prev) => new Set([...prev, reservationId]));
      qc.invalidateQueries({ queryKey: ["night-audit-preflight"] });
    },
    onError: () => setError("Failed to mark as no-show. Try again."),
  });

  const runMutation = useMutation({
    mutationFn: () => {
      const skippedIds = [...actionedIds].filter((id) => !convertedIds.has(id));
      return nightAuditService.runNightAudit(
        businessDate,
        skippedIds,
        exceptionReason.trim() || undefined,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["night-audit-business-date"] });
      qc.invalidateQueries({ queryKey: ["night-audit-history"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onSuccess();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to run night audit.");
    },
  });

  const allActioned = preflight.noShowCandidates.every((c) => actionedIds.has(c.reservationId));
  const skippedCount = [...actionedIds].filter((id) => !convertedIds.has(id)).length;
  const unresolvedCount = skippedCount
    + preflight.overdueDepartures.length
    + preflight.roomChargeMismatches.length
    + preflight.unsignedShiftReports.length
    + preflight.unresolvedDiscrepancies
    + preflight.unpostedPosOrders;
  const canConfirm = allActioned
    && (unresolvedCount === 0 || exceptionReason.trim().length > 0)
    && !runMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-line shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-ink text-white shrink-0">
            <Moon size={18} />
          </div>
          <div className="flex-1">
            <h2 className="serif text-[20px] text-ink leading-tight">Night Audit Review</h2>
            <p className="text-[12px] text-ink-mute mt-0.5">{formatDate(businessDate)}</p>
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-6 py-4 space-y-5">
          {error && (
            <div className="rounded-xl bg-clay-soft border border-clay/20 text-clay text-[13px] px-4 py-3">
              {error}
            </div>
          )}

          {/* No-Show Candidates */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              {preflight.noShowCandidates.length > 0 ? (
                <AlertTriangle size={15} className="text-amber shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="text-pine-deep shrink-0" />
              )}
              <span className="text-[13px] font-bold text-ink">
                No-Show Candidates ({preflight.noShowCandidates.length})
              </span>
            </div>
            {preflight.noShowCandidates.length === 0 ? (
              <p className="text-[13px] text-ink-mute pl-5">No pending arrivals — all clear.</p>
            ) : (
              <div className="space-y-2 pl-5">
                {preflight.noShowCandidates.map((c: NoShowCandidate) => {
                  const actioned = actionedIds.has(c.reservationId);
                  const converted = convertedIds.has(c.reservationId);
                  return (
                    <div
                      key={c.reservationId}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        actioned ? "border-line-soft bg-mist/50 opacity-60" : "border-line bg-paper",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink truncate">{c.guestName}</p>
                          <p className="text-[11.5px] text-ink-mute">
                            {c.confirmationNumber} · Room {c.roomNumber}
                          </p>
                        </div>
                        {actioned ? (
                          <span className="shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-line-soft text-ink-mute">
                            {converted ? "No-Show" : "Skipped"}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canMarkNoShow && (
                              <button
                                onClick={() => noShowMutation.mutate(c.reservationId)}
                                disabled={noShowMutation.isPending}
                                className="h-7 px-2.5 rounded-full bg-clay text-white text-[11.5px] font-semibold hover:bg-clay-dark transition-colors disabled:opacity-50"
                              >
                                {noShowMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "No-Show"}
                              </button>
                            )}
                            <button
                              onClick={() => setActionedIds((prev) => new Set([...prev, c.reservationId]))}
                              className="h-7 px-2.5 rounded-full border border-line text-ink-mute text-[11.5px] font-semibold hover:bg-mist transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!allActioned && (
                  <p className="text-[11.5px] text-amber font-medium pt-1">
                    Action each candidate (mark as No-Show or Skip) before closing.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Overdue Departures */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              {preflight.overdueDepartures.length > 0 ? (
                <AlertTriangle size={15} className="text-clay shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="text-pine-deep shrink-0" />
              )}
              <span className="text-[13px] font-bold text-ink">
                Overdue Departures ({preflight.overdueDepartures.length})
              </span>
            </div>
            {preflight.overdueDepartures.length === 0 ? (
              <p className="text-[13px] text-ink-mute pl-5">No overdue departures.</p>
            ) : (
              <div className="space-y-2 pl-5">
                {preflight.overdueDepartures.map((d) => (
                  <div key={d.reservationId} className="rounded-xl border border-clay/20 bg-clay-soft/30 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-ink">{d.guestName}</p>
                    <p className="text-[11.5px] text-ink-mute">
                      {d.confirmationNumber} · Room {d.roomNumber} · checkout was {d.daysOverdue} day{d.daysOverdue !== 1 ? "s" : ""} ago
                    </p>
                    <p className="text-[11px] text-clay mt-0.5 font-medium">Resolve manually in Reservations.</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Room Charge Mismatches */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              {preflight.roomChargeMismatches.length > 0 ? (
                <AlertTriangle size={15} className="text-amber shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="text-pine-deep shrink-0" />
              )}
              <span className="text-[13px] font-bold text-ink">
                Room Charges — {preflight.roomChargeMismatches.length === 0 ? "All Verified" : `${preflight.roomChargeMismatches.length} Mismatch${preflight.roomChargeMismatches.length !== 1 ? "es" : ""}`}
              </span>
            </div>
            {preflight.roomChargeMismatches.length > 0 && (
              <div className="space-y-2 pl-5">
                {preflight.roomChargeMismatches.map((m) => (
                  <div key={m.reservationId} className="rounded-xl border border-amber/20 bg-amber-soft/20 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-ink">{m.confirmationNumber}</p>
                    <p className="text-[11.5px] text-ink-mute">
                      Expected {formatPKR(m.expected)} · Actual {formatPKR(m.actual)} · Diff {formatPKR(Math.abs(m.difference))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              {unresolvedCount > 0
                ? <AlertTriangle size={15} className="shrink-0 text-amber" />
                : <CheckCircle2 size={15} className="shrink-0 text-pine-deep" />}
              <span className="text-[13px] font-bold text-ink">Operational controls</span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-line-soft bg-mist/50 px-3 py-3 text-[12px] text-ink-mute">
              <div className="flex justify-between"><span>Open guest balances</span><strong className="text-ink">{preflight.openBalances.count} · {formatPKR(preflight.openBalances.total)}</strong></div>
              <div className="flex justify-between"><span>Unsigned handovers</span><strong className="text-ink">{preflight.unsignedShiftReports.length}</strong></div>
              <div className="flex justify-between"><span>Unacknowledged cash discrepancies</span><strong className="text-ink">{preflight.unresolvedDiscrepancies}</strong></div>
              <div className="flex justify-between"><span>Unposted POS orders</span><strong className="text-ink">{preflight.unpostedPosOrders}</strong></div>
            </div>
          </section>

          {unresolvedCount > 0 && (
            <section>
              <label className="mb-1.5 block text-[12px] font-bold text-ink">
                Exception note <span className="text-clay">*</span>
              </label>
              <textarea
                value={exceptionReason}
                onChange={(event) => setExceptionReason(event.target.value)}
                placeholder="Explain what remains open and who will follow up…"
                className="min-h-20 w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-coral focus:ring-2 focus:ring-coral/15"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Stored permanently with this audit snapshot.
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => runMutation.mutate()}
            disabled={!canConfirm}
            className="h-10 px-5 rounded-full bg-ink text-white text-[13.5px] font-semibold hover:bg-ink/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {runMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Closing…</>
            ) : (
              <>Confirm &amp; Close {businessDate} <ChevronRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  useEscapeKey(onClose);

  const { data: record, isLoading } = useQuery({
    queryKey: ["night-audit-detail", recordId],
    queryFn: () => nightAuditService.getDetail(recordId),
  });

  const snap = record?.snapshot as Record<string, unknown> | undefined;
  const revenue = snap?.revenue as Record<string, number> | undefined;
  const occupancy = snap?.occupancy as Record<string, number> | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px] anim-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper h-full w-full max-w-md shadow-xl flex flex-col anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex-1">
            <h2 className="serif text-[20px] text-ink">Audit Detail</h2>
            {record && <p className="text-[12px] text-ink-mute mt-0.5">{formatDate(record.businessDate)}</p>}
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-5 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-ink-mute">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : record ? (
            <>
              <div className="rounded-xl border border-line-soft bg-mist p-4 space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-mute">Run at</span>
                  <span className="font-semibold text-ink">{formatDateTime(record.runAt)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-mute">Run by</span>
                  <span className="font-semibold text-ink">{record.runByName}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-mute">Occupancy</span>
                  <span className="font-semibold text-ink">{record.occupancyRate.toFixed(1)}%</span>
                </div>
                {occupancy && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-ink-mute">Rooms occupied</span>
                    <span className="font-semibold text-ink">{occupancy.occupied ?? "—"} / {occupancy.totalRooms ?? "—"}</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-ink-faint mb-2">Revenue Snapshot</h3>
                <div className="rounded-xl border border-line-soft divide-y divide-line-soft">
                  {[
                    ["Room Revenue",    record.roomRevenue],
                    ["POS Revenue",     record.posRevenue],
                    ["Total Collected", record.totalCollected],
                    ["Outstanding",     record.totalOutstanding],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between px-4 py-2.5 text-[13px]">
                      <span className="text-ink-mute">{label as string}</span>
                      <span className="font-semibold text-ink">{formatPKR(val as number)}</span>
                    </div>
                  ))}
                  {revenue && (
                    <div className="flex justify-between px-4 py-2.5 text-[13px]">
                      <span className="text-ink-mute">Other Charges</span>
                      <span className="font-semibold text-ink">{formatPKR(revenue.otherCharges ?? 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-ink-faint mb-2">Flags</h3>
                <div className="rounded-xl border border-line-soft divide-y divide-line-soft">
                  <div className="flex justify-between px-4 py-2.5 text-[13px]">
                    <span className="text-ink-mute">No-shows flagged</span>
                    <span className={cn("font-semibold", record.noShowsFlagged > 0 ? "text-amber" : "text-ink")}>{record.noShowsFlagged}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-[13px]">
                    <span className="text-ink-mute">Open balances</span>
                    <span className={cn("font-semibold", record.openBalanceCount > 0 ? "text-clay" : "text-ink")}>{record.openBalanceCount}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-ink-mute text-center py-8">Record not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NightAuditPage() {
  const [showReview, setShowReview] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const { has } = usePermissions();
  const canRun = has("nightAudit:run");

  const { data: businessDate, isLoading: bdLoading, isError: businessDateError } = useQuery({
    queryKey: ["night-audit-business-date"],
    queryFn: nightAuditService.getBusinessDate,
  });

  const {
    data: preflight,
    isLoading: preflightLoading,
    isError: preflightError,
    refetch: refetchPreflight,
  } = useQuery({
    queryKey: ["night-audit-preflight", businessDate],
    queryFn: () => nightAuditService.getPreflightCheck(businessDate!),
    enabled: !!businessDate && showReview,
  });

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["night-audit-history", historyPage],
    queryFn: () => nightAuditService.listHistory(historyPage, 20),
  });

  const history = historyData?.data ?? [];
  const lastAudit = history[0];

  function handleRunClick() {
    refetchPreflight();
    setShowReview(true);
  }

  function handleAuditSuccess() {
    setShowReview(false);
    setAuditSuccess(businessDate ?? null);
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-mute mb-2">
          <Moon size={14} className="text-coral" />
          Night Audit
        </div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Night Audit</h1>
        <p className="mt-1.5 text-[14px] text-ink-mute">
          Review exceptions, freeze the day’s operating snapshot, and advance the next audit date.
        </p>
      </div>

      {/* Current business date card */}
      <div className="rounded-2xl bg-ink text-white p-6 mb-5 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60 mb-1">
            Next Audit Date
          </div>
          {bdLoading ? (
            <div className="h-9 w-48 rounded-xl bg-white/10 animate-pulse" />
          ) : (
            <div className="serif text-[30px] leading-none text-white">
              {businessDate ? formatDate(businessDate) : "—"}
            </div>
          )}
          {lastAudit ? (
            <p className="text-[12.5px] text-white/55 mt-2">
              Last audit: {formatDate(lastAudit.businessDate)} at {formatDateTime(lastAudit.runAt)} by {lastAudit.runByName}
            </p>
          ) : (
            <p className="text-[12.5px] text-white/55 mt-2">No audits run yet.</p>
          )}
        </div>
      </div>
      {businessDateError && (
        <div className="mb-5 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 text-[13px] text-clay">
          The next audit date could not be loaded. Reload this page before running Night Audit.
        </div>
      )}

      {/* Success banner */}
      {auditSuccess && (
        <div className="flex items-center gap-3 rounded-xl bg-pine-soft border border-pine/20 px-4 py-3 mb-5">
          <CheckCircle2 size={16} className="text-pine-deep shrink-0" />
          <p className="text-[13px] font-semibold text-pine-deep flex-1">
            Night audit for {auditSuccess} completed. The next audit date has advanced.
          </p>
          <button onClick={() => setAuditSuccess(null)} className="text-ink-mute hover:text-ink">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Run button */}
      {!canRun ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-mist px-4 py-3">
          <Moon size={16} className="shrink-0 text-ink-mute" />
          <p className="text-[13px] font-semibold text-ink-soft">
            You can review audit history, but your role cannot close an audit date.
          </p>
        </div>
      ) : preflight?.alreadyAudited ? (
        <div className="flex items-center gap-3 rounded-xl bg-mist border border-line px-4 py-3 mb-6">
          <CheckCircle2 size={16} className="text-pine-deep shrink-0" />
          <p className="text-[13px] font-semibold text-ink-soft">
            Audit for {businessDate} already completed.
          </p>
        </div>
      ) : (
        <button
          onClick={handleRunClick}
          disabled={!businessDate}
          className="flex items-center gap-2 h-11 px-6 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-50 mb-6"
        >
          <Moon size={16} />
          Run Night Audit for {businessDate ?? "…"}
        </button>
      )}

      {/* History table */}
      <div id="history" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="serif text-[22px] text-ink">Audit History</h2>
        </div>

        {historyLoading ? (
          <div className="flex justify-center rounded-2xl border border-line-soft py-14">
            <Loader2 size={22} className="animate-spin text-coral" />
          </div>
        ) : historyError ? (
          <div className="rounded-2xl border border-clay/20 bg-clay-soft px-4 py-8 text-center text-[13px] text-clay">
            Audit history could not be loaded.
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-mist/40 py-16 flex flex-col items-center gap-3 text-center">
            <Moon size={32} className="text-line" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-ink-mute">No night audits run yet</p>
            <p className="text-[12.5px] text-ink-faint max-w-xs">
              Run your first audit to establish your business date and begin tracking daily closures.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line-soft overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-mist/60">
                  {["Business Date", "Run At", "Run By", "Occupancy", "Revenue", "No-Shows"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {history.map((r: NightAuditRecord) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRecordId(r.id)}
                    className="hover:bg-mist/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-ink">{r.businessDate}</td>
                    <td className="px-4 py-3 text-ink-mute">{formatDateTime(r.runAt)}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.runByName}</td>
                    <td className="px-4 py-3 text-ink">{r.occupancyRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-ink">{formatPKR(r.totalCollected)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        r.noShowsFlagged > 0 ? "bg-amber-soft text-amber" : "bg-pine-soft text-pine-deep",
                      )}>
                        {r.noShowsFlagged > 0 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                        {r.noShowsFlagged}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(historyData?.meta.totalPages ?? 1) > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-ink-mute">
              Page {historyData?.meta.page ?? 1} of {historyData?.meta.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={historyPage >= (historyData?.meta.totalPages ?? 1)}
                onClick={() => setHistoryPage((page) => page + 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review modal */}
      {showReview && businessDate && (
        preflightLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
            <div className="bg-paper rounded-2xl p-8 flex items-center gap-3 shadow-xl">
              <Loader2 size={20} className="animate-spin text-coral" />
              <span className="text-[14px] font-semibold text-ink">Loading preflight check…</span>
            </div>
          </div>
        ) : preflightError ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-paper p-6 text-center shadow-xl">
              <AlertTriangle size={24} className="mx-auto text-clay" />
              <p className="mt-3 text-[14px] font-semibold text-ink">Preflight could not be loaded</p>
              <p className="mt-1 text-[12px] text-ink-mute">Nothing has been closed. Retry the checks before continuing.</p>
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={() => setShowReview(false)} className="rounded-full border border-line px-4 py-2 text-[12px] font-semibold">Cancel</button>
                <button onClick={() => void refetchPreflight()} className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white">Retry</button>
              </div>
            </div>
          </div>
        ) : preflight ? (
          <ReviewModal
            businessDate={businessDate}
            preflight={preflight}
            onClose={() => setShowReview(false)}
            onSuccess={handleAuditSuccess}
          />
        ) : null
      )}

      {/* Detail drawer */}
      {selectedRecordId && (
        <DetailDrawer
          recordId={selectedRecordId}
          onClose={() => setSelectedRecordId(null)}
        />
      )}
    </div>
  );
}
