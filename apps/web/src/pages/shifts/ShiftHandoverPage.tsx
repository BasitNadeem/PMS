import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarPlus, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Download, LogIn, LogOut, PenLine, ShoppingCart, Wrench, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { StatusBadge, TONE } from "@/components/ui/StatusBadge";
import {
  shiftsService,
  type BriefingHKItem,
  type BriefingMaintenanceItem,
  type BriefingNote,
  type HandoverBriefing,
  type ShiftReport,
  type ShiftType,
  type ListShiftsParams,
} from "@/services/shifts";
import { DatePicker } from "@/components/ui/DatePicker";

function formatPKR(paisas: number): string {
  return "PKR " + Math.floor(paisas / 100).toLocaleString("en-PK");
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function currentShiftContext(): { shiftDate: string; shiftType: ShiftType } {
  const now = new Date();
  const pktHour = (now.getUTCHours() + 5) % 24;

  let shiftType: ShiftType;
  if (pktHour >= 6 && pktHour < 14) shiftType = "MORNING";
  else if (pktHour >= 14 && pktHour < 22) shiftType = "EVENING";
  else shiftType = "NIGHT";

  // NIGHT spans 22:00–06:00 PKT (crosses midnight).
  // If pktHour is 0–5 we are in the continuation of the PREVIOUS day's night shift.
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const pktDate = new Date(pktMs);
  if (shiftType === "NIGHT" && pktHour < 6) {
    pktDate.setUTCDate(pktDate.getUTCDate() - 1);
  }
  const shiftDate = `${pktDate.getUTCFullYear()}-${String(pktDate.getUTCMonth() + 1).padStart(2, "0")}-${String(pktDate.getUTCDate()).padStart(2, "0")}`;

  return { shiftDate, shiftType };
}

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "EVENING", label: "Evening" },
  { value: "NIGHT",   label: "Night"   },
];

const DISCREPANCY_THRESHOLD = 50_000; // paisas

const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

interface SubmitForm {
  shiftDate: string;
  shiftType: ShiftType;
  openingBalance: string;
  cashCollected: string;
  cashExpenses: string;
  checkIns: string;
  checkOuts: string;
  newBookings: string;
  posOrders: string;
  notes: string;
}

function rupeesToPaisas(v: string): number {
  return Math.round((Number(v) || 0) * 100);
}

function StatBox({ icon: Icon, label, value, onChange }: {
  icon: React.ElementType; label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-mist p-3.5">
      <div className="flex items-center gap-2 text-ink-mute mb-2">
        <Icon size={15} />
        <span className="text-[12px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent serif text-[24px] text-ink tnum outline-none"
      />
    </div>
  );
}

function BriefingSection({
  title, count, defaultOpen = true, children,
}: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen && count > 0);
  if (count === 0) return null;
  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-mist hover:bg-line-soft transition-colors text-left"
      >
        <span className="text-[13px] font-semibold text-ink">
          {title}{" "}
          <span className="ml-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-line text-ink-mute">{count}</span>
        </span>
        {open ? <ChevronDown size={15} className="text-ink-faint" /> : <ChevronRight size={15} className="text-ink-faint" />}
      </button>
      {open && <div className="divide-y divide-line-soft">{children}</div>}
    </div>
  );
}

function BriefingCard({
  briefing,
  flagged,
  onToggle,
}: {
  briefing: HandoverBriefing;
  flagged: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const total =
    briefing.pendingHousekeeping.length +
    briefing.openMaintenance.length +
    briefing.unresolvedNotes.length;

  if (
    total === 0 &&
    briefing.tomorrowArrivals.length === 0 &&
    briefing.tomorrowDepartures.length === 0
  ) {
    return (
      <Card>
        <h3 className="serif text-[18px] text-ink mb-3">Handover Briefing</h3>
        <p className="text-[13px] text-ink-faint">No pending items to hand over.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="serif text-[18px] text-ink mb-4">Handover Briefing</h3>
      <div className="space-y-3">
        <BriefingSection title="Pending Housekeeping" count={briefing.pendingHousekeeping.length}>
          {briefing.pendingHousekeeping.map((t: BriefingHKItem) => (
            <label key={t.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-mist/60">
              <input
                type="checkbox"
                className="mt-0.5 accent-coral"
                checked={flagged[t.id] !== false}
                onChange={(e) => onToggle(t.id, e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-ink">
                  Room {t.roomNumber ?? "—"} — {t.taskType.replace(/_/g, " ")}
                </span>
                <div className="mt-0.5">
                  <StatusBadge status={t.status} size="sm" />
                </div>
              </div>
            </label>
          ))}
        </BriefingSection>

        <BriefingSection title="Open Maintenance" count={briefing.openMaintenance.length}>
          {briefing.openMaintenance.map((t: BriefingMaintenanceItem) => (
            <label key={t.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-mist/60">
              <input
                type="checkbox"
                className="mt-0.5 accent-coral"
                checked={flagged[t.id] !== false}
                onChange={(e) => onToggle(t.id, e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-ink">
                  {t.roomNumber ? `Room ${t.roomNumber} — ` : ""}{t.title}
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <StatusBadge status={t.priority} size="sm" />
                  <StatusBadge status={t.status} size="sm" />
                </div>
              </div>
            </label>
          ))}
        </BriefingSection>

        <BriefingSection
          title={`Tomorrow's Arrivals / Departures`}
          count={briefing.tomorrowArrivals.length + briefing.tomorrowDepartures.length}
          defaultOpen={false}
        >
          {briefing.tomorrowArrivals.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <LogIn size={14} className="text-pine shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-ink">{r.guestName}</span>
                {r.roomTypeName && <span className="text-[12px] text-ink-faint ml-2">{r.roomTypeName}</span>}
              </div>
              <span className="text-[11px] font-mono text-ink-faint">{r.confirmationNumber}</span>
            </div>
          ))}
          {briefing.tomorrowDepartures.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <LogOut size={14} className="text-coral shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-ink">{r.guestName}</span>
                {r.roomNumber && <span className="text-[12px] text-ink-faint ml-2">Room {r.roomNumber}</span>}
              </div>
            </div>
          ))}
        </BriefingSection>

        <BriefingSection title="Unresolved Front Desk Notes" count={briefing.unresolvedNotes.length}>
          {briefing.unresolvedNotes.map((n: BriefingNote) => (
            <label key={n.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-mist/60">
              <input
                type="checkbox"
                className="mt-0.5 accent-coral"
                checked={flagged[n.id] !== false}
                onChange={(e) => onToggle(n.id, e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-ink">{n.text}</p>
                <p className="text-[11.5px] text-ink-faint mt-0.5">{n.createdByName} · {fmtDateTime(n.createdAt)}</p>
              </div>
            </label>
          ))}
        </BriefingSection>
      </div>
    </Card>
  );
}

// Read-only briefing snapshot for the detail drawer
function BriefingSnapshot({ briefing }: { briefing: HandoverBriefing }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  function toggle(key: string) { setOpenSections((s) => ({ ...s, [key]: !s[key] })); }

  function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const isOpen = openSections[id] !== false;
    return (
      <div className="border border-line rounded-xl overflow-hidden">
        <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-4 py-2.5 bg-mist text-left">
          <span className="text-[12.5px] font-semibold text-ink">{title}</span>
          {isOpen ? <ChevronDown size={13} className="text-ink-faint" /> : <ChevronRight size={13} className="text-ink-faint" />}
        </button>
        {isOpen && <div className="divide-y divide-line-soft px-4 py-2">{children}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {briefing.pendingHousekeeping.length > 0 && (
        <Section id="hk" title={`Pending Housekeeping (${briefing.pendingHousekeeping.length})`}>
          {briefing.pendingHousekeeping.map((t) => (
            <div key={t.id} className="py-2 flex items-center gap-3">
              {t.flagged !== false && <span className="text-coral text-[11px] font-bold">●</span>}
              <span className="text-[12.5px] text-ink">Room {t.roomNumber ?? "—"} — {t.taskType.replace(/_/g, " ")}</span>
              <StatusBadge status={t.status} size="sm" />
            </div>
          ))}
        </Section>
      )}
      {briefing.openMaintenance.length > 0 && (
        <Section id="maint" title={`Open Maintenance (${briefing.openMaintenance.length})`}>
          {briefing.openMaintenance.map((t) => (
            <div key={t.id} className="py-2 flex items-center gap-3">
              {t.flagged !== false && <span className="text-coral text-[11px] font-bold">●</span>}
              <span className="text-[12.5px] text-ink flex-1">{t.roomNumber ? `Room ${t.roomNumber} — ` : ""}{t.title}</span>
              <StatusBadge status={t.priority} size="sm" />
            </div>
          ))}
        </Section>
      )}
      {(briefing.tomorrowArrivals.length > 0 || briefing.tomorrowDepartures.length > 0) && (
        <Section id="schedule" title={`Tomorrow (${briefing.tomorrowArrivals.length} arr · ${briefing.tomorrowDepartures.length} dep)`}>
          {briefing.tomorrowArrivals.map((r) => (
            <div key={r.id} className="py-1.5 flex items-center gap-2 text-[12.5px] text-ink">
              <LogIn size={12} className="text-pine" /> {r.guestName}
              {r.roomTypeName && <span className="text-ink-faint">— {r.roomTypeName}</span>}
            </div>
          ))}
          {briefing.tomorrowDepartures.map((r) => (
            <div key={r.id} className="py-1.5 flex items-center gap-2 text-[12.5px] text-ink">
              <LogOut size={12} className="text-coral" /> {r.guestName}
              {r.roomNumber && <span className="text-ink-faint">— Room {r.roomNumber}</span>}
            </div>
          ))}
        </Section>
      )}
      {briefing.unresolvedNotes.length > 0 && (
        <Section id="notes" title={`Front Desk Notes (${briefing.unresolvedNotes.length})`}>
          {briefing.unresolvedNotes.map((n) => (
            <div key={n.id} className="py-2">
              {n.flagged !== false && <span className="text-coral text-[11px] font-bold mr-1">●</span>}
              <p className="text-[12.5px] text-ink inline">{n.text}</p>
              <p className="text-[11px] text-ink-faint mt-0.5">{n.createdByName} · {fmtDateTime(n.createdAt)}</p>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function ShiftDetailDrawer({ report, onClose, onAcknowledged }: {
  report: ShiftReport;
  onClose: () => void;
  onAcknowledged?: () => void;
}) {
  const qc = useQueryClient();
  const acknowledgeMutation = useMutation({
    mutationFn: () => shiftsService.acknowledge(report.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-discrepancy-count"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onAcknowledged?.();
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-paper shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-coral mb-0.5">Shift Detail</div>
            <h2 className="serif text-[22px] text-ink">
              {fmtDate(report.shiftDate)} · {report.shiftType.charAt(0) + report.shiftType.slice(1).toLowerCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {report.discrepancyAlerted && (
              <button
                type="button"
                onClick={() => acknowledgeMutation.mutate()}
                disabled={acknowledgeMutation.isPending}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-red-100 text-red-700 text-[12.5px] font-semibold hover:bg-red-200 transition-colors disabled:opacity-40"
              >
                <CheckCircle2 size={13} />
                {acknowledgeMutation.isPending ? "Acknowledging…" : "Acknowledge"}
              </button>
            )}
            <button onClick={onClose} className="text-ink-faint hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Staff */}
          <div className="flex flex-wrap gap-4 text-[13px]">
            <div>
              <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider mb-0.5">Submitted by</div>
              <div className="font-semibold text-ink">{report.staffName}</div>
              <div className="text-ink-faint">{fmtDateTime(report.createdAt)}</div>
            </div>
            {report.signedOffByName && (
              <div>
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider mb-0.5">Signed off by</div>
                <div className="font-semibold text-ink">{report.signedOffByName}</div>
                <div className="text-ink-faint">{report.signedOffAt ? fmtDateTime(report.signedOffAt) : "—"}</div>
              </div>
            )}
          </div>

          {/* Cash breakdown */}
          <div>
            <div className="text-[12px] font-bold uppercase text-ink-faint tracking-wider mb-3">Cash Reconciliation</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Opening balance",  formatPKR(report.openingBalance)],
                ["Cash collected",   formatPKR(report.cashCollected)],
                ["Cash expenses",    formatPKR(report.cashExpenses)],
                ["Closing balance",  formatPKR(report.closingBalance)],
                ["Expected balance", formatPKR(report.expectedBalance)],
                ["Actual count",     report.actualCashCount !== null ? formatPKR(report.actualCashCount) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-mist border border-line-soft p-3">
                  <div className="text-[10.5px] font-bold uppercase text-ink-faint tracking-wider">{k}</div>
                  <div className="serif text-[16px] text-ink tnum mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {report.signedOffAt && (
              <div className="mt-2 rounded-xl border border-line-soft p-3" style={{
                background: report.variance === 0 ? `${TONE.pine.bg}` : `${TONE.clay.bg}`,
              }}>
                <div className="text-[10.5px] font-bold uppercase text-ink-faint tracking-wider">Variance</div>
                <div className="serif text-[20px] tnum mt-0.5 font-semibold" style={{
                  color: report.variance === 0 ? TONE.pine.fg : TONE.clay.fg,
                }}>
                  {formatPKR(report.variance)}
                </div>
              </div>
            )}
            {!report.signedOffAt && (
              <p className="mt-2 text-[12px] text-ink-faint italic">Awaiting physical cash count — not yet signed off</p>
            )}
            {report.varianceReason && (
              <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12.5px] text-amber-900">
                <span className="font-semibold">Variance reason: </span>{report.varianceReason}
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <div className="text-[12px] font-bold uppercase text-ink-faint tracking-wider mb-3">Activity</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Check-ins",    report.checkIns],
                ["Check-outs",   report.checkOuts],
                ["New bookings", report.newBookings],
                ["POS orders",   report.posOrders],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-mist border border-line-soft p-3">
                  <div className="text-[10.5px] font-bold uppercase text-ink-faint tracking-wider">{k}</div>
                  <div className="serif text-[18px] text-ink tnum mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {report.notes && (
            <div>
              <div className="text-[12px] font-bold uppercase text-ink-faint tracking-wider mb-2">Notes</div>
              <p className="text-[13px] text-ink whitespace-pre-wrap bg-mist rounded-xl px-3.5 py-3 border border-line-soft">
                {report.notes}
              </p>
            </div>
          )}

          {/* Handover briefing snapshot */}
          {report.handoverBriefing && (
            <div>
              <div className="text-[12px] font-bold uppercase text-ink-faint tracking-wider mb-3">Handover Snapshot</div>
              <BriefingSnapshot briefing={report.handoverBriefing} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmitTab() {
  const qc = useQueryClient();
  const { shiftDate: initialDate, shiftType: initialShiftType } = currentShiftContext();
  const [form, setForm] = useState<SubmitForm>({
    shiftDate: initialDate, shiftType: initialShiftType,
    openingBalance: "", cashCollected: "", cashExpenses: "",
    checkIns: "0", checkOuts: "0", newBookings: "0", posOrders: "0",
    notes: "",
  });
  const [created, setCreated] = useState<ShiftReport | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [signOffNote, setSignOffNote] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [briefing, setBriefing] = useState<HandoverBriefing | null>(null);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [zeroCashAck, setZeroCashAck] = useState(false);

  function set<K extends keyof SubmitForm>(key: K, value: SubmitForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleFlag(id: string, checked: boolean) {
    setFlagged((f) => ({ ...f, [id]: checked }));
  }

  const prefillMutation = useMutation({
    mutationFn: () => Promise.all([
      shiftsService.getPrefill(form.shiftDate, form.shiftType),
      shiftsService.getBriefing(form.shiftDate, form.shiftType),
    ]),
    onSuccess: ([prefill, brief]) => {
      setForm((f) => ({
        ...f,
        cashCollected:  String(Math.floor(prefill.cashCollected / 100)),
        checkIns:       String(prefill.checkIns),
        checkOuts:      String(prefill.checkOuts),
        newBookings:    String(prefill.newBookings),
        posOrders:      String(prefill.posOrders),
        // Only auto-fill opening balance if the staff hasn't typed one yet
        ...(f.openingBalance === "" && prefill.suggestedOpeningBalance > 0
          ? { openingBalance: String(Math.floor(prefill.suggestedOpeningBalance / 100)) }
          : {}),
      }));
      setBriefing(brief);
      // Default: all items flagged
      const initFlags: Record<string, boolean> = {};
      brief.pendingHousekeeping.forEach((t) => { initFlags[t.id] = true; });
      brief.openMaintenance.forEach((t) => { initFlags[t.id] = true; });
      brief.unresolvedNotes.forEach((n) => { initFlags[n.id] = true; });
      setFlagged(initFlags);
    },
  });

  // Auto-load data on mount so briefing and prefill are immediately visible
  useEffect(() => {
    prefillMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildBriefingSnapshot(): HandoverBriefing | undefined {
    if (!briefing) return undefined;
    return {
      ...briefing,
      pendingHousekeeping: briefing.pendingHousekeeping.map((t) => ({ ...t, flagged: flagged[t.id] !== false })),
      openMaintenance:     briefing.openMaintenance.map((t)     => ({ ...t, flagged: flagged[t.id] !== false })),
      unresolvedNotes:     briefing.unresolvedNotes.map((n)     => ({ ...n, flagged: flagged[n.id] !== false })),
    };
  }

  const closingBalance =
    rupeesToPaisas(form.openingBalance) + rupeesToPaisas(form.cashCollected) - rupeesToPaisas(form.cashExpenses);

  const zeroCashWarning =
    rupeesToPaisas(form.cashCollected) === 0 && Number(form.checkIns) > 0;

  const createMutation = useMutation({
    mutationFn: () => shiftsService.create({
      shiftDate:        form.shiftDate,
      shiftType:        form.shiftType,
      openingBalance:   rupeesToPaisas(form.openingBalance),
      cashCollected:    rupeesToPaisas(form.cashCollected),
      cashExpenses:     rupeesToPaisas(form.cashExpenses),
      checkIns:         Number(form.checkIns) || 0,
      checkOuts:        Number(form.checkOuts) || 0,
      newBookings:      Number(form.newBookings) || 0,
      posOrders:        Number(form.posOrders) || 0,
      notes:            form.notes.trim() || undefined,
      handoverBriefing: buildBriefingSnapshot(),
    }),
    onSuccess: (report) => {
      setCreated(report);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["shift-discrepancy-count"] });
    },
  });

  const canSubmit = !created && !createMutation.isPending && (!zeroCashWarning || zeroCashAck);

  const expected = created?.expectedBalance ?? closingBalance;
  const actualPaisas = rupeesToPaisas(actualCash);
  const liveVariance = actualPaisas - expected;
  const isLargeVariance = Math.abs(liveVariance) > DISCREPANCY_THRESHOLD;

  const signOffMutation = useMutation({
    mutationFn: () => shiftsService.signOff(created!.id, {
      actualCashCount: rupeesToPaisas(actualCash),
      notes:           signOffNote.trim() || undefined,
      varianceReason:  varianceReason.trim() || undefined,
    }),
    onSuccess: (report) => {
      setCreated(report);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["shift-discrepancy-count"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Date / shift selector */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Shift date</label>
            <DatePicker
              value={form.shiftDate}
              onChange={(v) => set("shiftDate", v)}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Shift</label>
            <div className="inline-flex items-center gap-1 rounded-full bg-line-soft p-1">
              {SHIFT_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set("shiftType", s.value)}
                  className={cn(
                    "rounded-full px-4 h-9 text-[13px] font-semibold transition-all",
                    form.shiftType === s.value ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => prefillMutation.mutate()}
            disabled={prefillMutation.isPending}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-line-soft transition-colors disabled:opacity-40"
          >
            <Download size={16} />
            {prefillMutation.isPending ? "Loading…" : "Load data"}
          </button>
        </div>
        {prefillMutation.isError && (
          <p className="mt-3 text-[13px] text-red-600">
            Could not load shift data: {(prefillMutation.error as Error)?.message ?? "Server error — please try again."}
          </p>
        )}
      </Card>

      {/* Cash reconciliation */}
      <Card>
        <h3 className="serif text-[18px] text-ink mb-4">Cash reconciliation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Opening balance</label>
            <input type="number" min={0} value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Cash collected</label>
            <input type="number" min={0} value={form.cashCollected} onChange={(e) => { set("cashCollected", e.target.value); setZeroCashAck(false); }} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Cash expenses</label>
            <input type="number" min={0} value={form.cashExpenses} onChange={(e) => set("cashExpenses", e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Closing balance</label>
            <div className="h-11 flex items-center rounded-xl bg-pine/5 border border-line px-3.5 serif text-[18px] text-pine tnum">
              {formatPKR(closingBalance)}
            </div>
          </div>
        </div>
        {zeroCashWarning && (
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-coral"
              checked={zeroCashAck}
              onChange={(e) => setZeroCashAck(e.target.checked)}
            />
            <span className="text-[13px] text-amber-900">
              <span className="font-semibold">Cash collected is PKR 0</span> but {form.checkIns} check-in(s) occurred this shift. Confirm this is correct before submitting.
            </span>
          </label>
        )}
      </Card>

      {/* Activity */}
      <Card>
        <h3 className="serif text-[18px] text-ink mb-4">Activity</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox icon={LogIn}        label="Check-ins"    value={form.checkIns}    onChange={(v) => set("checkIns", v)} />
          <StatBox icon={LogOut}       label="Check-outs"   value={form.checkOuts}   onChange={(v) => set("checkOuts", v)} />
          <StatBox icon={CalendarPlus} label="New bookings" value={form.newBookings} onChange={(v) => set("newBookings", v)} />
          <StatBox icon={ShoppingCart} label="POS orders"   value={form.posOrders}   onChange={(v) => set("posOrders", v)} />
        </div>
      </Card>

      {/* Handover briefing — appears after Load data */}
      {briefing && (
        <BriefingCard briefing={briefing} flagged={flagged} onToggle={toggleFlag} />
      )}

      {/* Notes + Submit */}
      <Card>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Handover notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Anything the next shift should know…"
          className="w-full rounded-xl bg-mist border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none"
        />
        <div className="mt-4 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40"
          >
            <ClipboardList size={17} />
            {created ? "Submitted" : createMutation.isPending ? "Submitting…" : "Submit handover"}
          </button>
          {createMutation.isError && (
            <p className="text-[13px] text-red-600">
              Submission failed: {(createMutation.error as Error)?.message ?? "Server error — please try again."}
            </p>
          )}
        </div>
      </Card>

      {/* Sign-off card */}
      {created && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <PenLine size={18} className="text-ink-soft" />
            <h3 className="serif text-[18px] text-ink">Cash sign-off</h3>
            {created.signedOffAt && <StatusBadge status="Settled" size="sm" />}
          </div>

          {created.signedOffAt ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-mist border border-line-soft p-4 text-center">
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Expected</div>
                <div className="serif text-[20px] text-ink tnum mt-1">{formatPKR(created.expectedBalance)}</div>
              </div>
              <div className="rounded-xl bg-mist border border-line-soft p-4 text-center">
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Actual</div>
                <div className="serif text-[20px] text-ink tnum mt-1">{formatPKR(created.actualCashCount ?? 0)}</div>
              </div>
              <div className="rounded-xl bg-mist border border-line-soft p-4 text-center">
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Variance</div>
                <div className="serif text-[20px] tnum mt-1" style={{ color: created.variance === 0 ? TONE.pine.fg : TONE.clay.fg }}>
                  {formatPKR(created.variance)}
                </div>
              </div>
              {created.varianceReason && (
                <div className="col-span-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12.5px] text-amber-900">
                  <span className="font-semibold">Variance reason: </span>{created.varianceReason}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Actual cash count</label>
                  <input type="number" min={0} value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div className="rounded-xl bg-mist border border-line-soft p-3 text-center">
                  <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Expected</div>
                  <div className="serif text-[18px] text-ink tnum mt-1">{formatPKR(expected)}</div>
                </div>
                <div className="rounded-xl bg-mist border border-line-soft p-3 text-center">
                  <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Variance</div>
                  {actualCash === "" ? (
                    <div className="text-[13px] text-ink-faint mt-1.5 italic">Awaiting physical count</div>
                  ) : (
                    <div className="serif text-[18px] tnum mt-1" style={{ color: liveVariance === 0 ? TONE.pine.fg : TONE.clay.fg }}>
                      {formatPKR(liveVariance)}
                    </div>
                  )}
                </div>
              </div>

              {/* Large discrepancy warning */}
              {actualCash !== "" && isLargeVariance && (
                <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-red-900">
                      ⚠ Cash variance of {formatPKR(Math.abs(liveVariance))} detected
                    </p>
                    <p className="text-[12px] text-red-700 mt-0.5">A reason is required before signing off.</p>
                  </div>
                </div>
              )}

              <textarea
                value={signOffNote}
                onChange={(e) => setSignOffNote(e.target.value)}
                rows={2}
                placeholder="Sign-off note (optional)…"
                className="w-full rounded-xl bg-mist border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none mb-3"
              />

              {/* Variance reason — required for large discrepancies */}
              {actualCash !== "" && isLargeVariance && (
                <textarea
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for variance (required)…"
                  className="w-full rounded-xl bg-red-50 border border-red-300 px-3.5 py-2.5 text-sm text-ink placeholder:text-red-300 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all resize-none mb-3"
                />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => signOffMutation.mutate()}
                  disabled={signOffMutation.isPending || (isLargeVariance && !varianceReason.trim())}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40"
                >
                  <CheckCircle2 size={17} />
                  {signOffMutation.isPending ? "Signing off…" : "Sign off"}
                </button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function ReportsTab() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);
  const [filters, setFilters] = useState<ListShiftsParams>({
    startDate: (() => { const d = weekAgo; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
    endDate:   (() => { const d = today;  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
    page: 1, limit: 20,
  });
  const [selected, setSelected] = useState<ShiftReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", filters],
    queryFn: () => shiftsService.list(filters),
  });

  const { data: detailData } = useQuery({
    queryKey: ["shift-detail", selected?.id],
    queryFn: () => shiftsService.get(selected!.id),
    enabled: !!selected,
  });

  const reports = data?.data ?? [];

  return (
    <>
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">From</label>
              <DatePicker value={filters.startDate ?? ""} onChange={(v) => setFilters((f) => ({ ...f, startDate: v, page: 1 }))} className="w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">To</label>
              <DatePicker value={filters.endDate ?? ""} onChange={(v) => setFilters((f) => ({ ...f, endDate: v, page: 1 }))} className="w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Shift</label>
              <select
                value={filters.shiftType ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, shiftType: (e.target.value || undefined) as ShiftType | undefined, page: 1 }))}
                className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}
              >
                <option value="">All shifts</option>
                {SHIFT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <Card pad={false} className="overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1.2fr_1fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
            <span>Date</span><span>Shift</span><span>Staff</span><span>Cash collected</span><span>Variance</span><span>Status</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-ink-mute text-sm">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList size={32} className="mx-auto text-ink-faint mb-3" />
              <p className="text-[14px] font-semibold text-ink-soft">No shift reports found</p>
            </div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center border-b border-line-soft last:border-0 text-left hover:bg-mist/60 transition-colors"
              >
                <span className="text-[13.5px] font-semibold text-ink tnum">{fmtDate(r.shiftDate)}</span>
                <span className="text-[13px] text-ink-soft capitalize">{r.shiftType.toLowerCase()}</span>
                <span className="text-[13px] text-ink-soft truncate">{r.staffName}</span>
                <span className="text-[13.5px] font-semibold text-ink tnum">{formatPKR(r.cashCollected)}</span>
                <span>
                  {r.signedOffAt ? (
                    <span className="text-[13.5px] font-semibold tnum" style={{ color: r.variance === 0 ? TONE.pine.fg : TONE.clay.fg }}>
                      {formatPKR(r.variance)}
                      {r.discrepancyAlerted && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-faint italic">Pending count</span>
                  )}
                </span>
                <span>
                  <StatusBadge status={r.signedOffAt ? "Settled" : "Pending"} size="sm" />
                </span>
              </button>
            ))
          )}
        </Card>
      </div>

      {selected && (
        <ShiftDetailDrawer
          report={detailData ?? selected}
          onClose={() => setSelected(null)}
          onAcknowledged={() => setSelected(null)}
        />
      )}
    </>
  );
}

export default function ShiftHandoverPage() {
  const [tab, setTab] = useState<"submit" | "reports">("submit");

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Operations</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Shift Handover</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">Submit cash counts and review past shift reports</p>
      </div>

      <div className="flex gap-0 border-b border-line mb-6">
        {([["submit", "Submit Handover"], ["reports", "View Reports"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "px-4 pb-3 text-[14px] font-semibold transition-colors border-b-2 -mb-px",
              tab === key ? "border-coral text-coral" : "border-transparent text-ink-mute hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "submit" ? <SubmitTab /> : <ReportsTab />}
    </div>
  );
}
