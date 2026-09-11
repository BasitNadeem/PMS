import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleDollarSign, FileBarChart, Receipt, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { expensesService } from "@/services/expenses";
import { leaveService } from "@/services/leaves";
import { usersService } from "@/services/users";

const CATEGORY_LABELS: Record<string, string> = {
  SALARY: "Salary",
  UTILITIES: "Utilities",
  SUPPLIES: "Supplies",
  MAINTENANCE: "Maintenance",
  FOOD_BEVERAGE: "Food & Beverage",
  MARKETING: "Marketing",
  RENT: "Rent",
  INSURANCE: "Insurance",
  EQUIPMENT: "Equipment",
  MISCELLANEOUS: "Miscellaneous",
};

function todayInPakistan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function monthStart(value: string): string {
  return `${value.slice(0, 8)}01`;
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPkr(paisa: number): string {
  const rupees = Math.floor(paisa / 100);
  if (rupees >= 100_000) return `PKR ${(rupees / 1000).toFixed(0)}k`;
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

export default function BackOfficeFinancePage() {
  const today = todayInPakistan();
  const startDate = monthStart(today);
  const summaryQuery = useQuery({
    queryKey: ["backoffice", "finance", "summary", startDate],
    queryFn: () => expensesService.getExpenseSummary(startDate, today),
  });
  const expensesQuery = useQuery({
    queryKey: ["backoffice", "finance", "recent", startDate],
    queryFn: () => expensesService.getExpenses({ startDate, endDate: today, limit: 5 }),
  });
  const staffQuery = useQuery({ queryKey: ["backoffice", "staff"], queryFn: usersService.getUsers, staleTime: 60_000 });
  const leaveQuery = useQuery({
    queryKey: ["backoffice", "finance", "leave", startDate],
    queryFn: () => leaveService.getRecords({ startDate, endDate: today, limit: 100 }),
  });

  const summary = summaryQuery.data;
  const activeStaff = (staffQuery.data ?? []).filter((member) => member.isActive && member.role !== "OWNER").length;
  const leaveDays = leaveQuery.data?.data.length ?? 0;
  const topCategory = summary?.byCategory[0];
  const recentExpenses = expensesQuery.data?.data ?? [];

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-coral">Back office · money</div><h1 className="serif text-[36px] leading-none text-ink">Expenses & payroll</h1><p className="mt-2 text-[15px] text-ink-mute">A small-hotel finance view: know what went out, then prepare payroll from approved people records.</p></div><span className="rounded-full border border-line bg-card px-3 py-2 text-[12px] font-semibold text-ink-soft">{monthLabel(startDate)}</span></div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3"><Card className="!p-4"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-coral-soft text-coral"><CircleDollarSign size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Expenses</span></div><div className="mt-5 serif text-[30px] leading-none text-ink">{summary ? formatPkr(summary.totalAmount) : "—"}</div><div className="mt-1 text-[13px] font-semibold text-ink-soft">recorded this month</div></Card><Card className="!p-4"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-soft text-pine"><Receipt size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Register</span></div><div className="mt-5 serif text-[30px] leading-none text-ink">{expensesQuery.data?.meta.total ?? "—"}</div><div className="mt-1 text-[13px] font-semibold text-ink-soft">expense entries</div></Card><Card className="!p-4"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-dusk-soft text-dusk"><WalletCards size={19} /></span><span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Largest category</span></div><div className="mt-5 truncate text-[20px] font-bold leading-none text-ink">{topCategory ? CATEGORY_LABELS[topCategory.category] ?? topCategory.category : "—"}</div><div className="mt-2 text-[13px] font-semibold text-ink-soft">{topCategory ? formatPkr(topCategory.total) : "Loading"}</div></Card></div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><Card pad={false}><div className="flex items-center justify-between border-b border-line-soft px-5 py-4"><div><h2 className="text-[14px] font-bold text-ink">Expense mix</h2><p className="mt-0.5 text-[12px] text-ink-mute">Where this month’s money is going.</p></div><Link to="/finance/expenses" className="inline-flex items-center gap-1 text-[12px] font-bold text-coral hover:text-coral-dark">Open register <ArrowRight size={14} /></Link></div>{summary?.byCategory.length ? <div className="divide-y divide-line-soft">{summary.byCategory.slice(0, 6).map((category) => <div key={category.category} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-8 w-8 place-items-center rounded-xl bg-coral-soft text-coral"><Receipt size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{CATEGORY_LABELS[category.category] ?? category.category}</div><div className="mt-0.5 text-[11px] text-ink-mute">{category.count} {category.count === 1 ? "entry" : "entries"}</div></div><span className="text-[13px] font-bold text-ink">{formatPkr(category.total)}</span></div>)}</div> : <div className="px-5 py-10 text-center text-[13px] text-ink-mute">No expenses recorded for this month.</div>}</Card><Card pad={false}><div className="border-b border-line-soft px-5 py-4"><h2 className="text-[14px] font-bold text-ink">Recent entries</h2><p className="mt-0.5 text-[12px] text-ink-mute">Latest items from the shared expense register.</p></div>{recentExpenses.length ? <div className="divide-y divide-line-soft">{recentExpenses.map((expense) => <div key={expense.id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-8 w-8 place-items-center rounded-xl bg-mist text-ink-mute"><FileBarChart size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{expense.description}</div><div className="mt-0.5 truncate text-[11px] text-ink-mute">{expense.paid_to} · {expense.date}</div></div><span className="text-[12px] font-bold text-ink">{formatPkr(expense.amount)}</span></div>)}</div> : <div className="px-5 py-10 text-center text-[13px] text-ink-mute">No recent expense entries.</div>}</Card></div>

      <Card className="mt-6 !p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-dusk-soft text-dusk"><WalletCards size={21} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[16px] font-bold text-ink">Payroll preparation</h2><span className="rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber">Manager review</span></div><p className="mt-2 max-w-[650px] text-[13px] leading-5 text-ink-mute">Attendance is live and scheduled leave is separate from it. Salary profiles, allowances and deductions still need to be defined before payroll can be calculated safely.</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-mist px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Staff</div><div className="mt-1 text-[17px] font-bold text-ink">{activeStaff}</div></div><div className="rounded-xl bg-mist px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Leave days</div><div className="mt-1 text-[17px] font-bold text-ink">{leaveQuery.data ? leaveDays : "—"}</div></div><div className="col-span-2 rounded-xl bg-pine-soft px-3 py-2.5 sm:col-span-1"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-pine"><CheckCircle2 size={13} /> Inputs</div><div className="mt-1 text-[12px] font-semibold text-pine-deep">Attendance ready</div></div></div></div><div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line-soft pt-4 text-[12px] text-ink-mute"><span>Next: salary profiles → manager-approved export</span><Link to="/leave" className="inline-flex items-center gap-1 font-bold text-coral hover:text-coral-dark">Review leave <ArrowRight size={14} /></Link></div></Card>
    </div>
  );
}
