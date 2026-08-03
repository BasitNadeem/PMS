import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Pencil, Banknote, ShieldCheck, Scale,
  FileText, AlertTriangle, Phone, Mail, MapPin, Receipt,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  companiesService, pkr, COMPANY_TYPE_LABEL, PAYMENT_TERMS_LABEL,
  type LedgerEntry,
} from "@/services/companies";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { RecordPaymentModal } from "@/components/companies/RecordPaymentModal";
import { CreditLimitModal } from "@/components/companies/CreditLimitModal";
import { AdjustLedgerModal } from "@/components/companies/AdjustLedgerModal";
import { CreateInvoiceModal } from "@/components/companies/CreateInvoiceModal";
import { InvoiceDetailModal } from "@/components/companies/InvoiceDetailModal";
import { RefundCompanyCreditModal } from "@/components/companies/RefundCompanyCreditModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

const ENTRY_LABEL: Record<string, string> = {
  CHARGE: "Charge", PAYMENT: "Payment", ADJUSTMENT: "Adjustment", WRITE_OFF: "Written off",
  CREDIT_REFUND: "Credit refund",
};

function LedgerRow({ entry, onReverse }: { entry: LedgerEntry; onReverse?: (entry: LedgerEntry) => void }) {
  const isCredit = entry.type === "PAYMENT" || entry.type === "WRITE_OFF";
  const overdue = entry.type === "CHARGE" && entry.outstanding > 0
    && entry.dueDate !== null && new Date(entry.dueDate) < new Date();

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_0.9fr_0.9fr_0.9fr] gap-3 px-5 py-3.5 items-center border-b border-line-soft last:border-0">
      <div className="min-w-0">
        <div className={cn("text-[13.5px] font-medium truncate", entry.reversedAt ? "text-ink-faint line-through" : "text-ink")}>{entry.description}</div>
        <div className="text-[12px] text-ink-mute truncate">
          {ENTRY_LABEL[entry.type]}
          {entry.roomNumber && ` · Room ${entry.roomNumber}`}
          {entry.reference && ` · ${entry.reference}`}
          {entry.reversedAt && " · Reversed"}
        </div>
      </div>

      <div className="text-[13px] text-ink-mute">
        {fmtDate(entry.entryDate)}
      </div>

      <div className={cn("text-[13px]", overdue ? "font-semibold text-clay" : "text-ink-mute")}>
        {entry.type === "CHARGE" ? (
          <span className="inline-flex items-center gap-1">
            {overdue && <AlertTriangle size={12} />}
            {fmtDate(entry.dueDate)}
          </span>
        ) : "—"}
      </div>

      <div className={cn("text-[14px] font-semibold tabular-nums", isCredit ? "text-sage-deep" : "text-ink")}>
        {isCredit ? "−" : "+"}{pkr(entry.amount)}
      </div>

      <div className="text-right">
        {entry.type === "CHARGE" ? (
          entry.outstanding > 0 ? (
            <span className="text-[13.5px] font-semibold text-ink tabular-nums">{pkr(entry.outstanding)}</span>
          ) : (
            <StatusBadge status="Settled" size="sm" dot={false} />
          )
        ) : entry.type === "PAYMENT" && !entry.reversedAt && onReverse ? (
          <button onClick={() => onReverse(entry)} className="text-[12px] font-semibold text-clay hover:underline">Reverse</button>
        ) : (
          <span className="text-[13px] text-ink-faint">—</span>
        )}
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const qc = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const [tab, setTab] = useState("ledger");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "open" | "settled">("all");
  const [modal, setModal] = useState<null | "edit" | "payment" | "credit" | "adjust" | "invoice" | "refundCredit">(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn:  () => companiesService.get(id!),
    enabled:  Boolean(id),
  });

  const { data: ledger } = useQuery({
    queryKey: ["company-ledger", id, ledgerFilter],
    queryFn:  () => companiesService.ledger(id!, { status: ledgerFilter, limit: 100 }),
    enabled:  Boolean(id) && tab === "ledger",
  });

  const { data: reservations } = useQuery({
    queryKey: ["company-reservations", id],
    queryFn:  () => companiesService.reservations(id!),
    enabled:  Boolean(id) && tab === "stays",
  });

  const { data: invoices } = useQuery({
    queryKey: ["company-invoices", id],
    queryFn:  () => companiesService.invoices(id!),
    enabled:  Boolean(id) && tab === "invoices",
  });
  const reversePayment = useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      const reason = window.prompt("Why is this payment being reversed?")?.trim();
      if (!reason) throw new Error("A reason is required to reverse a payment.");
      return companiesService.reversePayment(id!, entry.id, reason);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company", id] }),
        qc.invalidateQueries({ queryKey: ["company-ledger", id] }),
        qc.invalidateQueries({ queryKey: ["company-invoices", id] }),
        qc.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      addToast("Company payment reversed.", "success");
    },
    onError: (error) => addToast(
      (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? error.message,
      "error",
    ),
  });

  if (isLoading) {
    return <div className="px-1 py-10 text-center text-[14px] text-ink-mute">Loading…</div>;
  }
  if (!company) {
    return (
      <EmptyState
        icon={Building2}
        title="Company not found"
        subtitle="It may have been deleted."
        action={<Button variant="outline" onClick={() => navigate("/companies")}>Back to companies</Button>}
      />
    );
  }

  const overLimit = company.creditLimit > 0 && company.balance > company.creditLimit;
  const noCredit  = company.creditLimit === 0;

  return (
    <>
      <button
        onClick={() => navigate("/companies")}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Companies
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">
            {COMPANY_TYPE_LABEL[company.type]}
          </div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink flex items-center gap-2.5 flex-wrap">
            {company.name}
            {!company.isActive && <StatusBadge status="Inactive" size="sm" dot={false} />}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-mute">
            {company.contactName && <span>{company.contactName}</span>}
            {company.contactPhone && (
              <span className="inline-flex items-center gap-1.5"><Phone size={13} />{company.contactPhone}</span>
            )}
            {company.contactEmail && (
              <span className="inline-flex items-center gap-1.5"><Mail size={13} />{company.contactEmail}</span>
            )}
            {company.city && (
              <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{company.city}</span>
            )}
            {company.ntn && <span>NTN {company.ntn}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {has("companies:update") && (
            <Button variant="outline" leftIcon={Pencil} onClick={() => setModal("edit")}>Edit</Button>
          )}
          {has("companies:creditLimit") && (
            <Button variant="outline" leftIcon={ShieldCheck} onClick={() => setModal("credit")}>Credit limit</Button>
          )}
          {has("companies:update") && (
            <Button variant="outline" leftIcon={Scale} onClick={() => setModal("adjust")}>Adjust</Button>
          )}
          {has("companies:payment") && (
            company.unappliedCredit > 0
              ? <Button leftIcon={Banknote} onClick={() => setModal("refundCredit")}>Refund credit</Button>
              : <Button leftIcon={Banknote} onClick={() => setModal("payment")}>Record payment</Button>
          )}
        </div>
      </div>

      {/* Money summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="px-4 py-3.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">
            {company.unappliedCredit > 0 ? "In credit" : "Owes us"}
          </div>
          <div className={cn(
            "mt-1 text-[22px] font-semibold tabular-nums",
            company.unappliedCredit > 0 ? "text-sage-deep" : "text-ink",
          )}>
            {company.unappliedCredit > 0 ? pkr(company.unappliedCredit) : pkr(company.balance)}
          </div>
          {company.unappliedCredit > 0 && (
            <div className="text-[11.5px] text-ink-mute mt-0.5">paid in advance</div>
          )}
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">Overdue</div>
          <div className={cn("mt-1 text-[22px] font-semibold tabular-nums", company.aging.overdue > 0 ? "text-clay" : "text-ink-faint")}>
            {pkr(company.aging.overdue)}
          </div>
          {company.aging.oldestOverdueDays !== null && (
            <div className="text-[11.5px] text-ink-mute mt-0.5">
              oldest {company.aging.oldestOverdueDays} days past due
            </div>
          )}
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">Credit left</div>
          <div className={cn("mt-1 text-[22px] font-semibold tabular-nums", overLimit ? "text-clay" : "text-ink")}>
            {noCredit ? "—" : pkr(company.availableCredit)}
          </div>
          <div className="text-[11.5px] text-ink-mute mt-0.5">
            {noCredit ? "No credit extended" : `of ${pkr(company.creditLimit)}`}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">Terms</div>
          <div className="mt-1 text-[22px] font-semibold text-ink">{PAYMENT_TERMS_LABEL[company.paymentTerms]}</div>
          <div className="text-[11.5px] text-ink-mute mt-0.5">{company.stats.totalReservations} stays booked</div>
        </Card>
      </div>

      {noCredit && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-soft border border-amber/30 px-4 py-3 mb-5">
          <AlertTriangle size={15} className="text-amber shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-soft">
            No credit limit is set, so this company's guests must settle their bills at checkout.
            {has("companies:creditLimit") && " Set a limit to start billing their stays to this account."}
          </p>
        </div>
      )}

      {overLimit && (
        <div className="flex items-start gap-2.5 rounded-xl bg-clay/10 border border-clay/30 px-4 py-3 mb-5">
          <AlertTriangle size={15} className="text-clay shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-soft">
            This company is over its credit limit by {pkr(company.balance - company.creditLimit)}.
            New charges will be refused until they pay some of it down.
          </p>
        </div>
      )}

      {/* Aging breakdown */}
      {company.aging.total > 0 && (
        <Card className="px-5 py-4 mb-5">
          <div className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-3">Age of what they owe</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Not yet due", value: company.aging.current },
              { label: "1–30 days",   value: company.aging.d1_30 },
              { label: "31–60 days",  value: company.aging.d31_60 },
              { label: "61–90 days",  value: company.aging.d61_90 },
              { label: "90+ days",    value: company.aging.d90_plus },
            ].map((b, i) => (
              <div key={b.label}>
                <div className="text-[11.5px] text-ink-mute">{b.label}</div>
                <div className={cn("text-[16px] font-semibold tabular-nums mt-0.5", i >= 2 && b.value > 0 ? "text-clay" : "text-ink")}>
                  {pkr(b.value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented
          options={[
            { value: "ledger",   label: "Account" },
            { value: "stays",    label: "Stays" },
            { value: "invoices", label: "Invoices" },
          ]}
          value={tab}
          onChange={setTab}
          size="sm"
        />
        {tab === "ledger" && (
          <Segmented
            options={[
              { value: "all",     label: "All" },
              { value: "open",    label: "Unpaid" },
              { value: "settled", label: "Settled" },
            ]}
            value={ledgerFilter}
            onChange={(v) => setLedgerFilter(v as "all" | "open" | "settled")}
            size="sm"
          />
        )}
        {tab === "invoices" && has("companies:invoice") && (
          <Button size="sm" leftIcon={FileText} onClick={() => setModal("invoice")}>New invoice</Button>
        )}
      </div>

      {tab === "ledger" && (
        <Card pad={false}>
          <div className="hidden md:grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr_0.9fr] gap-3 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-mute border-b border-line-soft">
            <div>Description</div>
            <div>Date</div>
            <div>Due</div>
            <div>Amount</div>
            <div className="text-right">Still owed</div>
          </div>
          {(ledger?.data ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing on this account yet"
              subtitle="Charges appear here when a guest's folio is billed to this company at checkout."
            />
          ) : (
            ledger!.data.map((e) => (
              <LedgerRow
                key={e.id}
                entry={e}
                onReverse={has("companies:payment") ? (entry) => reversePayment.mutate(entry) : undefined}
              />
            ))
          )}
        </Card>
      )}

      {tab === "stays" && (
        <Card pad={false}>
          {(reservations ?? []).length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No stays booked under this company"
              subtitle="Pick this company on a reservation or group booking to link the stay here."
            />
          ) : (
            reservations!.map((r) => (
              <Link
                key={r.id}
                to={`/reservations/${r.id}`}
                className="grid grid-cols-1 md:grid-cols-[1.5fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-3 px-5 py-3.5 items-center hover:bg-mist transition-colors border-b border-line-soft last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink truncate">{r.guest.fullName}</div>
                  <div className="text-[12px] text-ink-mute">
                    {r.confirmationNumber}
                    {r.rooms[0] && ` · Room ${r.rooms[0].room.number}`}
                  </div>
                </div>
                <div className="text-[13px] text-ink-mute">
                  {fmtDate(r.checkInDate)} – {fmtDate(r.checkOutDate)}
                </div>
                <div><StatusBadge status={r.status} size="sm" /></div>
                <div className="text-[13.5px] font-semibold text-ink tabular-nums">{pkr(r.totalAmount)}</div>
                <div className="text-right">
                  {r.billToCompany
                    ? <StatusBadge status="On credit" size="sm" dot={false} />
                    : <span className="text-[12px] text-ink-faint">Guest pays</span>}
                </div>
              </Link>
            ))
          )}
        </Card>
      )}

      {tab === "invoices" && (
        <Card pad={false}>
          {(invoices ?? []).length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              subtitle="Create a consolidated invoice covering a month's stays, then send it to the company."
              action={
                has("companies:invoice")
                  ? <Button leftIcon={FileText} onClick={() => setModal("invoice")}>New invoice</Button>
                  : undefined
              }
            />
          ) : (
            invoices!.map((inv) => (
              <div
                key={inv.id}
                role="button"
                tabIndex={0}
                onClick={() => setInvoiceId(inv.id)}
                onKeyDown={(event) => event.key === "Enter" && setInvoiceId(inv.id)}
                className="grid cursor-pointer grid-cols-1 gap-3 border-b border-line-soft px-5 py-3.5 items-center last:border-0 hover:bg-mist md:grid-cols-[1.3fr_1.3fr_0.8fr_0.9fr_0.9fr]"
              >
                <div className="text-[13.5px] font-semibold text-ink">{inv.invoiceNumber}</div>
                <div className="text-[13px] text-ink-mute">
                  {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                </div>
                <div><StatusBadge status={inv.status.replace("_", " ")} size="sm" /></div>
                <div className="text-[13.5px] font-semibold text-ink tabular-nums">{pkr(inv.totalAmount)}</div>
                <div className="text-[12.5px] text-ink-mute text-right">
                  {inv._count?.lines ?? 0} stay{(inv._count?.lines ?? 0) === 1 ? "" : "s"}
                  {inv.dueDate && ` · due ${fmtDate(inv.dueDate)}`}
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {modal === "edit" && (
        <CompanyFormModal
          company={company}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); addToast("Company updated.", "success"); }}
        />
      )}
      {modal === "payment" && (
        <RecordPaymentModal
          companyId={company.id}
          companyName={company.name}
          outstanding={company.balance}
          onClose={() => setModal(null)}
          onSuccess={(m) => addToast(m, "success")}
        />
      )}
      {modal === "credit" && (
        <CreditLimitModal
          companyId={company.id}
          companyName={company.name}
          currentLimit={company.creditLimit}
          currentBalance={company.balance}
          onClose={() => setModal(null)}
          onSuccess={(m) => addToast(m, "success")}
        />
      )}
      {modal === "adjust" && (
        <AdjustLedgerModal
          companyId={company.id}
          companyName={company.name}
          outstanding={company.balance}
          canWriteOff={has("companies:writeOff")}
          onClose={() => setModal(null)}
          onSuccess={(m) => addToast(m, "success")}
        />
      )}
      {modal === "invoice" && (
        <CreateInvoiceModal
          companyId={company.id}
          companyName={company.name}
          onClose={() => setModal(null)}
          onSuccess={(m) => addToast(m, "success")}
        />
      )}
      {modal === "refundCredit" && (
        <RefundCompanyCreditModal
          companyId={company.id}
          companyName={company.name}
          available={company.unappliedCredit}
          onClose={() => setModal(null)}
          onSuccess={(message) => addToast(message, "success")}
        />
      )}
      {invoiceId && (
        <InvoiceDetailModal
          companyId={company.id}
          invoiceId={invoiceId}
          canManage={has("companies:invoice")}
          onClose={() => setInvoiceId(null)}
          onMessage={(message) => addToast(message, "success")}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
