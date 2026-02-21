export interface TimeSeriesValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface ChartPoint {
  time: string;
  price: number;
}

export interface SymbolData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timeSeries: ChartPoint[];
  lastUpdated: string;
}

export interface GoldData extends SymbolData {
  gramBuy: number;
  gramSell: number;
}

export interface MarketData {
  gold: GoldData;
  usd: SymbolData;
  eur: SymbolData;
  timestamp: number;
}

export interface CachedMarketData {
  data: MarketData;
  timestamp: number;
}

export type ChartPeriod = "1d" | "7d" | "30d";

export interface AssetHolding {
  physical: number;
  digital: number;
}

export interface Portfolio {
  gold: AssetHolding;
  usd: AssetHolding;
  eur: AssetHolding;
}

export type AssetKey = keyof Portfolio;
