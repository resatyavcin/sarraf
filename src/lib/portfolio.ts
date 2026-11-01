import type { AssetKey, MarketData, Portfolio } from "@/lib/types";

export const ASSET_KEYS = ["gold", "usd", "eur"] as const satisfies readonly AssetKey[];

export function assetBuyPrice(key: AssetKey, market: MarketData | null) {
  if (!market) return null;
  return key === "gold" ? market.gold.gramBuy : market[key].price * 0.996;
}

export function portfolioValue(portfolio: Portfolio, market: MarketData | null) {
  if (!market) return null;
  return ASSET_KEYS.reduce((total, key) =>
    total + (portfolio[key].physical + portfolio[key].digital) * (assetBuyPrice(key, market) ?? 0), 0);
}

export function parseHoldingAmount(raw: string) {
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(raw.trim())) return null;
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000
    ? Math.round(value * 100) / 100 : null;
}
