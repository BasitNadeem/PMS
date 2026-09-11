import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, LogIn } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { attendanceService, type AttendanceStatus } from "@/services/attendance";
import { usersService } from "@/services/users";

function todayInPakistan(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()); }
function timeLabel(value: string | null): string { return value ? new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(value)) : "—"; }
function roleLabel(role: string): string { return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()); }

const STATUS_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"];

export default function BackOfficeAttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayInPakistan());
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [message, setMessage] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["backoffice", "attendance", date], queryFn: () => attendanceService.getRecords({ startDate: date, endDate: date, limit: 100 }), refetchInterval: 30_000 });
  const { data: staff = [] } = useQuery({ queryKey: ["backoffice", "staff"], queryFn: usersService.getUsers, staleTime: 60_000 });
  const markMutation = useMutation({ mutationFn: attendanceService.markAttendance, onSuccess: () => { setMessage("Attendance saved."); setStaffId(""); qc.invalidateQueries({ queryKey: ["backoffice", "attendance"] }); }, onError: () => setMessage("Could not save attendance. Check your manager permissions.") });
  const records = data?.data ?? [];

  function markManual() {
    if (!staffId) { setMessage("Choose a staff member first."); return; }
    setMessage("");
    markMutation.mutate({ userId: staffId, attendanceDate: date, status });
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-coral">Back office · workforce</div><h1 className="serif text-[36px] leading-none text-ink">Attendance & shifts</h1><p className="mt-2 text-[15px] text-ink-mute">Automatic entries come from staff sign-ins at app.innflo.co. Managers can correct the day here.</p></div><label className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-semibold text-ink-soft"><CalendarDays size={16} className="text-coral" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="bg-transparent outline-none" /></label></div>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-pine/15 bg-pine-soft/70 px-5 py-4"><LogIn size={18} className="mt-0.5 shrink-0 text-pine" /><div className="text-[13px] leading-5 text-pine-deep"><span className="font-bold">Login-linked attendance.</span> The first successful app login creates the day’s record. Later logins update the latest activity and login count; they do not create duplicate rows.</div></div>

      <Card className="mb-6" pad={false}><div className="flex flex-wrap items-end gap-3 border-b border-line-soft px-5 py-4"><div className="mr-auto"><div className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-faint">Manual correction</div><div className="mt-1 text-[13px] text-ink-mute">For staff who forgot to sign in or do not use accounts.</div></div><select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="h-10 min-w-[190px] rounded-xl border border-line bg-mist px-3 text-[13px] text-ink outline-none focus:border-coral/40"><option value="">Choose staff…</option>{staff.filter((member) => member.isActive).map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)} className="h-10 rounded-xl border border-line bg-mist px-3 text-[13px] text-ink outline-none focus:border-coral/40">{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}</select><button type="button" onClick={markManual} disabled={markMutation.isPending} className="h-10 rounded-full bg-coral px-4 text-[13px] font-bold text-white shadow-pop hover:bg-coral-dark disabled:opacity-60">{markMutation.isPending ? "Saving…" : "Save attendance"}</button></div>{message && <div className="px-5 py-2.5 text-[12px] font-semibold text-coral">{message}</div>}</Card>

      <Card pad={false}><div className="flex items-center justify-between border-b border-line-soft px-5 py-4"><div><h2 className="text-[14px] font-bold text-ink">Attendance sheet</h2><p className="mt-0.5 text-[12px] text-ink-mute">{records.length} records for {date}</p></div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-pine"><CheckCircle2 size={15} /> Live from logins</div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-line-soft text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint"><th className="px-5 py-3">Staff member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">First login</th><th className="px-4 py-3">Last activity</th><th className="px-4 py-3">Logins</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-[13px] text-ink-mute">Loading attendance…</td></tr> : records.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center"><Clock3 size={22} className="mx-auto text-ink-faint" /><div className="mt-2 text-[13px] font-semibold text-ink-soft">No attendance recorded for this date</div><div className="mt-1 text-[12px] text-ink-mute">Staff who sign in to the daily PMS will appear here automatically.</div></td></tr> : records.map((record) => <tr key={record.id} className="border-b border-line-soft last:border-0"><td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-coral-soft text-[11px] font-bold text-coral">{record.user?.name.slice(0, 1).toUpperCase() ?? "?"}</span><div><div className="text-[13px] font-semibold text-ink">{record.user?.name ?? "Unknown staff"}</div><div className="text-[11px] text-ink-mute">{record.user?.email ?? ""}</div></div></div></td><td className="px-4 py-3.5 text-[12px] text-ink-soft">{roleLabel(record.role)}</td><td className="px-4 py-3.5 text-[13px] font-semibold text-ink-soft">{timeLabel(record.firstLoginAt)}</td><td className="px-4 py-3.5 text-[13px] text-ink-soft">{timeLabel(record.lastLoginAt)}</td><td className="px-4 py-3.5 text-[13px] text-ink-soft">{record.loginCount}</td><td className="px-4 py-3.5"><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide", record.source === "APP_LOGIN" ? "bg-pine-soft text-pine" : "bg-amber-soft text-amber")}>{record.source === "APP_LOGIN" ? "App login" : "Manual"}</span></td><td className="px-4 py-3.5"><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide", record.status === "PRESENT" ? "bg-pine-soft text-pine" : record.status === "ABSENT" ? "bg-clay-soft text-clay" : "bg-amber-soft text-amber")}>{roleLabel(record.status)}</span></td></tr>)}</tbody></table></div></Card>
    </div>
  );
}
