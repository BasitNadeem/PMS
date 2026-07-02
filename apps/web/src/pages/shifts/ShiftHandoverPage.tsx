import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, LogIn, LogOut, CalendarPlus, ShoppingCart, Download, CheckCircle2, PenLine,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { StatusBadge, TONE } from "@/components/ui/StatusBadge";
import {
  shiftsService,
  type ShiftType,
  type ShiftReport,
  type ListShiftsParams,
} from "@/services/shifts";

function formatPKR(paisas: number): string {
  return "PKR " + Math.floor(paisas / 100).toLocaleString("en-PK");
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "EVENING", label: "Evening" },
  { value: "NIGHT",   label: "Night" },
];

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

function SubmitTab() {
  const qc = useQueryClient();
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [form, setForm] = useState<SubmitForm>({
    shiftDate: today, shiftType: "MORNING",
    openingBalance: "", cashCollected: "", cashExpenses: "",
    checkIns: "0", checkOuts: "0", newBookings: "0", posOrders: "0",
    notes: "",
  });
  const [created, setCreated] = useState<ShiftReport | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [signOffNote, setSignOffNote] = useState("");

  function set<K extends keyof SubmitForm>(key: K, value: SubmitForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const prefillMutation = useMutation({
    mutationFn: () => shiftsService.getPrefill(form.shiftDate, form.shiftType),
    onSuccess: (d) => {
      setForm((f) => ({
        ...f,
        cashCollected: String(Math.floor(d.cashCollected / 100)),
        checkIns:      String(d.checkIns),
        checkOuts:     String(d.checkOuts),
        newBookings:   String(d.newBookings),
        posOrders:     String(d.posOrders),
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: () => shiftsService.create({
      shiftDate:      form.shiftDate,
      shiftType:      form.shiftType,
      openingBalance: rupeesToPaisas(form.openingBalance),
      cashCollected:  rupeesToPaisas(form.cashCollected),
      cashExpenses:   rupeesToPaisas(form.cashExpenses),
      checkIns:       Number(form.checkIns) || 0,
      checkOuts:      Number(form.checkOuts) || 0,
      newBookings:    Number(form.newBookings) || 0,
      posOrders:      Number(form.posOrders) || 0,
      notes:          form.notes.trim() || undefined,
    }),
    onSuccess: (report) => {
      setCreated(report);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: () => shiftsService.signOff(created!.id, {
      actualCashCount: rupeesToPaisas(actualCash),
      notes:           signOffNote.trim() || undefined,
    }),
    onSuccess: (report) => {
      setCreated(report);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const closingBalance =
    rupeesToPaisas(form.openingBalance) + rupeesToPaisas(form.cashCollected) - rupeesToPaisas(form.cashExpenses);

  const expected = created?.expectedBalance ?? closingBalance;
  const actualPaisas = rupeesToPaisas(actualCash);
  const liveVariance = actualPaisas - expected;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Shift date</label>
            <input
              type="date"
              value={form.shiftDate}
              onChange={(e) => set("shiftDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Shift</label>
            <div className="inline-flex items-center gap-1 rounded-full bg-line-soft p-1">
              {SHIFT_TYPES.map((s) => (
                <button
                  key={s.value}
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
            onClick={() => prefillMutation.mutate()}
            disabled={prefillMutation.isPending}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-line-soft transition-colors disabled:opacity-40"
          >
            <Download size={16} />
            {prefillMutation.isPending ? "Loading…" : "Load data"}
          </button>
        </div>
      </Card>

      {/* Cash section */}
      <Card>
        <h3 className="serif text-[18px] text-ink mb-4">Cash reconciliation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Opening balance</label>
            <input type="number" min={0} value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Cash collected</label>
            <input type="number" min={0} value={form.cashCollected} onChange={(e) => set("cashCollected", e.target.value)} placeholder="0" className={inputCls} />
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

      {/* Notes */}
      <Card>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Handover notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Anything the next shift should know…"
          className="w-full rounded-xl bg-mist border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !!created}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40"
          >
            <ClipboardList size={17} />
            {created ? "Submitted" : createMutation.isPending ? "Submitting…" : "Submit handover"}
          </button>
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
                  <div className="serif text-[18px] tnum mt-1" style={{ color: liveVariance === 0 ? TONE.pine.fg : TONE.clay.fg }}>
                    {formatPKR(liveVariance)}
                  </div>
                </div>
              </div>
              <textarea
                value={signOffNote}
                onChange={(e) => setSignOffNote(e.target.value)}
                rows={2}
                placeholder="Sign-off note (optional)…"
                className="w-full rounded-xl bg-mist border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none mb-4"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => signOffMutation.mutate()}
                  disabled={signOffMutation.isPending}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors shadow-pop disabled:opacity-40"
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
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", filters],
    queryFn: () => shiftsService.list(filters),
  });

  const reports = data?.data ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">From</label>
            <input type="date" value={filters.startDate ?? ""} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value, page: 1 }))} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">To</label>
            <input type="date" value={filters.endDate ?? ""} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value, page: 1 }))} className={inputCls} />
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
            <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center border-b border-line-soft last:border-0">
              <span className="text-[13.5px] font-semibold text-ink tnum">{fmtDate(r.shiftDate)}</span>
              <span className="text-[13px] text-ink-soft capitalize">{r.shiftType.toLowerCase()}</span>
              <span className="text-[13px] text-ink-soft truncate">{r.staffName}</span>
              <span className="text-[13.5px] font-semibold text-ink tnum">{formatPKR(r.cashCollected)}</span>
              <span className="text-[13.5px] font-semibold tnum" style={{ color: r.variance === 0 ? TONE.pine.fg : TONE.clay.fg }}>
                {formatPKR(r.variance)}
              </span>
              <span>
                <StatusBadge status={r.signedOffAt ? "Settled" : "Pending"} size="sm" />
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
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
