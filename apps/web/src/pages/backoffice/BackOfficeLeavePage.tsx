import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, FileText, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { getErrorMessage } from "@/lib/api";
import { leaveService, type LeaveRecord } from "@/services/leaves";
import { usersService } from "@/services/users";

function todayInPakistan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00.000Z`));
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function leaveTiming(value: string, today: string): string {
  if (value > today) return "Scheduled";
  if (value === today) return "Today";
  return "Recorded";
}

export default function BackOfficeLeavePage() {
  const queryClient = useQueryClient();
  const today = todayInPakistan();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [form, setForm] = useState({ userId: "", startDate: today, endDate: today, notes: "" });
  const [message, setMessage] = useState("");
  const { startDate, endDate } = monthBounds(month);
  const leaveQuery = useQuery({
    queryKey: ["backoffice", "leaves", startDate, endDate],
    queryFn: () => leaveService.getRecords({ startDate, endDate, limit: 100 }),
  });
  const staffQuery = useQuery({ queryKey: ["backoffice", "staff"], queryFn: usersService.getUsers, staleTime: 60_000 });
  const createMutation = useMutation({
    mutationFn: leaveService.create,
    onSuccess: (records) => {
      setMessage(`${records.length} ${records.length === 1 ? "leave day" : "leave days"} scheduled.`);
      setMonth(form.startDate.slice(0, 7));
      setForm({ userId: "", startDate: form.startDate, endDate: form.startDate, notes: "" });
      void queryClient.invalidateQueries({ queryKey: ["backoffice", "leaves"] });
    },
    onError: (error) => setMessage(getErrorMessage(error, "Could not schedule leave.")),
  });
  const removeMutation = useMutation({
    mutationFn: leaveService.remove,
    onSuccess: () => {
      setMessage("Leave day removed.");
      void queryClient.invalidateQueries({ queryKey: ["backoffice", "leaves"] });
    },
    onError: (error) => setMessage(getErrorMessage(error, "Could not remove leave.")),
  });

  const leaveRecords = leaveQuery.data?.data ?? [];
  const peopleOnLeave = new Set(leaveRecords.map((record) => record.userId)).size;
  const activeStaff = (staffQuery.data ?? []).filter((member) => member.isActive && member.role !== "OWNER");

  function submitLeave(event: React.FormEvent) {
    event.preventDefault();
    if (!form.userId) {
      setMessage("Choose a staff member first.");
      return;
    }
    setMessage("");
    createMutation.mutate({
      userId: form.userId,
      startDate: form.startDate,
      endDate: form.endDate,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    });
  }

  function removeLeave(record: LeaveRecord) {
    if (!window.confirm(`Remove scheduled leave for ${record.user?.name ?? "this staff member"} on ${record.leaveDate}?`)) return;
    setMessage("");
    removeMutation.mutate(record.id);
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-coral">Back office · people</div>
          <h1 className="serif text-[36px] leading-none text-ink">Leave planner</h1>
          <p className="mt-2 text-[15px] text-ink-mute">Schedule future leave for the team and keep it separate from automated attendance.</p>
        </div>
        <DatePicker
          value={`${month}-01`}
          onChange={(value) => setMonth(value.slice(0, 7))}
          displayFormat={{ month: "long", year: "numeric" }}
          className="!h-11 !w-[220px] !rounded-2xl !bg-card !px-4 text-[13px] font-semibold shadow-card"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="!p-4">
          <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-soft text-amber"><CalendarDays size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">{monthLabel(month)}</span></div>
          <div className="mt-5 serif text-[30px] leading-none text-ink">{leaveQuery.isPending ? "—" : leaveRecords.length}</div>
          <div className="mt-1 text-[13px] font-semibold text-ink-soft">scheduled leave days</div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-dusk-soft text-dusk"><Users size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">People</span></div>
          <div className="mt-5 serif text-[30px] leading-none text-ink">{leaveQuery.isPending ? "—" : peopleOnLeave}</div>
          <div className="mt-1 text-[13px] font-semibold text-ink-soft">staff members away</div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-soft text-pine"><ClipboardCheck size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Attendance</span></div>
          <div className="mt-5 text-[20px] font-bold leading-none text-ink">Separate</div>
          <div className="mt-2 text-[13px] font-semibold text-ink-soft">future leave is protected</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="h-fit !p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral"><CalendarDays size={19} /></span><div><div className="text-[14px] font-bold text-ink">Schedule leave</div><div className="mt-1 text-[12px] leading-5 text-ink-mute">Add one day or a date range. You can schedule future leave in advance.</div></div></div>
          <form onSubmit={submitLeave} className="mt-5 space-y-4">
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em] text-ink-faint">Staff member</span><select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} className="h-11 w-full rounded-xl border border-line bg-mist px-3 text-[13px] text-ink outline-none focus:border-coral/40"><option value="">Choose staff…</option>{activeStaff.map((member) => <option key={member.userId} value={member.userId}>{member.user.name} · {member.assignedRole.displayName}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em] text-ink-faint">From</span><DatePicker value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value, endDate: value > form.endDate ? value : form.endDate })} className="!h-11" /></div>
              <div><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em] text-ink-faint">Until</span><DatePicker value={form.endDate} min={form.startDate} onChange={(value) => setForm({ ...form, endDate: value })} className="!h-11" /></div>
            </div>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em] text-ink-faint">Note <span className="normal-case tracking-normal text-ink-faint">(optional)</span></span><textarea value={form.notes} maxLength={500} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="e.g. Annual leave" className="w-full resize-none rounded-xl border border-line bg-mist px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-coral/40" /></label>
            <button type="submit" disabled={createMutation.isPending} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-coral px-4 text-[13px] font-bold text-white shadow-pop hover:bg-coral-dark disabled:opacity-60">{createMutation.isPending ? "Scheduling…" : "Schedule leave"} <ArrowRight size={15} /></button>
          </form>
          {message && <div className="mt-4 rounded-xl bg-mist px-3 py-2.5 text-[12px] font-semibold text-ink-soft">{message}</div>}
        </Card>

        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4"><div><h2 className="text-[14px] font-bold text-ink">Leave schedule</h2><p className="mt-0.5 text-[12px] text-ink-mute">{monthLabel(month)} · one record per staff day.</p></div><span className="rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber">Manager managed</span></div>
          {leaveQuery.isPending ? <div className="px-5 py-12 text-center text-[13px] text-ink-mute">Loading leave schedule…</div> : leaveRecords.length === 0 ? <div className="px-5 py-14 text-center"><CheckCircle2 size={22} className="mx-auto text-pine" /><div className="mt-2 text-[13px] font-semibold text-ink-soft">No leave scheduled for {monthLabel(month)}</div><div className="mt-1 text-[12px] text-ink-mute">Use the form to add future days away.</div></div> : <div className="divide-y divide-line-soft">{leaveRecords.map((record) => <div key={record.id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-soft text-amber"><CalendarDays size={17} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-ink">{record.user?.name ?? "Unknown staff"}</div><div className="mt-0.5 text-[11px] text-ink-mute">{dayLabel(record.leaveDate)} · {record.notes ?? "No note"}</div></div><span className={record.leaveDate > today ? "rounded-full bg-dusk-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-dusk" : "rounded-full bg-amber-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber"}>{leaveTiming(record.leaveDate, today)}</span><button type="button" onClick={() => removeLeave(record)} disabled={removeMutation.isPending} className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-clay-soft hover:text-clay disabled:opacity-50" aria-label={`Remove leave for ${record.user?.name ?? "staff member"} on ${record.leaveDate}`}><Trash2 size={15} /></button></div>)}</div>}
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-pine/15 bg-pine-soft/65 px-5 py-4 sm:flex-row sm:items-center"><FileText size={18} className="shrink-0 text-pine" /><div className="flex-1 text-[13px] leading-5 text-pine-deep"><span className="font-bold">Designed for planning.</span> Scheduled leave stays intact even when the staff member later uses the daily PMS.</div><Link to="/attendance" className="inline-flex items-center gap-1 text-[12px] font-bold text-pine hover:underline">Review attendance <ArrowRight size={14} /></Link></div>
    </div>
  );
}
