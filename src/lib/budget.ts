import type { BudgetBank, BudgetCategory, BudgetEntry, BudgetItem, BudgetStatement } from "@/lib/types";

export const BUDGET_BANKS = ["garanti", "hadi", "enpara", "garanti-2"] as const satisfies readonly BudgetBank[];

export function isBudgetBank(value: unknown): value is BudgetBank {
  return typeof value === "string" && (BUDGET_BANKS as readonly string[]).includes(value);
}

function sumAmounts(items: { amount: number }[]) {
  return items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
}

export function itemCoversMonth(item: BudgetItem, month: string) {
  if (item.validFrom > month) return false;
  if (item.validTo && item.validTo < month) return false;
  return true;
}

export function computeMonthBudget(input: {
  incomes: BudgetItem[];
  fixedExpenses: BudgetItem[];
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  statements: BudgetStatement[];
  month: string;
  savingsAmount: number;
}) {
  const monthEntries = input.entries.filter((entry) => entry.month === input.month);
  const income = sumAmounts(input.incomes.filter((item) => itemCoversMonth(item, input.month)));
  const fixed = sumAmounts(
    input.fixedExpenses.filter((item) => itemCoversMonth(item, input.month))
  );
  const statements = sumAmounts(
    input.statements.filter((item) => item.month === input.month)
  );
  const expenses = sumAmounts(monthEntries);
  const remaining = income - fixed - statements;
  const savings = Math.max(0, Number(input.savingsAmount) || 0);
  const spendable = remaining - savings;
  const left = spendable - expenses;

  return {
    income,
    fixed,
    statements,
    remaining,
    savings,
    spendable,
    expenses,
    left,
    monthEntries,
  };
}