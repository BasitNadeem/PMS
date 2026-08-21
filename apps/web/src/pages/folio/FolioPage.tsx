import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Trash2, Check, Printer, LogOut, AlertTriangle, Building2, RotateCcw, UserRound, Wallet, X } from "lucide-react";
import { reservationsService } from "@/services/reservations";
import { groupsService } from "@/services/groups";
import { cn } from "@/lib/cn";
import { folioService, type FolioLineItem, type FolioItemType, type PaymentMethod } from "@/services/folio";
import { AddChargeModal } from "@/components/folio/AddChargeModal";
import { RecordPaymentModal } from "@/components/folio/RecordPaymentModal";
import { RefundPaymentModal } from "@/components/folio/RefundPaymentModal";
import { BillToCompanyModal } from "@/components/companies/BillToCompanyModal";
import { ReceiptView } from "@/components/pos/ReceiptView";
import { FolioInvoiceView } from "@/components/folio/FolioInvoiceView";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { ReservationIdLink } from "@/components/reservations/ReservationIdLink";
import { AllocatePayerModal } from "@/components/folio/AllocatePayerModal";
import { bannerMessageFor } from "@/lib/formErrors";

// ── Config ────────────────────────────────────────────────────────────────────

const ITEM_TYPE_CONFIG: Record<FolioItemType, { label: string; tone: string }> = {
  ROOM_CHARGE:   { label: "Room",        tone: "slate" },
  FOOD_BEVERAGE: { label: "F&B",         tone: "amber" },
  LAUNDRY:       { label: "Laundry",     tone: "dusk" },
  TRANSPORT:     { label: "Transport",   tone: "slate" },
  SPA:           { label: "Spa",         tone: "dusk" },
  ACTIVITY:      { label: "Activity",    tone: "pine" },
  MINIBAR:       { label: "Minibar",     tone: "amber" },
  TELEPHONE:     { label: "Telephone",   tone: "ink" },
  INTERNET:      { label: "Internet",    tone: "ink" },
  TAX:           { label: "Tax",         tone: "ink" },
  DISCOUNT:      { label: "Discount",    tone: "pine" },
  ADJUSTMENT:    { label: "Adjustment",  tone: "amber" },
  DAMAGE_CHARGE: { label: "Damage",      tone: "clay" },
  MISCELLANEOUS: { label: "Other",       tone: "ink" },
};

const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, string> = {
  CASH: "Cash", JAZZCASH: "JazzCash", EASYPAISA: "EasyPaisa",
  CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
  BANK_TRANSFER: "Bank Transfer", CHEQUE: "Cheque",
  ADVANCE_DEPOSIT: "Advance Deposit", OTA_COLLECT: "OTA Collect",
  COMPLIMENTARY: "Complimentary",
};

function fmtPkr(paise: number): string {
  return `PKR ${(paise / 100).toLocaleString("en-PK")}`;
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(iso));
}
function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FolioPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fromBilling = pathname.startsWith("/financials");
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreateCharge = has("billing:create");
  const canRecordPayment = has("billing:create");
  const canRefundPayment = has("billing:delete");
  const canBillToCompany = has("companies:post");
  const canAllocatePayer = has("billing:update");
  const canVoidCharge = has("billing:delete");
  const canCheckOut = has("reservations:update");
  const { toasts, addToast, removeToast } = useToast();
  const [showAddCharge,    setShowAddCharge]    = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showBillToCompany, setShowBillToCompany] = useState(false);
  const [showFbReceipt,    setShowFbReceipt]    = useState(false);
  const [showInvoice,      setShowInvoice]      = useState(false);
  const [refundPayment,    setRefundPayment]    = useState<{ id: string; amount: number } | null>(null);
  const [allocationMode, setAllocationMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [showAllocatePayer, setShowAllocatePayer] = useState(false);

  function invalidateFolioAndBilling() {
    // Folio mutations affect both the detail view and every filtered/sorted
    // Billing query. Invalidate the prefixes so returning to Billing never
    // reuses the one-minute "fresh" cache from before the mutation.
    qc.invalidateQueries({ queryKey: ["folio"] });
    qc.invalidateQueries({ queryKey: ["billing-folios"] });
    qc.invalidateQueries({ queryKey: ["billing-summary"] });
  }

  const { data: folio, isLoading } = useQuery({
    queryKey: ["folio", reservationId],
    queryFn: () => folioService.getFolio(reservationId!),
    enabled: !!reservationId,
    refetchInterval: 15_000,
  });

  const voidMutation = useMutation({
    mutationFn: (itemId: string) => folioService.deleteFolioItem(reservationId!, itemId),
    onSuccess: () => {
      invalidateFolioAndBilling();
      addToast("Charge removed");
    },
    onError: () => addToast("Failed to remove charge", "error"),
  });

  // ── Group context (must come before checkout mutations so they can reference it) ──

  const groupId = folio?.reservation.groupId ?? null;

  // Fetch group details to determine billingType (SINGLE vs SPLIT) and to know
  // which sibling reservations are still checked in — used for auto-checkout logic.
  const { data: groupData } = useQuery({
    queryKey: ["group", groupId],
    queryFn:  () => groupsService.getGroup(groupId!),
    enabled:  !!groupId,
    staleTime: 60_000,
  });

  const isGroupSingleBill = !!groupId && groupData?.billingType === "SINGLE";

  // SPLIT group auto-checkout: if every OTHER reservation in this group is already
  // CHECKED_OUT (or cancelled/no-show), this folio belongs to the last remaining room.
  // Checking out here should silently close the whole group.
  const isLastSplitRoom = !!groupId
    && !isGroupSingleBill
    && !!groupData?.reservations
    && groupData.reservations
        .filter((r) => r.id !== reservationId)
        .every((r) => ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status));

  function invalidateAfterCheckout() {
    invalidateFolioAndBilling();
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["reservations-counts"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }

  // Group checkout mutation — used both for SINGLE bill and auto-triggered for last SPLIT room.
  const checkOutGroupMutation = useMutation({
    mutationFn: () => groupsService.checkOutGroup(groupId!),
    onSuccess: () => {
      invalidateAfterCheckout();
      addToast("Group checked out successfully");
      navigate("/reservations");
    },
    onError: (error) => addToast(bannerMessageFor(error) ?? "Failed to check out group", "error"),
  });

  // Individual room checkout — for SPLIT billing.
  // If this is the last room, auto-triggers group checkout instead of leaving a manual step.
  const checkOutMutation = useMutation({
    mutationFn: () => reservationsService.updateReservationStatus(reservationId!, "CHECKED_OUT"),
    onSuccess: async () => {
      invalidateAfterCheckout();
      if (isLastSplitRoom) {
        // Auto-checkout the group — all rooms are now settled, no manual click needed.
        try {
          await groupsService.checkOutGroup(groupId!);
          invalidateAfterCheckout();
          addToast("All rooms settled — group checked out automatically");
        } catch {
          addToast("Room checked out. Please click 'Check Out Group' to finalise.", "error");
        }
        navigate(`/groups/${groupId}`);
      } else {
        addToast("Room checked out. Settle remaining rooms from the group page.");
        navigate(groupId ? `/groups/${groupId}` : "/reservations");
      }
    },
    onError: (error) => addToast(bannerMessageFor(error) ?? "Failed to check out", "error"),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-5 w-32 bg-line-soft rounded" />
        <div className="h-20 bg-line-soft rounded-xl2" />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 h-64 bg-line-soft rounded-xl2" />
          <div className="h-64 bg-line-soft rounded-xl2" />
        </div>
      </div>
    );
  }

  if (!folio) {
    return <div className="py-10 text-center text-ink-mute">Folio not found.</div>;
  }

  const res     = folio.reservation;
  const folioStatus = folio.isOpen ? "Open" : "Settled";
  const selectedItems = folio.items.filter((item) => selectedItemIds.has(item.id));
  const hasCompanyResponsibility = folio.companyResponsibilityTotal > 0;
  const companyNames = Array.from(new Set(
    folio.items
      .filter((item) => item.payerType === "COMPANY" && item.payerCompany?.name)
      .map((item) => item.payerCompany!.name),
  ));
  const assignedCompanyIds = Array.from(new Set(
    folio.items
      .filter((item) => item.payerType === "COMPANY" && item.payerCompanyId)
      .map((item) => item.payerCompanyId!),
  ));
  const assignedCompanyId = assignedCompanyIds.length === 1 ? assignedCompanyIds[0] : null;
  const hasLegacyWholeFolioBtc = !hasCompanyResponsibility && res.billToCompany && Boolean(res.companyId);

  function setSelection(itemIds: string[]) {
    setSelectedItemIds(new Set(itemIds));
  }

  function toggleSelected(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function closeAllocationMode() {
    setAllocationMode(false);
    setSelectedItemIds(new Set());
  }

  function changePayerFor(itemIds: string[]) {
    setSelectedItemIds(new Set(itemIds));
    setShowAllocatePayer(true);
  }

  // Group items by type
  const grouped = new Map<FolioItemType, FolioLineItem[]>();
  for (const item of folio.items) {
    grouped.set(item.type, [...(grouped.get(item.type) ?? []), item]);
  }

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate(fromBilling ? "/financials" : `/reservations/${reservationId}`)}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={15} /> {fromBilling ? "Back to Billing" : "Back to Reservation"}
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Avatar name={res.guest.fullName} size={52} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="serif text-[30px] leading-tight text-ink">{res.guest.fullName}</h1>
            <StatusBadge status={folioStatus} />
            {res.groupId && (
              <Link
                to={`/groups/${res.groupId}`}
                className="rounded-full bg-dusk-soft px-2.5 py-1 text-[11px] font-bold tracking-wide text-dusk hover:bg-dusk/20 transition-colors"
              >
                GROUP BOOKING
              </Link>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-mute">
            <span className="tnum font-semibold">{folio.folioNumber}</span>
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
            <span>Room {res.rooms[0]?.room.number ?? "—"}</span>
            {res.confirmationNumber && (
              <>
                <span className="h-1 w-1 rounded-full bg-ink-faint" />
                <ReservationIdLink id={res.id} confirmationNumber={res.confirmationNumber} className="py-0.5" />
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 no-print">
          {folio.isOpen && canCreateCharge && (
            <button
              onClick={() => setShowAddCharge(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark transition-colors shadow-pop"
            >
              <Plus size={15} /> Add charge
            </button>
          )}
          {folio.items.some((i) => i.type === "FOOD_BEVERAGE") && (
            <button
              onClick={() => setShowFbReceipt(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-line-soft transition-colors"
            >
              <Printer size={15} /> F&amp;B Receipt
            </button>
          )}
          <button
            onClick={() => setShowInvoice(true)}
            className="grid place-items-center h-10 w-10 rounded-full border border-coral/30 bg-coral/8 text-coral hover:bg-coral/15 transition-colors"
            title="Print invoice"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Closed banner */}
      {!folio.isOpen && (
        <div className="mb-5 rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-center text-[13px] font-semibold text-pine-deep">
          Folio closed {folio.closedAt ? `· ${fmtDate(folio.closedAt)}` : ""}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — Charges */}
        <div className="lg:col-span-2 space-y-4">
          {/* Itemized charges grouped by kind */}
          <Card>
            <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Charges &amp; who pays</div>
                {allocationMode && (
                  <div className="mt-0.5 text-[12px] text-ink-mute">Select what the guest or company is responsible for.</div>
                )}
              </div>
              {folio.isOpen && canAllocatePayer && folio.items.length > 0 && (
                allocationMode ? (
                  <button type="button" onClick={closeAllocationMode} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-ink-mute transition-colors hover:bg-mist hover:text-ink">
                    <X size={13} /> Done
                  </button>
                ) : (
                  <button type="button" onClick={() => setAllocationMode(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-semibold text-ink-soft transition-colors hover:border-coral/30 hover:text-coral">
                    <UserRound size={13} /> Change who pays
                  </button>
                )
              )}
            </div>
            {allocationMode && (
              <div className="mb-3 rounded-xl border border-line bg-mist/65 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Quick select</span>
                  <button type="button" onClick={() => setSelection(folio.items.filter((item) => item.type === "ROOM_CHARGE").map((item) => item.id))} className="rounded-full border border-line bg-card px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:border-coral/30 hover:text-coral">
                    Room only
                  </button>
                  <button type="button" onClick={() => setSelection(folio.items.filter((item) => item.type === "ROOM_CHARGE" || item.type === "TAX").map((item) => item.id))} className="rounded-full border border-line bg-card px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:border-coral/30 hover:text-coral">
                    Room &amp; tax
                  </button>
                  <button type="button" onClick={() => setSelection(folio.items.map((item) => item.id))} className="rounded-full border border-line bg-card px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:border-coral/30 hover:text-coral">
                    All charges
                  </button>
                  {selectedItemIds.size > 0 && (
                    <button type="button" onClick={() => setSelection([])} className="px-2 py-1.5 text-[11.5px] font-semibold text-ink-mute hover:text-ink">Clear</button>
                  )}
                  <button type="button" disabled={selectedItemIds.size === 0} onClick={() => setShowAllocatePayer(true)} className="ml-auto h-8 rounded-full bg-ink px-4 text-[12px] font-semibold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-35">
                    Continue{selectedItemIds.size > 0 ? ` · ${selectedItemIds.size}` : ""}
                  </button>
                </div>
              </div>
            )}
            {folio.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line py-8 flex flex-col items-center gap-3">
                <p className="text-[13px] text-ink-mute">No charges yet</p>
                {folio.isOpen && canCreateCharge && (
                  <button
                    onClick={() => setShowAddCharge(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors shadow-pop"
                  >
                    <Plus size={14} /> Add first charge
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl2 border border-line bg-card overflow-hidden">
                {Array.from(grouped.entries()).map(([type, items], gi) => {
                  const cfg  = ITEM_TYPE_CONFIG[type] ?? { label: type, tone: "ink" };
                  const t    = toneOf(cfg.tone === "pine" ? "Available" : cfg.tone === "amber" ? "Maintenance" : cfg.tone === "slate" ? "Confirmed" : cfg.tone === "clay" ? "Cancelled" : "Checked Out");
                  const sum  = items.reduce((s, c) => s + c.amount, 0);
                  const isDiscount = type === "DISCOUNT";
                  return (
                    <div key={type} className={gi > 0 ? "border-t border-line-soft" : ""}>
                      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5">
                        <span className="grid place-items-center h-7 w-7 rounded-lg" style={{ background: t.bg, color: t.fg }}>
                          <span className="text-[10px] font-bold">{cfg.label[0]}</span>
                        </span>
                        <span className="text-[12px] font-bold uppercase tracking-wider text-ink-mute">{cfg.label}</span>
                        <span className={cn("ml-auto text-[13px] font-bold tnum", isDiscount ? "text-pine" : "text-ink")}>
                          {isDiscount ? "−" : ""}{fmtPkr(Math.abs(sum))}
                        </span>
                      </div>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "group flex items-center justify-between gap-3 px-4 py-2 pl-[52px] transition-colors",
                            allocationMode && "cursor-pointer hover:bg-mist/70",
                            selectedItemIds.has(item.id) && "bg-coral-soft/35",
                          )}
                          onClick={() => allocationMode && toggleSelected(item.id)}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {allocationMode && (
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => toggleSelected(item.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="h-4 w-4 shrink-0 accent-coral"
                                aria-label={`Select ${item.description}`}
                              />
                            )}
                            <span className="text-[13px] text-ink-soft">{item.description}</span>
                            <button
                              type="button"
                              disabled={!folio.isOpen || !canAllocatePayer}
                              onClick={(event) => {
                                event.stopPropagation();
                                changePayerFor([item.id]);
                              }}
                              title={folio.isOpen && canAllocatePayer ? "Change who pays this charge" : undefined}
                              className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold transition-all",
                              item.payerType === "COMPANY" ? "bg-coral-soft text-coral-dark" : "bg-dusk-soft text-dusk",
                              folio.isOpen && canAllocatePayer && "cursor-pointer ring-1 ring-transparent hover:ring-current focus:outline-none focus:ring-1 focus:ring-current",
                            )}>
                              {item.payerType === "COMPANY" ? <Building2 size={10} /> : <UserRound size={10} />}
                              {item.payerType === "COMPANY" ? `BTC · ${item.payerCompany?.name ?? "Company"}` : "Guest"}
                            </button>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px] text-ink-faint tnum">{fmtDate(item.chargeDate)}</span>
                            {folio.isOpen && canVoidCharge && (
                              <button
                                onClick={(event) => { event.stopPropagation(); voidMutation.mutate(item.id); }}
                                disabled={voidMutation.isPending}
                                className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-clay transition-all disabled:opacity-40"
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Inline add row — sits at the bottom of the charges list for fast contextual access */}
                {folio.isOpen && canCreateCharge && (
                  <button
                    onClick={() => setShowAddCharge(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 border-t border-dashed border-line text-[13px] font-semibold text-ink-faint hover:text-coral hover:bg-coral-soft/30 transition-colors group"
                  >
                    <span className="grid place-items-center h-6 w-6 rounded-lg border border-dashed border-line-soft group-hover:border-coral/30 group-hover:bg-coral-soft text-ink-faint group-hover:text-coral transition-colors">
                      <Plus size={13} />
                    </span>
                    Add charge
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Payments list */}
          {folio.payments.length > 0 && (
            <Card>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Payments</div>
              <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
                {folio.payments.map((p) => {
                  const methodLabel = PAYMENT_METHOD_CONFIG[p.method] ?? p.method;
                  const refunded = !p.isRefund
                    ? folio.payments.filter((item) => item.isRefund && item.originalPaymentId === p.id)
                        .reduce((sum, item) => sum + item.amount, 0)
                    : 0;
                  const refundable = Math.max(0, p.amount - refunded);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn("grid place-items-center h-8 w-8 rounded-lg shrink-0", p.isRefund ? "bg-clay-soft text-clay" : "bg-pine-soft text-pine")}>
                        {p.isRefund ? <RotateCcw size={15} /> : <Check size={16} strokeWidth={2.5} />}
                      </span>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-semibold text-ink">{p.isRefund ? `${methodLabel} refund` : methodLabel}</div>
                        <div className="text-[12px] text-ink-mute tnum">{fmtDateTime(p.postedAt)}{p.refundReason ? ` · ${p.refundReason}` : ""}</div>
                      </div>
                      {!p.isRefund && canRefundPayment && refundable > 0 && (
                        <button onClick={() => setRefundPayment({ id: p.id, amount: refundable })} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-mute hover:border-clay/30 hover:text-clay">Refund</button>
                      )}
                      <span className={cn("text-[14px] font-bold tnum", p.isRefund ? "text-clay" : "text-pine")}>{p.isRefund ? "−" : ""}{fmtPkr(p.amount)}</span>
                    </div>
                  );
                })}
                {folio.payments.length === 0 && (
                  <div className="px-4 py-4 text-[13px] text-ink-mute text-center">No payments recorded</div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT — Settlement */}
        <div className="space-y-4">
          <Card pad={false} className="overflow-hidden">
            <div className="p-5">
              <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Settlement</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-ink-mute">Total charges</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(folio.chargesTotal)}</span>
                </div>
                {folio.taxTotal > 0 && (
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span className="text-ink-mute">Tax</span>
                    <span className="font-semibold text-ink tnum">{fmtPkr(folio.taxTotal)}</span>
                  </div>
                )}
                {folio.discountsTotal > 0 && (
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span className="text-ink-mute">Discounts</span>
                    <span className="font-semibold text-pine tnum">−{fmtPkr(folio.discountsTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-ink-mute">Total paid</span>
                  <span className="font-semibold text-pine tnum">−{fmtPkr(folio.paymentsTotal)}</span>
                </div>
              </div>

              {hasCompanyResponsibility ? (
                <div className="mt-3.5 border-t border-line-soft pt-3.5 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-mute">
                      <UserRound size={13} className="text-dusk" /> Guest due
                      <span className="text-[11px] text-ink-faint">of {fmtPkr(folio.guestResponsibilityTotal)}</span>
                    </span>
                    <span className="serif text-[19px] leading-none text-dusk tnum">{fmtPkr(folio.guestBalanceDue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-mute">
                      <Building2 size={13} className="shrink-0 text-coral" />
                      <span className="truncate" title={companyNames.join(", ")}>
                        {companyNames.join(", ") || "Company (BTC)"}
                      </span>
                    </span>
                    <span className="serif text-[19px] leading-none text-coral tnum">{fmtPkr(folio.companyBalanceDue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Total outstanding</span>
                    <span className="serif text-[24px] leading-none text-ink tnum">{fmtPkr(folio.balanceDue)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3.5 flex items-baseline justify-between gap-3 border-t border-line-soft pt-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    {folio.balanceDue > 0 ? "Balance due" : "Balance"}
                  </span>
                  <span className={cn(
                    "serif text-[28px] leading-none tnum",
                    folio.balanceDue > 0 ? "text-coral" : "text-pine-deep",
                  )}>
                    {fmtPkr(folio.balanceDue)}
                  </span>
                </div>
              )}
            </div>

            {/* Actions share one flat stack — every button is the same height,
                radius and icon size, so the column reads as a single list
                rather than nested cards at competing sizes. */}
            <div className="border-t border-line-soft bg-mist/30 p-5 space-y-2.5">
              {folio.guestBalanceDue > 0 && folio.isOpen ? (
                <>
                  {canRecordPayment && (
                    <button
                      onClick={() => setShowRecordPayment(true)}
                      className="w-full h-11 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Wallet size={16} /> Record payment
                    </button>
                  )}
                  {canBillToCompany && !hasCompanyResponsibility && (
                    <button
                      onClick={() => setShowBillToCompany(true)}
                      className="w-full h-11 rounded-full border border-line bg-card text-ink-soft text-sm font-semibold hover:border-ink-faint hover:text-ink transition-colors flex items-center justify-center gap-2"
                    >
                      <Building2 size={16} /> Bill to a company
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 h-11 rounded-full bg-pine-soft text-pine-deep text-sm font-semibold">
                  <Check size={16} strokeWidth={2.5} /> {hasCompanyResponsibility && folio.companyBalanceDue > 0 ? "Guest settled" : "Settled"}
                </div>
              )}

              {hasCompanyResponsibility && folio.isOpen && folio.companyBalanceDue > 0 && (
                <div className="space-y-2 rounded-xl bg-coral-soft/45 p-3">
                  <p className="text-[12.5px] leading-snug text-ink-soft">
                    <span className="font-semibold text-coral-dark">{fmtPkr(folio.companyBalanceDue)} BTC pending.</span>{" "}
                    Transfer the company-assigned charges to its ledger.
                  </p>
                  {canBillToCompany && (
                    <button
                      onClick={() => setShowBillToCompany(true)}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-[13px] font-semibold text-white transition-colors hover:bg-ink-soft"
                    >
                      <Building2 size={15} /> Transfer BTC to company
                    </button>
                  )}
                </div>
              )}

              {canCheckOut && res.status === "CHECKED_IN" && (() => {
                const mutation      = isGroupSingleBill ? checkOutGroupMutation : checkOutMutation;
                const isPending     = mutation.isPending;
                const label         = isGroupSingleBill ? "Check Out Group" : "Check Out";
                const pendingLabel  = isGroupSingleBill ? "Checking out group…" : "Checking out…";

                const guestMustPay = hasCompanyResponsibility
                  ? folio.guestBalanceDue > 0
                  : folio.balanceDue > 0 && !hasLegacyWholeFolioBtc;
                const btcWillTransfer = hasCompanyResponsibility && folio.companyBalanceDue > 0;

                return guestMustPay ? (
                  <>
                    <p className="flex items-start gap-2 pt-1 text-[12px] leading-snug text-amber">
                      <AlertTriangle size={14} className="mt-px shrink-0" />
                      <span>Guest balance of {fmtPkr(hasCompanyResponsibility ? folio.guestBalanceDue : folio.balanceDue)} must be settled before checkout.</span>
                    </p>
                  </>
                ) : (
                  <>
                    {btcWillTransfer && (
                      <p className="pt-1 text-[12px] leading-snug text-ink-mute">
                        {fmtPkr(folio.companyBalanceDue)} BTC will move to {companyNames[0] ?? "the assigned company"}'s ledger.
                      </p>
                    )}
                    {isGroupSingleBill && (
                      <p className="pt-1 text-[12px] leading-snug text-ink-mute">
                        Single-bill group · all {groupData?.summary?.totalRooms ?? ""} rooms will be checked out together
                      </p>
                    )}
                    <button
                      onClick={() => mutation.mutate()}
                      disabled={isPending}
                      className="w-full h-11 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
                    >
                      <LogOut size={16} />
                      {isPending ? pendingLabel : label}
                    </button>
                  </>
                );
              })()}

              {/* Document action, deliberately quiet. */}
              <button
                onClick={() => setShowInvoice(true)}
                className="w-full h-10 mt-1 rounded-full text-ink-mute text-[13px] font-semibold hover:bg-line-soft hover:text-ink transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={15} /> Print invoice
              </button>
            </div>
          </Card>

          {/* Reservation link */}
          <Card className="!py-3">
            <Link
              to={`/reservations/${reservationId}`}
              className="flex items-center justify-between text-[13px] font-semibold text-coral hover:text-coral-dark transition-colors"
            >
              <span>View reservation</span>
              <ArrowRight size={15} />
            </Link>
          </Card>
        </div>
      </div>

      {showFbReceipt && folio && (() => {
        const fbItems = folio.items.filter((i) => i.type === "FOOD_BEVERAGE");
        const fbTotal = fbItems.reduce((s, i) => s + i.amount, 0);
        return (
          <ReceiptView
            guestName={folio.reservation.guest.fullName}
            roomNumber={folio.reservation.rooms[0]?.room.number}
            orderNumber={folio.folioNumber}
            dateTime={new Date().toISOString()}
            items={fbItems.map((i) => ({
              name:      i.description,
              quantity:  i.quantity,
              unitPrice: i.unitAmount,
              lineTotal: i.amount,
            }))}
            subtotal={fbTotal}
            taxAmount={0}
            discountAmount={0}
            total={fbTotal}
            paymentStatus={{ type: "CHARGED_TO_ROOM", roomNumber: folio.reservation.rooms[0]?.room.number ?? "—" }}
            onClose={() => setShowFbReceipt(false)}
          />
        );
      })()}
      {showInvoice && folio && (
        <FolioInvoiceView
          folio={folio}
          group={groupData ? { name: groupData.name, payerName: groupData.payerName } : null}
          onClose={() => setShowInvoice(false)}
        />
      )}
      {showAddCharge && (
        <AddChargeModal reservationId={reservationId!} onClose={() => setShowAddCharge(false)} />
      )}
      {showBillToCompany && folio && (
        <BillToCompanyModal
          reservationId={reservationId!}
          balanceDue={hasCompanyResponsibility ? folio.companyBalanceDue : folio.guestBalanceDue}
          defaultCompanyId={res?.companyId ?? null}
          assignedCompanyId={hasCompanyResponsibility ? assignedCompanyId : null}
          mode={hasCompanyResponsibility ? "BTC" : "FULL_FOLIO"}
          onClose={() => setShowBillToCompany(false)}
          onSuccess={(m) => addToast(m)}
        />
      )}

      {showRecordPayment && folio && (
        <RecordPaymentModal reservationId={reservationId!} balanceDue={folio.guestBalanceDue} onClose={() => setShowRecordPayment(false)} />
      )}
      {showAllocatePayer && selectedItems.length > 0 && (
        <AllocatePayerModal
          reservationId={reservationId!}
          items={selectedItems}
          defaultCompanyId={res.companyId}
          onClose={() => setShowAllocatePayer(false)}
          onSuccess={(message) => {
            addToast(message);
            closeAllocationMode();
          }}
        />
      )}
      {refundPayment && (
        <RefundPaymentModal reservationId={reservationId!} paymentId={refundPayment.id} refundableAmount={refundPayment.amount}
          onClose={() => setRefundPayment(null)} onSuccess={() => addToast("Payment refunded and Balance Book updated.")} />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
