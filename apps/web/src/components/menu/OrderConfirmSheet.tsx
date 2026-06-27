import { useState, useEffect, useRef } from "react";
import { ArrowLeft, X, Loader2, CheckCircle2, Search, BedDouble, Wallet } from "lucide-react";
import type { CartItem } from "./CartBar";
import { qrMenuService } from "../../services/qrMenu";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface OrderConfirmSheetProps {
  hotelSlug:   string;
  hotelName:   string;
  items:       CartItem[];
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

const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none transition-colors";
const inputStyle = { background: "rgb(var(--qr-bg))", border: "1px solid rgb(var(--qr-line))", color: "rgb(var(--qr-ink))" };
const sectionLabelCls = "text-[11px] font-bold uppercase tracking-wide mb-2 block";
const cardStyle = { background: "rgb(var(--qr-card))", border: "1px solid rgb(var(--qr-line-soft))", boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.12)" };

export function OrderConfirmSheet({
  hotelSlug,
  hotelName,
  items,
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
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

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
    setGuestName("");
    setGuestPhone("");
    setPaymentPreference("charge_to_room");
    setNoMatch(false);
  }

  // Effective room number to submit — prefer confirmed match, fall back to raw query
  const effectiveRoom = confirmedRoom?.roomNumber ?? roomQuery.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
      <div className="flex items-center gap-2 px-3 py-3.5" style={{ background: "rgb(var(--qr-card))", borderBottom: "1px solid rgb(var(--qr-line))" }}>
        <button
          onClick={onClose}
          className="grid place-items-center h-9 w-9 rounded-full transition-colors shrink-0"
          style={{ color: "rgb(var(--qr-ink-mute))" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="serif text-[18px]" style={{ color: "rgb(var(--qr-ink))" }}>Confirm order</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Cart summary — compact receipt, expandable for line-by-line edits */}
        <div style={{ background: "rgb(var(--qr-card))", borderBottom: "1px solid rgb(var(--qr-line))" }}>
          <button
            onClick={() => setCartExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5"
          >
            <span className="text-[13.5px] font-semibold" style={{ color: "rgb(var(--qr-ink-soft))" }}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
              <span className="font-semibold ml-1.5" style={{ color: "rgb(var(--qr-accent))" }}>{cartExpanded ? "Hide" : "Edit"}</span>
            </span>
            <span className="font-bold text-[15px] tnum" style={{ color: "rgb(var(--qr-ink))" }}>
              PKR {Math.floor(total / 100).toLocaleString("en-PK")}
            </span>
          </button>

          {cartExpanded && (
            <div className="px-4 pb-4 space-y-2.5 anim-fade-in">
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
        </div>

        <form id="order-form" onSubmit={handleSubmit} className="px-4 py-4 space-y-3.5">
          {/* ── Delivery card ── */}
          <div className="rounded-[1.5rem] p-4 space-y-4" style={cardStyle}>
            <p className="text-[12px] font-semibold" style={{ color: "rgb(var(--qr-ink-faint))" }}>{hotelName}</p>

            {/* Delivery type */}
            <div>
              <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>Delivery type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["room_delivery", "pickup", "dine_in"] as DeliveryType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDeliveryType(t)}
                    className="py-2.5 px-2 rounded-xl text-[12.5px] font-semibold transition-colors"
                    style={deliveryType === t
                      ? { background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", color: "#fff" }
                      : { background: "rgb(var(--qr-bg))", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}
                  >
                    {DELIVERY_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Room number with live reservation search ── */}
            <div>
              <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>
                Room number <span style={{ color: "rgb(var(--qr-accent))" }}>*</span>
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
                      required={!confirmedRoom}
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
                      No active reservation found — you can still place an order
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Payment preference — only shown when a reservation is confirmed */}
            {confirmedRoom && (
              <div>
                <label className={sectionLabelCls} style={{ color: "rgb(var(--qr-ink-faint))" }}>How would you like to pay?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentPreference("charge_to_room")}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[13px] font-semibold transition-colors"
                    style={paymentPreference === "charge_to_room"
                      ? { background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", color: "#fff" }
                      : { background: "rgb(var(--qr-bg))", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}
                  >
                    <BedDouble className="w-4 h-4 flex-shrink-0" />
                    Pay at checkout
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentPreference("pay_now")}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[13px] font-semibold transition-colors"
                    style={paymentPreference === "pay_now"
                      ? { background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", color: "#fff" }
                      : { background: "rgb(var(--qr-bg))", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}
                  >
                    <Wallet className="w-4 h-4 flex-shrink-0" />
                    Pay on spot
                  </button>
                </div>
                {paymentPreference === "charge_to_room" && (
                  <p className="mt-1.5 text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>
                    Added to your room bill and settled at checkout.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Contact card ── */}
          <div className="rounded-[1.5rem] p-4 space-y-3.5" style={cardStyle}>
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
                placeholder="Phone number *"
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
      <div className="px-4 py-4 safe-area-inset-bottom" style={{ background: "rgb(var(--qr-card))", borderTop: "1px solid rgb(var(--qr-line))" }}>
        <button
          form="order-form"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 text-white rounded-2xl px-5 py-4 font-bold text-[15px] disabled:opacity-60 active:scale-[0.97] transition-transform"
          style={{ background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", boxShadow: "0 16px 36px -10px rgb(var(--qr-accent) / 0.55)" }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {confirmedRoom && paymentPreference === "charge_to_room"
            ? `Charge to Room ${confirmedRoom.roomNumber}`
            : "Place order"}{" "}
          · PKR {Math.floor(total / 100).toLocaleString("en-PK")}
        </button>
      </div>
    </div>
  );
}
