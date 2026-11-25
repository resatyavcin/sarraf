import type { BudgetEntry } from "@/types/budget";
import { validEntry } from "./budget-validation";

export type EntryRow = {
  id: string; label: string; amount: number | string;
  month: string; spent_on: string | null; created_at: string;
  category_id: string | null;
};
export type FixedRow = {
  id: string; name: string; amount: number | string; valid_from: string;
  valid_to: string | null; created_at: string;
};

export function amountToCents(amount: number | string): number {
  const value = Number(amount);
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents)) throw new Error("Geçersiz tutar.");
  return cents;
}

export function entryFromRow(row: EntryRow, isStatement = false): BudgetEntry {
  // Undated legacy statements use the opening month in storage, while the UI
  // names the statement for the month in which the period ends.
  const legacyStatement = isStatement && !row.spent_on;
  const [year, month] = row.month.slice(0, 7).split("-").map(Number);
  const displayMonth = legacyStatement ? new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7) : row.month.slice(0, 7);
  const entry: BudgetEntry = { id: row.id, kind: "expense", description: row.label, amountCents: amountToCents(row.amount),
    date: row.spent_on ?? (legacyStatement ? `${displayMonth}-01` : row.month), ...(legacyStatement ? { statementMonth: row.month.slice(0, 7) } : {}), createdAt: row.created_at,
    ...(row.category_id ? { categoryId: row.category_id } : {}) };
  if (!validEntry(entry)) throw new Error("Geçersiz bütçe kaydı.");
  return entry;
}

export function fixedFromRow(row: FixedRow, kind: BudgetEntry["kind"], categoryId: string | undefined = row.valid_from === row.valid_to && kind === "income" ? "__income__" : undefined): BudgetEntry {
  const entry: BudgetEntry = { id: `${kind}:${row.id}`, kind, ...(categoryId ? { categoryId } : {}), description: row.name, amountCents: amountToCents(row.amount),
    date: row.valid_from, createdAt: row.created_at, ...(kind === "income" && row.valid_from === row.valid_to ? {} : { recurrence: { endMonth: row.valid_to?.slice(0, 7) ?? "", excludedMonths: [] } }) };
  if (!validEntry(entry)) throw new Error("Geçersiz sabit işlem.");
  return entry;
}
