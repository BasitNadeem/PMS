import { ShoppingCart, ArrowRight } from "lucide-react";

export interface CartItem {
  menuItemId:  string;
  name:        string;
  price:       number; // paisas
  quantity:    number;
  specialNote: string;
}

interface CartBarProps {
  items:   CartItem[];
  taxRate: number;
  onClick: () => void;
}

export function CartBar({ items, taxRate, onClick }: CartBarProps) {
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal + Math.round(subtotal * taxRate / 100);

  if (count === 0) return null;

  return (
    <div className="qr-theme fixed bottom-0 left-0 right-0 z-40 p-4 safe-area-inset-bottom anim-fade-up">
      <button
        onClick={onClick}
        className="qr-golden-shadow w-full flex items-center justify-between text-white rounded-full pl-2 pr-3 py-2.5 active:scale-[0.97] transition-transform"
        style={{ background: "rgb(var(--qr-accent))" }}
      >
        <span className="flex items-center gap-3 font-semibold text-[14.5px]">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-white/15 relative">
            <ShoppingCart className="w-[18px] h-[18px]" />
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center"
              style={{ background: "#fff", color: "rgb(var(--qr-accent))" }}
            >
              {count}
            </span>
          </span>
          <span className="text-left">
            <span className="block text-[11px] text-white/70 font-medium leading-none mb-0.5">View cart</span>
            <span className="block font-bold text-[15px]">PKR {Math.floor(total / 100).toLocaleString("en-PK")}</span>
          </span>
        </span>
        <span className="grid place-items-center h-9 w-9 rounded-full bg-white/15">
          <ArrowRight className="w-4 h-4" />
        </span>
      </button>
    </div>
  );
}
