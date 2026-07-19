import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Search, Star, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportGuestDirectoryToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";
const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A→Z)" },
  { value: "totalStays", label: "Most Stays" },
  { value: "totalSpend", label: "Highest Spend" },
  { value: "createdAt", label: "Newest Guest" },
];

const LIMIT = 25;

export default function GuestDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const sort = searchParams.get("sort") ?? "name";

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [committedSearch, setCommittedSearch] = useState(searchParams.get("search") ?? "");

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-guest-directory", committedSearch, page, sort],
    queryFn: () => reportsService.getGuestDirectory({ search: committedSearch || undefined, page, limit: LIMIT, sort }),
  });

  const [isExporting, setIsExporting] = useState(false);

  function applySearch() {
    setCommittedSearch(search);
    setSearchParams({ search, page: "1", sort });
  }

  function applySort(s: string) {
    setSearchParams({ search: committedSearch, page: "1", sort: s });
  }

  function applyPage(p: number) {
    setSearchParams({ search: committedSearch, page: String(p), sort });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const all = await reportsService.getGuestDirectory({
        search: committedSearch || undefined,
        page: 1,
        limit: 1000,
        sort,
      });
      exportGuestDirectoryToExcel(all, committedSearch || undefined);
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages = report ? Math.ceil(report.total / LIMIT) : 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Guest Directory</h1>

        <div className="ml-auto">
          <button
            onClick={handleExport}
            disabled={isExporting || !report}
            className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet size={14} /> {isExporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className={`${inputCls} pl-9 w-full`}
          />
        </div>
        <button
          onClick={applySearch}
          className="h-10 px-4 rounded-xl bg-coral text-white text-[13px] font-semibold hover:bg-coral-deep transition-colors"
        >
          Search
        </button>
        <select
          value={sort}
          onChange={(e) => applySort(e.target.value)}
          className={inputCls}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-4">
          <Card pad={false}>
            <div className="p-5 pb-3 flex items-center justify-between">
              <h2 className="serif text-[18px] text-ink leading-tight">
                {report.total.toLocaleString("en-PK")} Guest{report.total !== 1 ? "s" : ""}
              </h2>
              {report.total > LIMIT && (
                <span className="text-[12px] text-ink-faint">
                  Page {page} of {totalPages}
                </span>
              )}
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Phone</th>
                    <th className={thCls}>Nationality</th>
                    <th className={thRightCls}>Stays</th>
                    <th className={thRightCls}>Total Spend</th>
                    <th className={thCls}>VIP</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.guests.length === 0 ? (
                    <tr>
                      <td className={tdCls} colSpan={7}>No guests found{committedSearch ? ` matching "${committedSearch}"` : ""}.</td>
                    </tr>
                  ) : report.guests.map((g) => (
                    <tr key={g.id} className={g.isBlacklisted ? "bg-red-50/60" : undefined}>
                      <td className={tdCls}>
                        <div className="font-semibold">{g.fullName}</div>
                        {g.documentNumber && (
                          <div className="text-[11.5px] text-ink-faint font-mono">{g.documentNumber}</div>
                        )}
                      </td>
                      <td className={tdCls}>{g.phone ?? "—"}</td>
                      <td className={tdCls}>{g.nationality ?? "—"}</td>
                      <td className={tdRightCls}>{g.totalStays}</td>
                      <td className={tdRightCls}>{formatPKR(g.totalSpend)}</td>
                      <td className={tdCls}>
                        {g.vipLevel > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                            <Star size={9} /> VIP {g.vipLevel}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={tdCls}>
                        {g.isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <ShieldAlert size={9} /> Blacklisted
                          </span>
                        ) : (
                          <span className="text-[12px] font-semibold" style={{ color: TONE.pine.fg }}>Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 pb-5 flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => applyPage(page - 1)}
                  className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-line text-ink-soft hover:bg-mist disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-[12px] text-ink-faint flex-1 text-center">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => applyPage(page + 1)}
                  className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-line text-ink-soft hover:bg-mist disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
