"use client";

import { Minus, ArrowUpRight, ArrowDownRight, Gem, DollarSign, Euro, Plus, Wallet, ChevronRight } from "lucide-react";
import { SymbolData, AssetHolding } from "@/lib/types";

const fmt = (v: number | undefined, digits = 2) =>
  (v ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const CURRENCY_SPREAD = 0.008;
const GOLD_SPREAD = 0.012;

const currencyConfig = {
  dollar: {
    Icon: DollarSign,
    border: "border-emerald-200/50 dark:border-emerald-500/15",
    bg: "from-emerald-50 via-card to-green-50/30 dark:from-emerald-950/20 dark:via-card dark:to-green-950/10",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
    priceColor: "text-emerald-600 dark:text-emerald-400",
  },
  euro: {
    Icon: Euro,
    border: "border-indigo-200/50 dark:border-indigo-500/15",
    bg: "from-indigo-50 via-card to-violet-50/30 dark:from-indigo-950/20 dark:via-card dark:to-violet-950/10",
    iconBg: "bg-indigo-500/15",
    iconColor: "text-indigo-500",
    priceColor: "text-indigo-600 dark:text-indigo-400",
  },
} as const;

interface PriceCardProps {
  title: string;
  symbol: SymbolData;
  variant: keyof typeof currencyConfig;
  holding?: AssetHolding;
  onEdit?: () => void;
}

export function PriceCard({ title, symbol, variant, holding, onEdit }: PriceCardProps) {
  const isUp = (symbol.change ?? 0) > 0;
  const isDown = (symbol.change ?? 0) < 0;
  const Arrow = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const theme = currencyConfig[variant];
  const { Icon } = theme;

  const buy = Math.round(symbol.price * (1 - CURRENCY_SPREAD / 2) * 10000) / 10000;
  const sell = Math.round(symbol.price * (1 + CURRENCY_SPREAD / 2) * 10000) / 10000;
  const buyFark = Math.round(symbol.change * (1 - CURRENCY_SPREAD / 2) * 10000) / 10000;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.bg} p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${theme.iconBg}`}>
            <Icon className={`h-5 w-5 ${theme.iconColor}`} />
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <div
              className={`mt-0.5 flex items-center gap-0.5 text-xs font-medium ${
                isUp
                  ? "text-emerald-600"
                  : isDown
                    ? "text-red-500"
                    : "text-muted-foreground"
              }`}
            >
              <Arrow className="h-3 w-3" />
              {isUp ? "+" : ""}
              {symbol.changePercent ?? 0}%
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Alış
          </span>
          <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${theme.priceColor}`}>
            {fmt(buy, 4)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">₺</span>
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Satış
          </span>
          <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${theme.priceColor}`}>
            {fmt(sell, 4)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">₺</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          Fark: {isUp ? "+" : ""}{fmt(buyFark, 4)} ₺
        </span>
      </div>

      <HoldingFooter
        holding={holding}
        onEdit={onEdit}
        unitLabel={variant === "dollar" ? "$" : "€"}
        unitPrice={buy}
      />
    </div>
  );
}

interface GoldCardProps {
  title: string;
  gramBuy: number;
  gramSell: number;
  change: number;
  changePercent: number;
  holding?: AssetHolding;
  onEdit?: () => void;
}

export function GoldCard({ title, gramBuy, gramSell, change, changePercent, holding, onEdit }: GoldCardProps) {
  const isUp = (change ?? 0) > 0;
  const isDown = (change ?? 0) < 0;
  const Arrow = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const buyFark = Math.round(change * (1 - GOLD_SPREAD / 2) * 100) / 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 via-card to-yellow-50/30 p-6 dark:border-amber-500/15 dark:from-amber-950/20 dark:via-card dark:to-yellow-950/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
            <Gem className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <div
              className={`mt-0.5 flex items-center gap-0.5 text-xs font-medium ${
                isUp
                  ? "text-emerald-600"
                  : isDown
                    ? "text-red-500"
                    : "text-muted-foreground"
              }`}
            >
              <Arrow className="h-3 w-3" />
              {isUp ? "+" : ""}
              {changePercent ?? 0}%
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Alış
          </span>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
            {fmt(gramBuy)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">₺</span>
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Satış
          </span>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
            {fmt(gramSell)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">₺</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          Fark: {isUp ? "+" : ""}{fmt(buyFark)} ₺
        </span>
      </div>

      <HoldingFooter
        holding={holding}
        onEdit={onEdit}
        unitLabel="gr"
        unitPrice={gramBuy}
      />
    </div>
  );
}

function HoldingFooter({
  holding,
  onEdit,
  unitLabel,
  unitPrice,
}: {
  holding?: AssetHolding;
  onEdit?: () => void;
  unitLabel: string;
  unitPrice: number;
}) {
  if (!onEdit) return null;

  const total = (holding?.physical ?? 0) + (holding?.digital ?? 0);
  const value = total * unitPrice;
  const hasHoldings = total > 0;

  return (
    <button
      onClick={onEdit}
      className="mt-4 flex w-full items-center justify-between border-t border-foreground/5 pt-3 text-left transition-colors"
    >
      {hasHoldings ? (
        <>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span>
                {holding!.physical > 0 && `${fmt(holding!.physical)} ${unitLabel} fiziksel`}
                {holding!.physical > 0 && holding!.digital > 0 && " · "}
                {holding!.digital > 0 && `${fmt(holding!.digital)} ${unitLabel} dijital`}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              ≈ {fmt(value)} ₺
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span>Varlık Ekle</span>
        </div>
      )}
    </button>
  );
}
