import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Star, Loader2, UtensilsCrossed, CheckCircle2, Palmtree, Search, ArrowLeft, Clock, Sparkles,
  Coffee, Soup, Sandwich, GlassWater, Cookie, Salad, IceCreamCone, Plus,
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
          style={{ background: "linear-gradient(135deg, rgb(var(--qr-teal)), rgb(var(--qr-teal-deep)))", boxShadow: "0 16px 40px -8px rgb(var(--qr-teal) / 0.5)" }}
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
            className="w-full text-white rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, rgb(var(--qr-teal)), rgb(var(--qr-teal-deep)))", boxShadow: "0 10px 30px -6px rgb(var(--qr-teal) / 0.45)" }}
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

      {/* Header */}
      <div className="z-20 px-5 pt-7 pb-4 sticky top-0" style={{ background: "rgb(var(--qr-bg) / 1)", backdropFilter: "blur(10px)" }}>
        <div className="absolute inset-0 -z-10" style={{ background: "rgb(var(--qr-bg))", opacity: 0.92 }} />
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="serif text-[23px] text-[rgb(var(--qr-ink))] leading-tight">{hotelName}</h1>
          <button
            onClick={() => setView("track")}
            className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors"
            style={{ background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" }}
          >
            <Search className="w-3.5 h-3.5" />
            Track order
          </button>
        </div>
        <p className="text-[13px] text-[rgb(var(--qr-ink-faint))]">In-room dining, just for you</p>

        {/* Category tabs — icon chips, not plain text pills */}
        {visibleCategories.length > 1 && (
          <div className="flex gap-2.5 mt-4 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
            {visibleCategories.map((cat) => {
              const Icon = categoryIcon(cat.name);
              const active = cat.id === displayCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex-shrink-0 flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full text-[13px] font-bold transition-all"
                  style={active
                    ? { background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", color: "#fff", boxShadow: "0 8px 20px -6px rgb(var(--qr-accent) / 0.55)" }
                    : { background: "rgb(var(--qr-card))", color: "rgb(var(--qr-ink-soft))", border: "1px solid rgb(var(--qr-line))" }}
                >
                  <span
                    className="grid place-items-center h-6 w-6 rounded-full shrink-0"
                    style={active ? { background: "rgb(255 255 255 / 0.22)" } : { background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="relative z-10 px-4 pt-5 space-y-3.5">
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
                  className="anim-fade-up rounded-[1.75rem] overflow-hidden flex relative"
                  style={{
                    animationDelay: `${Math.min(idx, 6) * 35}ms`,
                    background: "rgb(var(--qr-card))",
                    boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.14)",
                    border: "1px solid rgb(var(--qr-line-soft))",
                  }}
                >
                  {item.isFeatured && (
                    <div
                      className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "rgb(var(--qr-gold-soft))", color: "rgb(var(--qr-gold))" }}
                    >
                      <Star className="w-2.5 h-2.5 fill-current" /> Chef's pick
                    </div>
                  )}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-28 h-32 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-20 h-32 flex-shrink-0 grid place-items-center"
                      style={{ background: "rgb(var(--qr-teal-soft))" }}
                    >
                      {(() => { const Icon = categoryIcon(currentCat.name); return <Icon className="w-7 h-7" style={{ color: "rgb(var(--qr-teal))" }} />; })()}
                    </div>
                  )}
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div className={item.isFeatured ? "pr-20" : ""}>
                      <p className="font-bold text-[rgb(var(--qr-ink))] text-[14.5px] leading-tight">{item.name}</p>
                      {item.description && (
                        <p className="text-[12.5px] text-[rgb(var(--qr-ink-faint))] mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[14.5px] font-bold tnum" style={{ color: "rgb(var(--qr-ink))" }}>
                        PKR {Math.floor(item.price / 100).toLocaleString("en-PK")}
                      </span>
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center gap-1 text-white rounded-xl pl-3 pr-3.5 py-1.5 text-[13px] font-bold active:scale-95 transition-transform"
                          style={{ background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", boxShadow: "0 6px 16px -4px rgb(var(--qr-accent) / 0.5)" }}
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
    <div className="qr-theme min-h-screen flex flex-col relative overflow-hidden" style={{ background: "rgb(var(--qr-bg))" }}>
      {/* Hero gradient — sunset-over-lagoon, the "vacation poster" moment */}
      <div
        className="relative px-6 pt-16 pb-24 overflow-hidden"
        style={{ background: "linear-gradient(155deg, rgb(var(--qr-hero-1)) 0%, rgb(var(--qr-hero-2)) 55%, rgb(var(--qr-hero-3)) 100%)" }}
      >
        <div className="absolute top-10 right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 left-0 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-20 left-10 w-3 h-3 rounded-full bg-white/40" />
        <div className="absolute top-32 right-20 w-2 h-2 rounded-full bg-white/50" />

        <div className="relative anim-fade-up text-center">
          <div className="mx-auto mb-6 grid place-items-center w-16 h-16 rounded-[22px] bg-white/15 backdrop-blur-sm border border-white/25">
            <Palmtree className="w-7 h-7 text-white" strokeWidth={1.7} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 mb-2">In-Room Dining</p>
          <h1 className="serif text-[32px] text-white leading-tight">
            {isLoading ? "Loading…" : hotelName || hotelSlug}
          </h1>
        </div>
      </div>

      {/* Floating sheet — overlaps the hero for that premium "card lift" feel */}
      <div className="flex-1 px-6 -mt-14 relative z-10">
        <div
          className="rounded-[2rem] p-6 anim-fade-up"
          style={{ animationDelay: "100ms", background: "rgb(var(--qr-card))", boxShadow: "0 24px 48px -16px rgb(41 26 18 / 0.25)" }}
        >
          <div className="flex items-center gap-1 mb-3 justify-center">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: "rgb(var(--qr-gold))" }} />)}
          </div>
          <p className="text-[14px] text-[rgb(var(--qr-ink-mute))] text-center mb-7">
            Fresh, comforting dishes — ordered from your room, delivered with a smile.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={onOrder}
              disabled={isLoading}
              className="w-full text-white rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))", boxShadow: "0 14px 32px -8px rgb(var(--qr-accent) / 0.5)" }}
            >
              View menu &amp; order
            </button>
            <button
              onClick={onTrack}
              className="w-full rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
              style={{ background: "rgb(var(--qr-teal-soft))", color: "rgb(var(--qr-teal))" }}
            >
              Track my order
            </button>
          </div>
        </div>

        <p className="text-center text-[12px] text-[rgb(var(--qr-ink-faint))] mt-6 pb-8">
          Available around the clock, just for guests
        </p>
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

const STEP_ICONS: Record<OrderStatus, string> = {
  pending:   "🧾",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready:     "🛎️",
  delivered: "🎉",
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
      <div className="z-10 px-5 pt-7 pb-4 sticky top-0" style={{ background: "rgb(var(--qr-bg))", opacity: 0.96 }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="grid place-items-center h-9 w-9 -ml-2 rounded-full transition-colors"
            style={{ color: "rgb(var(--qr-ink-mute))" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="serif text-[20px] text-[rgb(var(--qr-ink))]">Track order</h1>
          {isFetching && queried && (
            <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--qr-ink-faint))] ml-auto" />
          )}
        </div>
        <p className="text-[13px] text-[rgb(var(--qr-ink-faint))] pl-9">{hotelName || hotelSlug}</p>
      </div>

      <div className="relative z-10 flex-1 px-4 py-6 space-y-6">
        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-4 py-3 text-sm font-mono font-semibold uppercase tracking-wider focus:outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
            style={{ background: "rgb(var(--qr-card))", border: "1px solid rgb(var(--qr-line))", color: "rgb(var(--qr-ink))" }}
            placeholder="e.g. 0019 or ORD-0019"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="text-white rounded-xl px-5 py-3 font-bold text-sm active:scale-95 transition-transform flex-shrink-0"
            style={{ background: "linear-gradient(135deg, rgb(var(--qr-accent)), rgb(var(--qr-accent-deep)))" }}
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
            <div className="rounded-[1.75rem] p-5" style={{ background: "rgb(var(--qr-card))", boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.14)", border: "1px solid rgb(var(--qr-line-soft))" }}>
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
              <div className="rounded-[1.75rem] p-5 text-center" style={{ background: "rgb(var(--qr-accent-soft))" }}>
                <p className="text-2xl mb-2">❌</p>
                <p className="font-bold" style={{ color: "rgb(var(--qr-accent))" }}>Order cancelled</p>
                <p className="text-sm mt-1" style={{ color: "rgb(var(--qr-ink-soft))" }}>This order was cancelled. Please contact the front desk.</p>
              </div>
            ) : (
              <div className="rounded-[1.75rem] p-5" style={{ background: "rgb(var(--qr-card))", boxShadow: "0 10px 28px -10px rgb(41 26 18 / 0.14)", border: "1px solid rgb(var(--qr-line-soft))" }}>
                <div className="flex items-center gap-1.5 mb-5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "rgb(var(--qr-ink-faint))" }} />
                  <p className="text-[12px]" style={{ color: "rgb(var(--qr-ink-faint))" }}>Updates every 8 seconds</p>
                </div>
                <div className="space-y-0">
                  {STATUS_STEPS.map((step, i) => {
                    const done    = i < stepIndex;
                    const current = i === stepIndex;
                    const future  = i > stepIndex;
                    return (
                      <div key={step} className="flex gap-4">
                        {/* Line + dot column */}
                        <div className="flex flex-col items-center">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 transition-all duration-500"
                            style={
                              done    ? { background: "rgb(var(--qr-teal))", borderColor: "rgb(var(--qr-teal))" }
                              : current ? { background: "rgb(var(--qr-accent))", borderColor: "rgb(var(--qr-accent))", boxShadow: "0 0 0 4px rgb(var(--qr-accent-soft))" }
                              : { background: "rgb(var(--qr-card))", borderColor: "rgb(var(--qr-line))" }
                            }
                          >
                            {done ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <span className={future ? "opacity-30" : ""}>{STEP_ICONS[step]}</span>
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
