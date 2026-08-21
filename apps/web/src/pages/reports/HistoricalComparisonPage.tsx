import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BedDouble, Building2, CalendarCheck, DollarSign, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { reportsService, type HistoricalComparisonSummary } from "@/services/reports";

type Baseline = "previousPeriod" | "samePeriodLastYear";

function localIso(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
}

function money(value: number): string {
  return `PKR ${Math.round(value / 100).toLocaleString("en-PK")}`;
}

function labelDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const metrics: Array<{
  key: keyof HistoricalComparisonSummary;
  label: string;
  format: (value: number) => string;
  icon: typeof DollarSign;
}> = [
  { key: "occupancyRate", label: "Occupancy", format: (value) => `${value}%`, icon: BedDouble },
  { key: "adr", label: "ADR", format: money, icon: DollarSign },
  { key: "revpar", label: "RevPAR", format: money, icon: DollarSign },
  { key: "roomRevenue", label: "Room revenue", format: money, icon: DollarSign },
  { key: "reservations", label: "Reservations", format: (value) => value.toLocaleString("en-PK"), icon: CalendarCheck },
  { key: "roomNights", label: "Room nights", format: (value) => value.toLocaleString("en-PK"), icon: BedDouble },
  { key: "cancellations", label: "Cancellations", format: (value) => value.toLocaleString("en-PK"), icon: CalendarCheck },
  { key: "companyRevenue", label: "Company revenue", format: money, icon: Building2 },
  { key: "groupRevenue", label: "Group revenue", format: money, icon: Users },
];

export default function HistoricalComparisonPage() {
  const [params, setParams] = useSearchParams();
  const [baseline, setBaseline] = useState<Baseline>("previousPeriod");
  const startDate = params.get("startDate") ?? firstOfMonth();
  const endDate = params.get("endDate") ?? localIso();
  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["historical-comparison", startDate, endDate],
    queryFn: () => reportsService.getHistoricalComparison(startDate, endDate),
  });

  const comparison = report?.[baseline];
  const chartData = report?.current.days.map((day, index) => ({
    day: index + 1,
    currentOccupancy: day.occupancyRate,
    comparisonOccupancy: comparison?.days[index]?.occupancyRate ?? null,
    currentRevenue: Math.round(day.roomRevenue / 100),
    comparisonRevenue: comparison ? Math.round((comparison.days[index]?.roomRevenue ?? 0) / 100) : null,
  })) ?? [];

  function updateDates(nextStart: string, nextEnd: string) {
    setParams({ startDate: nextStart, endDate: nextEnd });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Back to Reports</Link>
          <h1 className="serif text-[30px] leading-tight text-ink">Historical comparison</h1>
          <p className="mt-1 text-[13px] text-ink-mute">Compare hotel performance using the same centralized occupancy, ADR and RevPAR calculations.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DatePicker value={startDate} onChange={(value) => updateDates(value, endDate)} className="h-10" />
          <span className="text-[12px] text-ink-faint">to</span>
          <DatePicker value={endDate} onChange={(value) => updateDates(startDate, value)} className="h-10" />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-line bg-card p-1 shadow-soft">
          <button type="button" onClick={() => setBaseline("previousPeriod")} className={cn("h-9 rounded-full px-5 text-[12.5px] font-semibold", baseline === "previousPeriod" ? "bg-coral-soft font-bold text-coral-deep" : "text-ink hover:text-coral-deep")}>Previous period</button>
          <button type="button" onClick={() => setBaseline("samePeriodLastYear")} className={cn("h-9 rounded-full px-5 text-[12.5px] font-semibold", baseline === "samePeriodLastYear" ? "bg-coral-soft font-bold text-coral-deep" : "text-ink hover:text-coral-deep")}>Same period last year</button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-line-soft" />)}</div>
      ) : isError || !report || !comparison ? (
        <Card><p className="text-[13px] text-clay">The comparison could not be loaded.</p></Card>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-card px-5 py-3 text-[12px] text-ink-mute shadow-card">
            <span className="font-bold text-ink">Current:</span> {labelDate(report.current.startDate)}–{labelDate(report.current.endDate)}
            <span className="mx-3 text-line">|</span>
            <span className="font-bold text-ink">Compared with:</span> {labelDate(comparison.startDate)}–{labelDate(comparison.endDate)}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const variance = comparison.variance[metric.key];
              const improved = variance.absolute >= 0;
              return (
                <Card key={metric.key} className="!p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-coral-soft text-coral-deep"><Icon size={17} /></span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", improved ? "bg-pine-soft text-pine" : "bg-clay-soft text-clay")}>{improved ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{variance.percentage === null ? "No baseline" : `${Math.abs(variance.percentage)}%`}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{metric.label}</p>
                  <p className="mt-1 serif text-[27px] leading-none text-ink tnum">{metric.format(report.current.summary[metric.key])}</p>
                  <p className="mt-2 text-[11.5px] text-ink-mute">Previously {metric.format(comparison.summary[metric.key])}</p>
                </Card>
              );
            })}
          </div>

          <Card pad={false}>
            <div className="border-b border-line-soft p-5">
              <h2 className="serif text-[19px] text-ink">Daily pace across the selected periods</h2>
              <p className="mt-1 text-[12px] text-ink-mute">Dates are aligned by day number within each period.</p>
            </div>
            <div className="h-[320px] p-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9b8f89" }} />
                  <YAxis yAxisId="occupancy" tick={{ fontSize: 11, fill: "#9b8f89" }} width={42} unit="%" />
                  <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11, fill: "#9b8f89" }} width={60} />
                  <Tooltip formatter={(value, name) => String(name).includes("Revenue") ? [`PKR ${Number(value).toLocaleString("en-PK")}`, name] : [`${value}%`, name]} />
                  <Legend />
                  <Line yAxisId="occupancy" type="monotone" dataKey="currentOccupancy" name="Current occupancy" stroke="#e9522b" strokeWidth={2.5} dot={false} />
                  <Line yAxisId="occupancy" type="monotone" dataKey="comparisonOccupancy" name="Comparison occupancy" stroke="#718096" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line yAxisId="revenue" type="monotone" dataKey="currentRevenue" name="Current revenue" stroke="#2f7256" strokeWidth={2} dot={false} />
                  <Line yAxisId="revenue" type="monotone" dataKey="comparisonRevenue" name="Comparison revenue" stroke="#b7791a" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
