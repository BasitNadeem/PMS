import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, BarChart3, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = [2024, 2025, 2026, 2027];

const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export default function ReportsPage() {
  const navigate = useNavigate();
  const today = new Date();

  const [dailyDate, setDailyDate] = useState(today.toISOString().slice(0, 10));
  const [monthVal, setMonthVal] = useState(today.getMonth() + 1);
  const [yearVal, setYearVal] = useState(today.getFullYear());

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Analytics</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Reports</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">Generate and export operational reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily Report */}
        <Card className="anim-fade-up flex flex-col gap-6" hover style={{ animationDelay: "0ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-xl2 bg-coral-soft text-coral-deep shrink-0">
              <CalendarDays size={28} />
            </span>
            <div>
              <h2 className="serif text-[22px] text-ink leading-tight">Daily Operations Report</h2>
              <p className="text-[13.5px] text-ink-mute mt-1 leading-relaxed">
                Occupancy, arrivals, departures, revenue, expenses and operations summary for any single day.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Select Date</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              onClick={() => navigate(`/reports/daily?date=${dailyDate}`)}
              className="w-full h-11 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors"
            >
              Generate Report →
            </button>
          </div>
        </Card>

        {/* Monthly Report */}
        <Card className="anim-fade-up flex flex-col gap-6" hover style={{ animationDelay: "60ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-xl2 bg-slate-soft text-slate shrink-0">
              <BarChart3 size={28} />
            </span>
            <div>
              <h2 className="serif text-[22px] text-ink leading-tight">Monthly Summary Report</h2>
              <p className="text-[13.5px] text-ink-mute mt-1 leading-relaxed">
                Revenue trends, occupancy rates, expenses, payment breakdown and top performers for any month.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Select Month</label>
              <div className="flex gap-2">
                <select
                  value={monthVal}
                  onChange={(e) => setMonthVal(Number(e.target.value))}
                  className={`${inputCls} flex-1 appearance-none pr-9 cursor-pointer`}
                >
                  {MONTHS.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={yearVal}
                  onChange={(e) => setYearVal(Number(e.target.value))}
                  className={`${inputCls} w-28 appearance-none pr-9 cursor-pointer`}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => navigate(`/reports/monthly?year=${yearVal}&month=${monthVal}`)}
              className="w-full h-11 rounded-full bg-ink text-white font-semibold text-sm hover:bg-ink/90 transition-colors"
            >
              Generate Report →
            </button>
          </div>
        </Card>

        {/* Shift Handover */}
        <Card className="anim-fade-up flex flex-col gap-6" hover style={{ animationDelay: "120ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-xl2 bg-pine/10 text-pine shrink-0">
              <ClipboardList size={28} />
            </span>
            <div>
              <h2 className="serif text-[22px] text-ink leading-tight">Shift Handover</h2>
              <p className="text-[13.5px] text-ink-mute mt-1 leading-relaxed">
                Submit cash counts at the end of a shift, sign off variances, and review past handover reports.
              </p>
            </div>
          </div>
          <div className="space-y-3 mt-auto">
            <button
              onClick={() => navigate("/reports/shifts")}
              className="w-full h-11 rounded-full bg-pine text-white font-semibold text-sm hover:bg-pine/90 transition-colors"
            >
              Open Shift Handover →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
