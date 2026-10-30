export interface ChartPoint {
  time: string;
  price: number;
}

export interface SymbolData {
  symbol: string;
  price: number;
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

export type AccountRole = "owner" | "viewer";

export interface SavingEntry {
  month: string; // "YYYY-MM"
  amount: number;
}

export interface SavingsGoal {
  targetAmount: number;
  targetDate: string; // "YYYY-MM-DD"
}

export interface ViewerEntry {
  email: string;
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  validFrom: string;
  validTo: string | null;
}

export type BudgetCategoryKind = "custom" | "statement";

export interface BudgetCategory {
  id: string;
  name: string;
  kind: BudgetCategoryKind;
  validFrom: string | null;
  validTo: string | null;
}

export interface BudgetEntry {
  id: string;
  month: string;
  categoryId: string;
  label: string;
  amount: number;
  spentOn: string | null;
}

export interface BudgetSnapshot {
  incomes: BudgetItem[];
  fixedExpenses: BudgetItem[];
  categories: BudgetCategory[];
  entries: BudgetEntry[];
}
