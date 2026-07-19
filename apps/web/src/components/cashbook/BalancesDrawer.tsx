import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Wallet, Landmark, Smartphone, Coins, CircleDollarSign,
  ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, CalendarDays,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { cashbookService } from "@/services/cashbook";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { DatePicker } from "@/components/ui/DatePicker";

const DEFAULT_WIDTH = 480;
const MIN_WIDTH     = 360;
const MAX_WIDTH     = 820;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPKR(paisas: number) {
  const sign = paisas < 0 ? "−" : "";
  return `${sign}PKR ${Math.floor(Math.abs(paisas) / 100).toLocaleString("en-PK")}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(iso + "T00:00:00"));
}

type AccountMeta = {
  label:     string;
  Icon:      LucideIcon;
  bg:        string;
  iconCls:   string;
  accentIn:  string;
  accentOut: string;
};

const ACCOUNT_META: Record<string, AccountMeta> = {
  CASH_DRAWER:  { label: "Cash Drawer",  Icon: Wallet,           bg: "bg-pine-soft",   iconCls: "text-pine-deep",  accentIn: "text-pine-deep", accentOut: "text-clay" },
  BANK_ACCOUNT: { label: "Bank Account", Icon: Landmark,         bg: "bg-[#EAF0FB]",   iconCls: "text-[#3A6BC4]",  accentIn: "text-pine-deep", accentOut: "text-clay" },
  JAZZCASH:     { label: "JazzCash",     Icon: Smartphone,       bg: "bg-[#FEF0E7]",   iconCls: "text-[#C7521A]",  accentIn: "text-pine-deep", accentOut: "text-clay" },
  EASYPAISA:    { label: "Easypaisa",    Icon: Smartphone,       bg: "bg-[#E6F7EE]",   iconCls: "text-[#1A7A45]",  accentIn: "text-pine-deep", accentOut: "text-clay" },
  PETTY_CASH:   { label: "Petty Cash",   Icon: Coins,            bg: "bg-amber-soft",  iconCls: "text-amber",      accentIn: "text-pine-deep", accentOut: "text-clay" },
  OTHER:        { label: "Other",        Icon: CircleDollarSign, bg: "bg-mist",        iconCls: "text-ink-mute",   accentIn: "text-pine-deep", accentOut: "text-clay" },
};

export interface BalancesDrawerProps {
  onClose: () => void;
}

export function BalancesDrawer({ onClose }: BalancesDrawerProps) {
  useEscapeKey(onClose);
  const [asOf,    setAsOf]    = useState(todayIso());
  const [width,   setWidth]   = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartX     = useRef(0);
  const dragStartWidth = useRef(0);

  const isToday = asOf === todayIso();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["cashbook", "balances", asOf],
    queryFn:  () => cashbookService.getBalances({ asOf }),
    staleTime: 30_000,
  });

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalIn      = accounts.reduce((sum, a) => sum + a.totalIn, 0);
  const totalOut     = accounts.reduce((sum, a) => sum + a.totalOut, 0);
  const netPositive  = totalBalance >= 0;

  const onMouseMove = useCallback((e: MouseEvent) => {
    const delta   = dragStartX.current - e.clientX;
    const newWidth = Math.min(Math.max(dragStartWidth.current + delta, MIN_WIDTH), MAX_WIDTH);
    setWidth(newWidth);
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor    = "";
    document.body.style.userSelect = "";
  }, [onMouseMove]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current     = e.clientX;
    dragStartWidth.current = width;
    setIsDragging(true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor     = "ew-resize";
    document.body.style.userSelect = "none";
  }, [width, onMouseMove, onMouseUp]);

  // clean up if the component unmounts mid-drag
  useEffect(() => () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
  }, [onMouseMove, onMouseUp]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[3px] anim-fade-in"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="relative bg-paper h-full flex flex-col shadow-2xl anim-slide-in"
        style={{ width, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
      >
        {/* Drag handle — left edge */}
        <div
          onMouseDown={onDragStart}
          className={cn(
            "absolute left-0 top-0 h-full w-5 flex items-center justify-center z-10 cursor-ew-resize group transition-colors",
            isDragging ? "bg-line-soft/80" : "hover:bg-line-soft/60",
          )}
          title="Drag to resize"
        >
          <GripVertical
            size={14}
            className={cn(
              "transition-colors",
              isDragging ? "text-ink-mute" : "text-line group-hover:text-ink-faint",
            )}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between pl-8 pr-6 pt-6 pb-4 border-b border-line flex-shrink-0">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-coral mb-1.5">Finance</div>
            <h2 className="serif text-[24px] text-ink leading-tight">Account Balances</h2>
            <p className="mt-1 text-[13px] text-ink-mute">Balance per payment method</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors mt-0.5 shrink-0"
          >
            <X size={17} />
          </button>
        </div>

        {/* Date picker */}
        <div className="pl-8 pr-6 py-4 border-b border-line flex-shrink-0">
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-2">
            <CalendarDays size={12} /> As of date
          </label>
          <div className="flex items-center gap-2">
            <DatePicker
              value={asOf}
              max={todayIso()}
              onChange={setAsOf}
              className="flex-1 h-9"
            />
            {!isToday && (
              <button
                onClick={() => setAsOf(todayIso())}
                className="h-9 px-3.5 rounded-xl border border-line text-[12px] text-ink-mute hover:bg-mist transition-colors whitespace-nowrap"
              >
                Today
              </button>
            )}
          </div>
          {!isToday && (
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Showing balances as of {fmtDate(asOf)}
            </p>
          )}
        </div>

        {/* Account cards */}
        <div className="flex-1 overflow-y-auto scroll-area pl-8 pr-6 py-5 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[120px] rounded-xl bg-mist animate-pulse" />
            ))
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2 text-center">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-mist text-ink-faint mb-1">
                <Wallet size={22} />
              </div>
              <p className="text-[14px] font-semibold text-ink-soft">No accounts yet</p>
              <p className="text-[13px] text-ink-mute max-w-[260px]">
                Balances appear here once payments or expenses are recorded.
              </p>
            </div>
          ) : (
            accounts.map((account) => {
              const meta = ACCOUNT_META[account.accountType] ?? ACCOUNT_META.OTHER;
              const { Icon } = meta;
              const pct = account.totalIn > 0
                ? Math.round((account.totalOut / account.totalIn) * 100)
                : 0;

              return (
                <div key={account.id} className="rounded-xl border border-line bg-card p-5 space-y-4">
                  {/* Account name + icon */}
                  <div className="flex items-center gap-3">
                    <div className={cn("grid place-items-center h-9 w-9 rounded-lg shrink-0", meta.bg)}>
                      <Icon size={16} className={meta.iconCls} />
                    </div>
                    <span className="text-[14px] font-bold text-ink">{meta.label}</span>
                  </div>

                  {/* Balance */}
                  <div className={cn(
                    "serif text-[26px] tnum leading-none",
                    account.balance >= 0 ? "text-ink" : "text-clay",
                  )}>
                    {formatPKR(account.balance)}
                  </div>

                  {/* In / Out row */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-pine-soft/50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowDownLeft size={11} className="text-pine-deep" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wide text-pine-deep">In</span>
                      </div>
                      <span className="text-[13px] font-semibold tnum text-pine-deep">
                        {formatPKR(account.totalIn)}
                      </span>
                    </div>
                    <div className="flex-1 bg-clay-soft/50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowUpRight size={11} className="text-clay" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wide text-clay">Out</span>
                      </div>
                      <span className="text-[13px] font-semibold tnum text-clay">
                        {formatPKR(account.totalOut)}
                      </span>
                    </div>
                  </div>

                  {/* Spend ratio bar */}
                  {account.totalIn > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-ink-faint">Utilisation</span>
                        <span className="text-[11px] font-semibold text-ink-mute tnum">{pct}% spent</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-mist overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", pct > 90 ? "bg-clay" : "bg-pine")}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Total footer */}
        {accounts.length > 0 && (
          <div className="flex-shrink-0 border-t border-line pl-8 pr-6 py-5 bg-mist/60">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {netPositive
                  ? <TrendingUp   size={13} className="text-pine-deep" />
                  : <TrendingDown size={13} className="text-clay" />}
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                  Total · all accounts
                </span>
              </div>
              <span className="text-[11px] text-ink-faint tnum">
                {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className={cn(
              "serif text-[30px] tnum leading-none mb-4",
              netPositive ? "text-ink" : "text-clay",
            )}>
              {formatPKR(totalBalance)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-pine-soft/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowDownLeft size={11} className="text-pine-deep" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-pine-deep">Total In</span>
                </div>
                <span className="text-[14px] font-bold tnum text-pine-deep">{formatPKR(totalIn)}</span>
              </div>
              <div className="bg-clay-soft/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpRight size={11} className="text-clay" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-clay">Total Out</span>
                </div>
                <span className="text-[14px] font-bold tnum text-clay">{formatPKR(totalOut)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
