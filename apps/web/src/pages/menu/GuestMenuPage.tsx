import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Star, Loader2, UtensilsCrossed, CheckCircle2, Leaf, Search, ArrowLeft, Clock, Sparkles,
  Coffee, Soup, Sandwich, GlassWater, Cookie, Salad, IceCreamCone, Plus,
  Receipt, ChefHat, BellRing, PartyPopper, XCircle,
} from "lucide-react";
import { qrMenuService, type MenuCategory, type MenuItem } from "../../services/qrMenu";
import { CartBar, type CartItem } from "../../components/menu/CartBar";
import { OrderConfirmSheet } from "../../components/menu/OrderConfirmSheet";

type View = "landing" | "menu" | "track";

// Decorative ambient color blobs reused on every screen so the whole
// experience feels like one continuous "resort" surface, never a flat sheet.
function AmbientBackdrop() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute -top-16 -right-24 w-72 h-72 rounded-full" style={{ background: "rgb(var(--qr-teal))", opacity: 0.08, filter: "blur(60px)" }} />
      <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full" style={{ background: "rgb(var(--qr-accent))", opacity: 0.07, filter: "blur(60px)" }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full" style={{ background: "rgb(var(--qr-gold))", opacity: 0.08, filter: "blur(70px)" }} />
    </div>
  );
}

// Lightweight keyword → icon mapping so categories read as a visual menu
// (coffee cup, bowl, sandwich…) instead of plain text pills.
function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (/breakfast|coffee/.test(n)) return Coffee;
  if (/soup|main|curry|course/.test(n)) return Soup;
  if (/lunch|sandwich|burger|snack/.test(n)) return Sandwich;
  if (/drink|beverage|juice|tea/.test(n)) return GlassWater;
  if (/dessert|sweet|ice cream/.test(n)) return IceCreamCone;
  if (/salad|healthy/.test(n)) return Salad;
  if (/bakery|bread/.test(n)) return Cookie;
  return UtensilsCrossed;
}

export default function GuestMenuPage() {
  const { hotelSlug } = useParams<{ hotelSlug: string }>();
  const [view,          setView]          = useState<View>("landing");
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [showSheet,     setShowSheet]     = useState(false);
  const [orderNumber,   setOrderNumber]   = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-menu", hotelSlug],
    queryFn:  () => qrMenuService.getPublicMenu(hotelSlug!),
    enabled:  !!hotelSlug,
    staleTime: 5 * 60 * 1000,
  });

  const categories: MenuCategory[] = data?.data ?? [];
  const hotelName = data?.hotel.name ?? "";

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItemId === item.id);
      if (idx >= 0) {
        return prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, specialNote: "" }];
    });
  }

  function updateQty(menuItemId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
    } else {
      setCart((prev) => prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
    }
  }

  function cartQty(itemId: string) {
    return cart.find((c) => c.menuItemId === itemId)?.quantity ?? 0;
  }

  function handleSuccess(num: string) {
    setOrderNumber(num);
    setCart([]);
    setShowSheet(false);
    setView("menu"); // stay on menu view so success screen shows above it
  }

  // Order success screen
  if (orderNumber) {
    return (
      <div className="qr-theme min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 text-center" style={{ background: "rgb(var(--qr-bg))" }}>
        <AmbientBackdrop />
        <div
          className="anim-scale-in grid place-items-center w-24 h-24 rounded-full mb-6 relative"
          style={{ background: "rgb(var(--qr-teal))", boxShadow: "0 16px 40px -8px rgb(var(--qr-teal) / 0.45)" }}
        >
          <CheckCircle2 className="w-11 h-11 text-white" strokeWidth={2} />
          <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-[rgb(var(--qr-gold))]" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--qr-teal))] mb-2 anim-fade-up">Order confirmed</p>
        <h1 className="serif text-[30px] text-[rgb(var(--qr-ink))] mb-1.5 anim-fade-up" style={{ animationDelay: "40ms" }}>You're all set!</h1>
        <p className="text-[rgb(var(--qr-ink-mute))] text-[14px] mb-2 anim-fade-up" style={{ animationDelay: "70ms" }}>Your order number is</p>
        <p className="serif text-[46px] text-[rgb(var(--qr-accent))] mb-8 tnum anim-fade-up" style={{ animationDelay: "110ms" }}>{orderNumber}</p>
        <div className="w-full max-w-xs space-y-2.5 anim-fade-up" style={{ animationDelay: "150ms" }}>
          <button
            onClick={() => { setView("track"); setOrderNumber(null); }}
            className="w-full text-white rounded-full py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
            style={{ background: "rgb(var(--qr-teal))", boxShadow: "0 10px 30px -6px rgb(var(--qr-teal) / 0.4)" }}
          >
            Track my order
          </button>
          <button
            onClick={() => { setOrderNumber(null); setView("menu"); }}
            className="w-full font-semibold text-[14px] py-2 text-[rgb(var(--qr-accent))]"
          >
            Order something else
          </button>
        </div>
      </div>
    );
  }

  // Landing screen
  if (view === "landing") {
    return (
      <LandingView
        hotelName={hotelName}
        hotelSlug={hotelSlug!}
        isLoading={isLoading}
        onOrder={() => setView("menu")}
        onTrack={() => setView("track")}
      />
    );
  }

  // Track order screen
  if (view === "track") {
    return (
      <TrackOrderView
        hotelSlug={hotelSlug!}
        hotelName={hotelName}
        onBack={() => setView("landing")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="qr-theme min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--qr-bg))" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[rgb(var(--qr-accent))]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="qr-theme min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "rgb(var(--qr-bg))" }}>
        <UtensilsCrossed className="w-12 h-12 text-[rgb(var(--qr-ink-faint))] mb-3" />
        <p className="text-[rgb(var(--qr-ink-mute))]">Menu not available right now.</p>
      </div>
    );
  }

  const visibleCategories = categories.filter((c) => c.items.length > 0);
  const displayCategory   = activeCategory ?? visibleCategories[0]?.id ?? null;
  const currentCat        = visibleCategories.find((c) => c.id === displayCategory) ?? visibleCategories[0];

  return (
    <div className="qr-theme min-h-screen relative pb-32" style={{ background: "rgb(var(--qr-bg))" }}>
      <AmbientBackdrop />

      {/* Top bar — slim, sticky: back · hotel name · track order. Mirrors the
          mockup's TopAppBar; everything below it scrolls normally. */}
      <div className="z-20 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-3 sticky top-0 qr-glass" style={{ borderBottom: "1px solid rgb(var(--qr-line-soft))" }}>
        <button
          onClick={() => setView("landing")}
          className="grid place-items-center h-9 w-9 rounded-full transition-colors"
          style={{ color: "rgb(var(--qr-ink-mute))" }}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <h1 className="serif italic text-[19px] leading-tight text-center truncate" style={{ color: "rgb(var(--qr-accent))" }}>{hotelName}</h1>
        <button
          onClick={() => setView("track")}
          className="grid place-items-center h-9 w-9 rounded-full transition-colors"
          style={{ color: "rgb(var(--qr-ink-mute))" }}
          aria-label="Track order"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Headline + category tabs — normal flow, not sticky */}
      <div className="px-5 pt-5 pb-1">
        <h2 className="serif text-[26px] leading-tight" style={{ color: "rgb(var(--qr-ink))" }}>Room Dining</h2>
        <p className="text-[13px] mt-1" style={{ color: "rgb(var(--qr-ink-mute))" }}>Savor exquisite flavors from the comfort of your suite.</p>

        {/* Category tabs — plain pills, soft sage fill for the active one */}
        {visibleCategories.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
            {visibleCategories.map((cat) => {
              const active = cat.id === displayCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-bold transition-all"
                  style={active
                    ? { background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" }
                    : { background: "transparent", color: "rgb(var(--qr-ink-mute))", border: "1px solid rgb(var(--qr-line))" }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="relative z-10 px-4 pt-4 space-y-3.5">
        {currentCat && (
          <>
            {currentCat.description && (
              <p className="text-[13px] text-[rgb(var(--qr-ink-mute))] px-1 -mt-1 mb-1">{currentCat.description}</p>
            )}
            {currentCat.items.map((item, idx) => {
              const qty = cartQty(item.id);
              return (
                <div
                  key={item.id}
                  className="qr-glass anim-fade-up rounded-[1.5rem] overflow-hidden flex relative"
                  style={{
                    animationDelay: `${Math.min(idx, 6) * 35}ms`,
                    boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.12)",
                    border: "1px solid rgb(var(--qr-line-soft))",
                  }}
                >
                  <div className="relative shrink-0">
                    {item.isFeatured && (
                      <div
                        className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold whitespace-nowrap"
                        style={{ background: "rgb(var(--qr-gold-soft))", color: "rgb(var(--qr-gold))" }}
                      >
                        <Star className="w-2.5 h-2.5 fill-current" /> Chef's pick
                      </div>
                    )}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-28 h-32 object-cover"
                      />
                    ) : (
                      <div
                        className="w-24 h-32 grid place-items-center"
                        style={{ background: "rgb(var(--qr-bg-deep))" }}
                      >
                        {(() => { const Icon = categoryIcon(currentCat.name); return <Icon className="w-6 h-6" style={{ color: "rgb(var(--qr-ink-faint))" }} />; })()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="serif text-[16px] leading-tight" style={{ color: "rgb(var(--qr-ink))" }}>{item.name}</p>
                        <span className="text-[13.5px] font-bold tnum shrink-0" style={{ color: "rgb(var(--qr-accent))" }}>
                          PKR {Math.floor(item.price / 100).toLocaleString("en-PK")}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[12.5px] mt-1 line-clamp-2 leading-snug" style={{ color: "rgb(var(--qr-ink-mute))" }}>{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-end mt-2">
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="qr-golden-shadow flex items-center gap-1 text-white rounded-full pl-3 pr-3.5 py-1.5 text-[13px] font-bold active:scale-95 transition-transform"
                          style={{ background: "rgb(var(--qr-accent))" }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2.5 rounded-full px-1 py-1" style={{ background: "rgb(var(--qr-accent-soft))" }}>
                          <button
                            onClick={() => updateQty(item.id, qty - 1)}
                            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm"
                            style={{ background: "rgb(var(--qr-card))", color: "rgb(var(--qr-accent))" }}
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-[13px] font-bold" style={{ color: "rgb(var(--qr-accent))" }}>{qty}</span>
                          <button
                            onClick={() => updateQty(item.id, qty + 1)}
                            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm text-white"
                            style={{ background: "rgb(var(--qr-accent))" }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {visibleCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UtensilsCrossed className="w-12 h-12 text-[rgb(var(--qr-ink-faint))] opacity-50 mb-3" />
            <p className="text-[rgb(var(--qr-ink-faint))]">No items available right now</p>
          </div>
        )}
      </div>

      {/* Floating cart bar */}
      <CartBar items={cart} onClick={() => setShowSheet(true)} />

      {/* Order confirmation bottom sheet */}
      {showSheet && (
        <OrderConfirmSheet
          hotelSlug={hotelSlug!}
          hotelName={hotelName}
          items={cart}
          onClose={() => setShowSheet(false)}
          onSuccess={handleSuccess}
          onUpdateQty={updateQty}
        />
      )}
    </div>
  );
}

// ── LandingView ───────────────────────────────────────────────────────────────

function LandingView({
  hotelName, hotelSlug, isLoading, onOrder, onTrack,
}: {
  hotelName:  string;
  hotelSlug:  string;
  isLoading:  boolean;
  onOrder:    () => void;
  onTrack:    () => void;
}) {
  return (
    <div className="qr-theme min-h-screen relative isolate overflow-hidden flex flex-col" style={{ background: "rgb(var(--qr-bg-deep))" }}>
      {/* Full-bleed golden-hour resort photo, softened with a linen-tinted gradient + grain.
          `isolate` on the root gives this -z-10 layer its own stacking context so it can't
          escape behind the page's body background instead of staying within this view. */}
      <div className="absolute inset-0 -z-10">
        <img src="/qr-menu/landing-hero.jpg" alt="" className="w-full h-full object-cover opacity-80 mix-blend-multiply" />
        {/* Normal (non-multiply) translucent veil — this is what actually lightens/washes
            out the photo into the hazy "golden hour" look, per the Linen & Terra spec. */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgb(var(--qr-hero-1) / 0.8) 0%, rgb(var(--qr-hero-2) / 0.6) 50%, rgb(var(--qr-hero-3) / 0.4) 100%)" }}
        />
        <div className="absolute inset-0 qr-texture" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-14">
        {/* Hero — wordmark over the photo */}
        <div className="anim-fade-up text-center mt-12">
          <Leaf className="w-7 h-7 mx-auto mb-4" style={{ color: "rgb(var(--qr-accent))" }} strokeWidth={1.6} />
          <h1 className="serif text-[40px] leading-[1.15]" style={{ color: "rgb(var(--qr-ink))" }}>
            {isLoading ? "Loading…" : hotelName || hotelSlug}
          </h1>
          <Star className="w-3.5 h-3.5 mx-auto mt-3" style={{ color: "rgb(var(--qr-accent))" }} />
        </div>

        {/* Soothing welcome line + actions */}
        <div className="anim-fade-up" style={{ animationDelay: "100ms" }}>
          <p
            className="text-center text-[15px] leading-relaxed mb-7 px-3 font-medium"
            style={{ color: "rgb(var(--qr-card))", textShadow: "0 1px 8px rgb(41 26 18 / 0.55), 0 1px 3px rgb(41 26 18 / 0.4)" }}
          >
            Settle in, breathe easy — a warm plate is just a tap away.
          </p>
          <div className="space-y-2.5 max-w-xs mx-auto">
            <button
              onClick={onOrder}
              disabled={isLoading}
              className="qr-golden-shadow w-full text-white rounded-full py-4 font-bold text-[15px] active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: "rgb(var(--qr-accent))" }}
            >
              View menu &amp; order
            </button>
            <button
              onClick={onTrack}
              className="qr-glass w-full rounded-full py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
              style={{ color: "rgb(var(--qr-accent-deep))", border: "1px solid rgb(var(--qr-line))" }}
            >
              Track my order
            </button>
          </div>
          <p
            className="text-center text-[12px] mt-6 font-medium"
            style={{ color: "rgb(var(--qr-card) / 0.85)", textShadow: "0 1px 6px rgb(41 26 18 / 0.5)" }}
          >
            Available around the clock, just for guests
          </p>
        </div>
      </div>
    </div>
  );
}

// ── TrackOrderView ────────────────────────────────────────────────────────────

const STATUS_STEPS = ["pending", "confirmed", "preparing", "ready", "delivered"] as const;
type OrderStatus   = (typeof STATUS_STEPS)[number];

const STEP_LABELS: Record<OrderStatus, string> = {
  pending:   "Order Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready:     "Ready for Delivery",
  delivered: "Delivered",
};

const STEP_ICONS: Record<OrderStatus, typeof Receipt> = {
  pending:   Receipt,
  confirmed: CheckCircle2,
  preparing: ChefHat,
  ready:     BellRing,
  delivered: PartyPopper,
};

const DELIVERY_LABELS: Record<string, string> = {
  room_delivery: "Room Delivery",
  pickup:        "Pick Up",
  dine_in:       "Dine In",
};

function TrackOrderView({
  hotelSlug, hotelName, onBack,
}: {
  hotelSlug: string;
  hotelName: string;
  onBack:    () => void;
}) {
  const [input,   setInput]   = useState("");
  const [queried, setQueried] = useState("");
  const [error,   setError]   = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey:  ["track-order", hotelSlug, queried],
    queryFn:   () => qrMenuService.trackOrder(hotelSlug, queried),
    enabled:   !!queried,
    staleTime: 0,
    retry:     false,
  });

  // Poll every 8 seconds when actively tracking
  useEffect(() => {
    if (!queried) return;
    intervalRef.current = setInterval(() => { refetch(); }, 8000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [queried, refetch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    // Strip "ORD-" prefix if present so "ORD-0019", "0019", and "19" all match
    const val = input.trim().toUpperCase().replace(/^ORD-?/, "");
    if (!val) { setError("Please enter an order number"); return; }
    setError("");
    setQueried(val);
  }

  const order      = data;
  const stepIndex  = order ? STATUS_STEPS.indexOf(order.status as OrderStatus) : -1;
  const isCancelled = order?.status === "cancelled";

  return (
    <div className="qr-theme min-h-screen flex flex-col relative" style={{ background: "rgb(var(--qr-bg))" }}>
      <AmbientBackdrop />
      {/* Header */}
      <div className="qr-glass z-10 px-5 pt-7 pb-4 sticky top-0" style={{ borderBottom: "1px solid rgb(var(--qr-line-soft))" }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="grid place-items-center h-9 w-9 -ml-2 rounded-full transition-colors"
            style={{ color: "rgb(var(--qr-ink-mute))" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="serif italic text-[20px]" style={{ color: "rgb(var(--qr-accent))" }}>Track order</h1>
          {isFetching && queried && (
            <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--qr-ink-faint))] ml-auto" />
          )}
        </div>
        <p className="text-[13px] text-[rgb(var(--qr-ink-faint))] pl-9">{hotelName || hotelSlug}</p>
      </div>

      <div className="relative z-10 flex-1 px-4 py-6 space-y-6">
        {/* Search form — input "pressed" into the linen surface */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-4 py-3 text-sm font-mono font-semibold uppercase tracking-wider focus:outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
            style={{ background: "rgb(var(--qr-bg-deep))", border: "none", color: "rgb(var(--qr-ink))", boxShadow: "inset 0 1px 3px rgb(41 26 18 / 0.08)" }}
            placeholder="e.g. 0019 or ORD-0019"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="qr-golden-shadow text-white rounded-xl px-5 py-3 font-bold text-sm active:scale-95 transition-transform flex-shrink-0"
            style={{ background: "rgb(var(--qr-accent))" }}
          >
            Track
          </button>
        </form>
        {error && <p className="text-sm -mt-3" style={{ color: "rgb(var(--qr-accent))" }}>{error}</p>}

        {/* Result */}
        {queried && !order && !isFetching && (
          <div className="text-center py-12" style={{ color: "rgb(var(--qr-ink-faint))" }}>
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold" style={{ color: "rgb(var(--qr-ink-mute))" }}>Order not found</p>
            <p className="text-sm mt-1">Double-check your order number</p>
          </div>
        )}

        {order && (
          <div className="space-y-5 anim-fade-up">
            {/* Order summary card */}
            <div className="qr-glass rounded-[1.5rem] p-5" style={{ boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.12)", border: "1px solid rgb(var(--qr-line-soft))" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "rgb(var(--qr-ink-faint))" }}>Order number</p>
                  <p className="serif text-[26px] tnum" style={{ color: "rgb(var(--qr-ink))" }}>{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "rgb(var(--qr-ink-faint))" }}>Type</p>
                  <p className="text-[13.5px] font-semibold" style={{ color: "rgb(var(--qr-ink-soft))" }}>
                    {DELIVERY_LABELS[order.deliveryType] ?? order.deliveryType}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="pt-3 space-y-1" style={{ borderTop: "1px solid rgb(var(--qr-line-soft))" }}>
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13.5px]" style={{ color: "rgb(var(--qr-ink-soft))" }}>
                    <span className="font-bold" style={{ color: "rgb(var(--qr-accent))" }}>×{item.quantity}</span>
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>

              {order.specialInstructions && (
                <p className="mt-3 text-[12.5px] rounded-xl px-3 py-2 italic" style={{ color: "rgb(var(--qr-ink-soft))", background: "rgb(var(--qr-gold-soft))" }}>
                  {order.specialInstructions}
                </p>
              )}
            </div>

            {/* Progress tracker */}
            {isCancelled ? (
              <div className="qr-glass rounded-[1.5rem] p-5 text-center" style={{ border: "1px solid rgb(var(--qr-line-soft))" }}>
                <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "rgb(var(--qr-accent))" }} />
                <p className="font-bold" style={{ color: "rgb(var(--qr-accent))" }}>Order cancelled</p>
                <p className="text-sm mt-1" style={{ color: "rgb(var(--qr-ink-soft))" }}>This order was cancelled. Please contact the front desk.</p>
              </div>
            ) : (
              <div className="qr-glass rounded-[1.5rem] p-5" style={{ boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.12)", border: "1px solid rgb(var(--qr-line-soft))" }}>
                <div className="flex items-center gap-1.5 mb-5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "rgb(var(--qr-ink-faint))" }} />
                  <p className="text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>Updates every 8 seconds</p>
                </div>
                <div className="space-y-0">
                  {STATUS_STEPS.map((step, i) => {
                    const done    = i < stepIndex;
                    const current = i === stepIndex;
                    const future  = i > stepIndex;
                    const Icon    = STEP_ICONS[step];
                    return (
                      <div key={step} className="flex gap-4">
                        {/* Line + dot column */}
                        <div className="flex flex-col items-center">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-500"
                            style={
                              done    ? { background: "rgb(var(--qr-teal))", borderColor: "rgb(var(--qr-teal))" }
                              : current ? { background: "rgb(var(--qr-accent))", borderColor: "rgb(var(--qr-accent))", boxShadow: "0 0 0 4px rgb(var(--qr-accent-soft))" }
                              : { background: "rgb(var(--qr-card))", borderColor: "rgb(var(--qr-line))" }
                            }
                          >
                            {done ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <Icon className="w-4 h-4" style={{ color: current ? "#fff" : "rgb(var(--qr-ink-faint))", opacity: future ? 0.5 : 1 }} />
                            )}
                          </div>
                          {i < STATUS_STEPS.length - 1 && (
                            <div className="w-0.5 h-8 mt-0.5 transition-colors duration-500" style={{ background: done ? "rgb(var(--qr-teal))" : "rgb(var(--qr-line-soft))" }} />
                          )}
                        </div>
                        {/* Label */}
                        <div className="pb-8 pt-1.5">
                          <p
                            className="text-[13.5px] font-semibold transition-colors"
                            style={{ color: current ? "rgb(var(--qr-accent))" : done ? "rgb(var(--qr-teal))" : "rgb(var(--qr-ink-faint))" }}
                          >
                            {STEP_LABELS[step]}
                          </p>
                          {current && (
                            <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--qr-ink-faint))" }}></p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
