import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Building2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  companiesService, pkr, COMPANY_TYPE_LABEL, PAYMENT_TERMS_LABEL,
  type CompanySummary, type CompanyType,
} from "@/services/companies";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";

const TYPE_FILTERS = [
  { value: "ALL",         label: "All" },
  { value: "TOUR_AGENCY", label: "Agencies" },
  { value: "CORPORATE",   label: "Corporate" },
  { value: "GOVERNMENT",  label: "Government" },
];

function CompanyRow({ company, onOpen }: { company: CompanySummary; onOpen: (id: string) => void }) {
  const overLimit = company.creditLimit > 0 && company.balance > company.creditLimit;

  return (
    <div
      onClick={() => onOpen(company.id)}
      className="group grid grid-cols-1 md:grid-cols-[2fr_1fr_1.1fr_1.1fr_0.9fr] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors border-b border-line-soft last:border-0"
    >
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-ink truncate flex items-center gap-1.5">
          {company.name}
          {!company.isActive && <StatusBadge status="Inactive" size="sm" dot={false} />}
        </div>
        <div className="text-[12px] text-ink-mute truncate">
          {COMPANY_TYPE_LABEL[company.type]}
          {company.contactPhone && ` · ${company.contactPhone}`}
        </div>
      </div>

      <div className="text-[13px] text-ink-mute">
        {PAYMENT_TERMS_LABEL[company.paymentTerms]}
      </div>

      <div>
        <div className={cn("text-[14px] font-semibold tabular-nums", company.balance > 0 ? "text-ink" : "text-ink-mute")}>
          {pkr(company.balance)}
        </div>
        <div className="text-[11.5px] text-ink-mute">outstanding</div>
      </div>

      <div>
        {company.overdueAmount > 0 ? (
          <div className="flex items-center gap-1.5 text-[14px] font-semibold tabular-nums text-clay">
            <AlertTriangle size={14} />
            {pkr(company.overdueAmount)}
          </div>
        ) : (
          <span className="text-[13px] text-ink-faint">—</span>
        )}
        <div className="text-[11.5px] text-ink-mute">overdue</div>
      </div>

      <div className="text-right">
        {company.creditLimit > 0 ? (
          <>
            <div className={cn("text-[13.5px] font-semibold tabular-nums", overLimit ? "text-clay" : "text-ink-soft")}>
              {pkr(company.availableCredit)}
            </div>
            <div className="text-[11.5px] text-ink-mute">
              of {pkr(company.creditLimit)} left
            </div>
          </>
        ) : (
          <div className="text-[12px] text-ink-faint">No credit</div>
        )}
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { has } = usePermissions();

  const [search, setSearch]   = useState("");
  const [type, setType]       = useState("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [page, setPage]       = useState(1);
  const [showCreate, setShowCreate]   = useState(false);

  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(type !== "ALL" ? { type: type as CompanyType } : {}),
    ...(onlyOverdue ? { overdue: true } : {}),
    page,
    limit: 20,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["companies", params],
    queryFn:  () => companiesService.list(params),
  });

  // Portfolio totals across every company, not just this page — the number a
  // manager actually wants when they open this screen.
  const { data: aging } = useQuery({
    queryKey: ["companies-aging-summary"],
    queryFn:  () => companiesService.aging({ onlyOutstanding: true }),
  });

  const companies = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        eyebrow="Corporate"
        title="Companies"
        subtitle="Tour agencies and corporate clients you bill on credit"
      >
        {has("companies:create") && (
          <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>New Company</Button>
        )}
      </PageHeader>

      {aging && aging.totals.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Not yet due", value: aging.totals.current,  tone: "text-ink" },
            { label: "1–30 days",   value: aging.totals.d1_30,    tone: "text-ink" },
            { label: "31–60 days",  value: aging.totals.d31_60,   tone: "text-clay" },
            { label: "61–90 days",  value: aging.totals.d61_90,   tone: "text-clay" },
            { label: "90+ days",    value: aging.totals.d90_plus, tone: "text-clay" },
          ].map((b) => (
            <Card key={b.label} className="px-4 py-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">{b.label}</div>
              <div className={cn("mt-1 text-[17px] font-semibold tabular-nums", b.tone)}>{pkr(b.value)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, contact, phone or NTN…"
          className="flex-1 min-w-[240px]"
        />
        <Segmented
          options={TYPE_FILTERS}
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
          size="sm"
        />
        <button
          onClick={() => { setOnlyOverdue((v) => !v); setPage(1); }}
          className={cn(
            "h-8 px-3 rounded-lg text-[13px] font-semibold border transition-colors",
            onlyOverdue
              ? "bg-clay text-white border-clay"
              : "bg-card text-ink-soft border-line hover:border-ink-faint",
          )}
        >
          Overdue only
        </button>
      </div>

      <Card pad={false}>
        <div className="hidden md:grid grid-cols-[2fr_1fr_1.1fr_1.1fr_0.9fr] gap-3 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-mute border-b border-line-soft">
          <div>Company</div>
          <div>Terms</div>
          <div>Balance</div>
          <div>Overdue</div>
          <div className="text-right">Credit</div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-[14px] text-ink-mute">Loading…</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search || onlyOverdue || type !== "ALL" ? "No companies match those filters" : "No companies yet"}
            subtitle={
              search || onlyOverdue || type !== "ALL"
                ? "Try clearing the search or filters."
                : "Add the tour agencies and corporate clients you deal with, then bill their guests' folios to their account instead of taking cash at checkout."
            }
            action={
              has("companies:create") && !search && !onlyOverdue && type === "ALL"
                ? <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>New Company</Button>
                : undefined
            }
          />
        ) : (
          companies.map((c) => (
            <CompanyRow key={c.id} company={c} onOpen={(id) => navigate(`/companies/${id}`)} />
          ))
        )}
      </Card>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-[13px] text-ink-mute">
            {meta.total} compan{meta.total === 1 ? "y" : "ies"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" leftIcon={ChevronLeft}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-[13px] text-ink-mute tabular-nums">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline" size="sm" rightIcon={ChevronRight}
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showCreate && (
        <CompanyFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(company) => { setShowCreate(false); refetch(); navigate(`/companies/${company.id}`); }}
        />
      )}
    </>
  );
}
