import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Check, Printer, LogOut, AlertTriangle } from "lucide-react";
import { reservationsService } from "@/services/reservations";
import { groupsService } from "@/services/groups";
import { cn } from "@/lib/cn";
import { folioService, type FolioLineItem, type FolioItemType, type PaymentMethod } from "@/services/folio";
import { AddChargeModal } from "@/components/folio/AddChargeModal";
import { RecordPaymentModal } from "@/components/folio/RecordPaymentModal";
import { ReceiptView } from "@/components/pos/ReceiptView";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

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
  useRealtimeSync();
  const { has } = usePermissions();
  const canCreateCharge = has("billing:create");
  const canRecordPayment = has("billing:create");
  const canVoidCharge = has("billing:delete");
  const canCheckOut = has("reservations:update");
  const { toasts, addToast, removeToast } = useToast();
  const [showAddCharge,    setShowAddCharge]    = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showFbReceipt,    setShowFbReceipt]    = useState(false);

  const { data: folio, isLoading } = useQuery({
    queryKey: ["folio", reservationId],
    queryFn: () => folioService.getFolio(reservationId!),
    enabled: !!reservationId,
    refetchInterval: 60_000,
  });

  const voidMutation = useMutation({
    mutationFn: (itemId: string) => folioService.deleteFolioItem(reservationId!, itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["folio", reservationId] }); addToast("Charge removed"); },
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
    onError: () => addToast("Failed to check out group", "error"),
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
    onError: () => addToast("Failed to check out", "error"),
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
  const total   = folio.chargesTotal + folio.taxTotal - folio.discountsTotal;
  const folioStatus = folio.isOpen ? "Open" : "Settled";

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
                <span className="tnum">{res.confirmationNumber}</span>
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
            onClick={() => window.print()}
            className="grid place-items-center h-10 w-10 rounded-full border border-line text-ink-mute hover:bg-line-soft transition-colors"
            title="Print folio"
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
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Itemized charges</div>
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
                        <div key={item.id} className="flex items-center justify-between px-4 py-2 pl-[52px] group">
                          <div className="min-w-0">
                            <span className="text-[13px] text-ink-soft">{item.description}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px] text-ink-faint tnum">{fmtDate(item.chargeDate)}</span>
                            {folio.isOpen && canVoidCharge && (
                              <button
                                onClick={() => voidMutation.mutate(item.id)}
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
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid place-items-center h-8 w-8 rounded-lg bg-pine-soft text-pine shrink-0">
                        <Check size={16} strokeWidth={2.5} />
                      </span>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-semibold text-ink">{methodLabel}</div>
                        <div className="text-[12px] text-ink-mute tnum">{fmtDateTime(p.postedAt)}</div>
                      </div>
                      <span className="text-[14px] font-bold text-pine tnum">{fmtPkr(p.amount)}</span>
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
          <Card className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Settlement</div>
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
            <div className="border-t border-line-soft pt-2.5 flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">Balance due</span>
              <span className={cn("serif text-[26px] tnum", folio.balanceDue > 0 ? "text-coral" : "text-pine")}>
                {fmtPkr(folio.balanceDue)}
              </span>
            </div>

            <div className="pt-2 space-y-2">
              {folio.balanceDue > 0 && folio.isOpen ? (
                canRecordPayment && (
                  <button
                    onClick={() => setShowRecordPayment(true)}
                    className="w-full h-11 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors flex items-center justify-center gap-2"
                  >
                    Record payment
                  </button>
                )
              ) : (
                <div className="flex items-center justify-center gap-2 h-11 rounded-full bg-pine-soft text-pine-deep text-sm font-semibold">
                  <Check size={16} strokeWidth={2.5} /> Settled
                </div>
              )}

              {/* Check Out — smart about group vs individual billing */}
              {canCheckOut && res.status === "CHECKED_IN" && (() => {
                const mutation      = isGroupSingleBill ? checkOutGroupMutation : checkOutMutation;
                const isPending     = mutation.isPending;
                const label         = isGroupSingleBill ? "Check Out Group" : "Check Out";
                const pendingLabel  = isGroupSingleBill ? "Checking out group…" : "Checking out…";

                return folio.balanceDue > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5 text-[12.5px] text-amber">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>Outstanding balance of {fmtPkr(folio.balanceDue)}. Settle before checking out.</span>
                    </div>
                    <button
                      onClick={() => mutation.mutate()}
                      disabled={isPending}
                      className="w-full h-10 rounded-full border border-ink/20 text-ink-soft text-[13px] font-semibold hover:bg-line-soft transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <LogOut size={15} />
                      {isPending ? pendingLabel : `${label} anyway`}
                    </button>
                  </div>
                ) : (
                  <>
                    {isGroupSingleBill && (
                      <p className="text-[12px] text-ink-mute text-center">
                        Single-bill group · all {groupData?.summary?.totalRooms ?? ""} rooms will be checked out together
                      </p>
                    )}
                    <button
                      onClick={() => mutation.mutate()}
                      disabled={isPending}
                      className="w-full h-11 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <LogOut size={16} />
                      {isPending ? pendingLabel : label}
                    </button>
                  </>
                );
              })()}

              <button
                onClick={() => window.print()}
                className="w-full h-10 rounded-full border border-line text-ink-mute text-[13px] font-semibold hover:bg-line-soft transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={15} /> Print folio
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
              <span>→</span>
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
      {showAddCharge && (
        <AddChargeModal reservationId={reservationId!} onClose={() => setShowAddCharge(false)} />
      )}
      {showRecordPayment && folio && (
        <RecordPaymentModal reservationId={reservationId!} balanceDue={folio.balanceDue} onClose={() => setShowRecordPayment(false)} />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
