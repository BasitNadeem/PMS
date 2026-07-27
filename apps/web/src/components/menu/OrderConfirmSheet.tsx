import { useState, useEffect, useRef } from "react";
import { ArrowLeft, X, Loader2, CheckCircle2, Search, BedDouble, ShoppingBag, UtensilsCrossed, Wallet } from "lucide-react";
import type { CartItem } from "./CartBar";
import { qrMenuService } from "../../services/qrMenu";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getPhoneErrorMessage } from "@/lib/validation";

interface OrderConfirmSheetProps {
  hotelSlug:   string;
  hotelName:   string;
  items:       CartItem[];
  taxRate:     number;
  onClose:     () => void;
  onSuccess:   (orderNumber: string) => void;
  onUpdateQty: (menuItemId: string, qty: number) => void;
}

type DeliveryType       = "room_delivery" | "pickup" | "dine_in";
type PaymentPreference  = "charge_to_room" | "pay_now";

interface RoomMatch {
  roomNumber: string;
  guestName:  string;
  guestPhone: string | null;
}

const DELIVERY_LABELS: Record<DeliveryType, string> = {
  room_delivery: "Room Delivery",
  pickup:        "Pick Up",
  dine_in:       "Dine In",
};

const DELIVERY_ICONS: Record<DeliveryType, typeof BedDouble> = {
  room_delivery: BedDouble,
  pickup:        ShoppingBag,
  dine_in:       UtensilsCrossed,
};

// "Pressed into the linen" — darker sand fill, no border, soft inset shadow.
const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-base focus:outline-none transition-colors";
const inputStyle = { background: "rgb(var(--qr-bg-deep))", border: "none", color: "rgb(var(--qr-ink))", boxShadow: "inset 0 1px 3px rgb(41 26 18 / 0.08)" };
const sectionLabelCls = "text-[11px] font-bold uppercase tracking-widest mb-2 block";
const cardStyle = { border: "1px solid rgb(var(--qr-line-soft))", boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.12)" };

function defaultPaymentPreference(deliveryType: DeliveryType): PaymentPreference {
  return deliveryType === "room_delivery" ? "charge_to_room" : "pay_now";
}

export function OrderConfirmSheet({
  hotelSlug,
  hotelName,
  items,
  taxRate,
  onClose,
  onSuccess,
  onUpdateQty,
}: OrderConfirmSheetProps) {
  useEscapeKey(onClose);
  // Room lookup
  const [roomQuery,    setRoomQuery]    = useState("");
  const [verifying,    setVerifying]    = useState(false);
  const [roomMatch,    setRoomMatch]    = useState<RoomMatch | null>(null);  // confirmed match
  const [noMatch,      setNoMatch]      = useState(false);

  // Guest details — autofilled from reservation or entered manually
  const [guestName,    setGuestName]    = useState("");
  const [guestPhone,   setGuestPhone]   = useState("");

  // Order options
  const [deliveryType,       setDeliveryType]       = useState<DeliveryType>("room_delivery");
  const [paymentPreference,  setPaymentPreference]  = useState<PaymentPreference>("charge_to_room");
  const [specialInstr,       setSpecialInstr]       = useState("");
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const total = subtotal + taxAmount;

  // Debounced room lookup — triggers 500ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = roomQuery.trim();
    if (q.length === 0) {
      setNoMatch(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setVerifying(true);
      try {
        const result = await qrMenuService.verifyRoom(hotelSlug, q);
        if (result.found && result.guestName) {
          // Don't auto-select — show result card for user to tap
          setRoomMatch({
            roomNumber: result.roomNumber,
            guestName:  result.guestName,
            guestPhone: result.guestPhone,
          });
          setNoMatch(false);
        } else {
          setRoomMatch(null);
          setNoMatch(true);
        }
      } catch {
        setRoomMatch(null);
        setNoMatch(false);
      } finally {
        setVerifying(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomQuery, hotelSlug]);

  // When user clears search, reset match state
  function handleRoomQueryChange(val: string) {
    setRoomQuery(val);
    setRoomMatch(null);
    setNoMatch(false);
  }

  // User taps a result card — confirm the room and autofill
  const [confirmedRoom, setConfirmedRoom] = useState<RoomMatch | null>(null);

  function selectRoom(match: RoomMatch) {
    setConfirmedRoom(match);
    setGuestName(match.guestName);
    setGuestPhone(match.guestPhone ?? "");
    setPaymentPreference("charge_to_room");
    setRoomMatch(null); // hide dropdown
  }

  function clearRoom() {
    setConfirmedRoom(null);
    setRoomQuery("");
    if (deliveryType !== "room_delivery") setPaymentPreference("pay_now");
    setNoMatch(false);
  }

  function selectDeliveryType(t: DeliveryType) {
    setDeliveryType(t);
    setPaymentPreference(defaultPaymentPreference(t));
    if (t !== "room_delivery") {
      setConfirmedRoom(null);
      setRoomQuery("");
      setRoomMatch(null);
      setNoMatch(false);
    }
  }

  // Never submit a raw room string as proof of a room charge. The API repeats
  // this verification independently before it creates the order.
  const effectiveRoom = confirmedRoom?.roomNumber;
  const isRoomCharge = paymentPreference === "charge_to_room";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isRoomCharge && !confirmedRoom) {
      setError("Select a verified checked-in room before charging this order to a room.");
      return;
    }
    const phoneErr = getPhoneErrorMessage(guestPhone);
    if (phoneErr) { setError(phoneErr); return; }
    setLoading(true);
    try {
      const result = await qrMenuService.placeOrder(hotelSlug, {
        guestName,
        guestPhone,
        roomNumber:        effectiveRoom,
        deliveryType,
        paymentPreference,
        specialInstructions: specialInstr || undefined,
        items: items.map((i) => ({
          menuItemId:  i.menuItemId,
          quantity:    i.quantity,
          specialNote: i.specialNote || undefined,
        })),
      });
      onSuccess(result.orderNumber);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        .response?.data?.error ?? "Failed to place order. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const [cartExpanded, setCartExpanded] = useState(false);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="qr-theme fixed inset-0 z-50 flex flex-col" style={{ background: "rgb(var(--qr-bg))" }}>
      {/* Header */}
      <div className="qr-glass flex items-center gap-2 px-3 py-3.5" style={{ borderBottom: "1px solid rgb(var(--qr-line-soft))" }}>
        <button
          onClick={onClose}
          className="grid place-items-center h-9 w-9 rounded-full transition-colors shrink-0"
          style={{ color: "rgb(var(--qr-ink-mute))" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="serif italic text-[19px]" style={{ color: "rgb(var(--qr-accent))" }}>Confirm order</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {/* Order summary card */}
        <div className="qr-glass rounded-[1.5rem] p-4" style={cardStyle}>
          <button
            onClick={() => setCartExpanded((v) => !v)}
            className="w-full flex items-end justify-between"
          >
            <span className="text-left">
              <span className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--qr-ink-faint))" }}>Order summary</span>
              <span className="block text-[14px] mt-1" style={{ color: "rgb(var(--qr-ink-soft))" }}>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            </span>
            <span className="text-[12px] font-bold uppercase tracking-wide underline" style={{ color: "rgb(var(--qr-accent))" }}>
              {cartExpanded ? "Hide" : "Edit"}
            </span>
          </button>

          {cartExpanded && (
            <div className="mt-4 space-y-2.5 anim-fade-in">
              {items.map((item) => (
                <div key={item.menuItemId} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: "rgb(var(--qr-ink))" }}>{item.name}</p>
                    <p className="text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>
                      PKR {Math.floor(item.price / 100).toLocaleString("en-PK")} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full px-1 py-1 shrink-0" style={{ background: "rgb(var(--qr-accent-soft))" }}>
                    <button
                      onClick={() => onUpdateQty(item.menuItemId, item.quantity - 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: "rgb(var(--qr-card))", color: "rgb(var(--qr-accent))" }}
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-[13px] font-bold" style={{ color: "rgb(var(--qr-accent))" }}>{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.menuItemId, item.quantity + 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ background: "rgb(var(--qr-accent))" }}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[13.5px] font-semibold w-16 text-right tnum shrink-0" style={{ color: "rgb(var(--qr-ink))" }}>
                    PKR {Math.floor((item.price * item.quantity) / 100).toLocaleString("en-PK")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="h-px my-3.5" style={{ background: "rgb(var(--qr-line-soft))" }} />
          {taxAmount > 0 && (
            <div className="space-y-1.5 mb-3 text-[13px]" style={{ color: "rgb(var(--qr-ink-soft))" }}>
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="tnum">PKR {Math.floor(subtotal / 100).toLocaleString("en-PK")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>POS &amp; F&amp;B tax ({taxRate}%)</span>
                <span className="tnum">PKR {Math.floor(taxAmount / 100).toLocaleString("en-PK")}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="serif text-[18px]" style={{ color: "rgb(var(--qr-ink))" }}>Total</span>
            <span className="serif text-[22px] tnum" style={{ color: "rgb(var(--qr-accent))" }}>
              PKR {Math.floor(total / 100).toLocaleString("en-PK")}
            </span>
          </div>
        </div>

        <form id="order-form" onSubmit={handleSubmit} className="py-4 space-y-3.5">
          {/* ── Delivery card ── */}
          <div className="qr-glass rounded-[1.5rem] p-4 space-y-4" style={cardStyle}>
            <p className="text-[12px] font-semibold" style={{ color: "rgb(var(--qr-ink-faint))" }}>{hotelName}</p>

            {/* Delivery type — icon grid, matches the confirm-order mockup */}
            <div>
              <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>Delivery method</label>
              <div className="grid grid-cols-3 gap-2">
                {(["room_delivery", "pickup", "dine_in"] as DeliveryType[]).map((t) => {
                  const Icon = DELIVERY_ICONS[t];
                  const active = deliveryType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => selectDeliveryType(t)}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[12px] font-semibold transition-colors"
                      style={active
                        ? { background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" }
                        : { background: "rgb(var(--qr-card) / 0.6)", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                      {DELIVERY_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Room search appears only when a folio charge was explicitly chosen. */}
            {isRoomCharge && <div>
              <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>
                {deliveryType === "room_delivery" ? "Deliver to your room" : "Charge to your room"} <span style={{ color: "rgb(var(--qr-accent))" }}>*</span>
              </label>

              {/* Confirmed room chip */}
              {confirmedRoom ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgb(var(--qr-teal-soft))", border: "1px solid rgb(var(--qr-teal) / 0.2)" }}>
                  <BedDouble className="w-4 h-4 flex-shrink-0" style={{ color: "rgb(var(--qr-teal))" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold" style={{ color: "rgb(var(--qr-ink))" }}>{confirmedRoom.guestName}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--qr-ink-mute))" }}>Room {confirmedRoom.roomNumber}</p>
                  </div>
                  <button type="button" onClick={clearRoom} className="flex-shrink-0" style={{ color: "rgb(var(--qr-ink-faint))" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgb(var(--qr-ink-faint))" }} />
                    <input
                      className={`${inputCls} pl-9 pr-9`}
                      style={inputStyle}
                      placeholder="e.g. 101"
                      value={roomQuery}
                      onChange={(e) => handleRoomQueryChange(e.target.value)}
                    />
                    {verifying && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin pointer-events-none" style={{ color: "rgb(var(--qr-ink-faint))" }} />
                    )}
                  </div>

                  {/* Result card */}
                  {roomMatch && (
                    <button
                      type="button"
                      onClick={() => selectRoom(roomMatch)}
                      className="mt-1.5 w-full text-left rounded-xl px-4 py-3 transition-colors"
                      style={{ border: "1px solid rgb(var(--qr-line))", background: "rgb(var(--qr-teal-soft) / 0.4)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[13.5px]" style={{ color: "rgb(var(--qr-ink))" }}>{roomMatch.guestName}</span>
                        <span className="text-[12px] flex-shrink-0" style={{ color: "rgb(var(--qr-ink-faint))" }}>Room {roomMatch.roomNumber}</span>
                      </div>
                    </button>
                  )}

                  {noMatch && roomQuery.trim().length > 0 && !verifying && (
                    <p className="mt-1 text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>
                      No checked-in room found. Room charges are only available to checked-in guests.
                    </p>
                  )}
                </>
              )}
            </div>}

            {/* Payment follows the delivery method. There is no online payment:
                pay_now is collected by staff when the order is handed over. */}
            <div>
              {deliveryType === "room_delivery" ? <>
                <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>Payment</label>
                <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "rgb(var(--qr-accent-soft))", border: "1px solid rgb(var(--qr-accent) / 0.16)" }}>
                  <BedDouble className="w-4 h-4" style={{ color: "rgb(var(--qr-accent))" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--qr-ink))" }}>Charge to verified room</span>
                </div>
                <p className="mt-1.5 text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>Added to your room bill and settled at checkout.</p>
              </> : <>
                <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>Payment</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentPreference("pay_now")}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[12px] font-semibold transition-colors"
                    style={paymentPreference === "pay_now" ? { background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" } : { background: "rgb(var(--qr-card) / 0.6)", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}>
                    <Wallet className="w-4 h-4" />
                    {deliveryType === "pickup" ? "Pay on collection" : "Pay at table"}
                  </button>
                  <button type="button" onClick={() => setPaymentPreference("charge_to_room")}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[12px] font-semibold transition-colors"
                    style={isRoomCharge ? { background: "rgb(var(--qr-accent))", color: "#fff" } : { background: "rgb(var(--qr-card) / 0.6)", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}>
                    <BedDouble className="w-4 h-4" />
                    Charge to room
                  </button>
                </div>
                <p className="mt-1.5 text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>{isRoomCharge ? "Choose a verified room above; the charge will be added to its folio." : "A member of staff will collect payment when your order is ready."}</p>
              </>}
            </div>
          </div>

          {/* ── Contact card ── */}
          <div className="qr-glass rounded-[1.5rem] p-4 space-y-3.5" style={cardStyle}>
            <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))", marginBottom: 0 }}>Your details</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputCls}
                style={inputStyle}
                placeholder="Your name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
              <input
                className={inputCls}
                style={inputStyle}
                placeholder="03XX XXXXXXX *"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                type="tel"
                required
              />
            </div>
            <textarea
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder="Special instructions — allergies, preferences…"
              value={specialInstr}
              onChange={(e) => setSpecialInstr(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <p className="text-[13px] rounded-xl px-3.5 py-2.5" style={{ color: "rgb(var(--qr-accent))", background: "rgb(var(--qr-accent-soft))" }}>{error}</p>
          )}
        </form>
      </div>

      {/* Submit */}
      <div className="qr-glass px-4 py-4 safe-area-inset-bottom" style={{ borderTop: "1px solid rgb(var(--qr-line-soft))" }}>
        <button
          form="order-form"
          type="submit"
          disabled={loading}
          className="qr-golden-shadow w-full flex items-center justify-center gap-2 text-white rounded-full px-5 py-4 font-bold text-[15px] disabled:opacity-60 active:scale-[0.97] transition-transform"
          style={{ background: "rgb(var(--qr-accent))" }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {isRoomCharge && effectiveRoom
            ? `Charge Room ${effectiveRoom}`
            : deliveryType === "pickup" ? "Place pickup order" : deliveryType === "dine_in" ? "Place dine-in order" : "Place order"}{" "}
          · PKR {Math.floor(total / 100).toLocaleString("en-PK")}
        </button>
      </div>
    </div>
  );
}
