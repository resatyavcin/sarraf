import type { BudgetCategory, BudgetEntry, BudgetItem } from "@/lib/types";

function sumAmounts(items: { amount: number }[]) {
  return items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
}

export function itemCoversMonth(item: BudgetItem, month: string) {
  if (item.validFrom > month) return false;
  if (item.validTo && item.validTo < month) return false;
  return true;
}

export function categoryCoversMonth(category: BudgetCategory, month: string) {
  if (category.kind !== "statement") return true;
  if (!category.validFrom || category.validFrom > month) return false;
  if (category.validTo && category.validTo < month) return false;
  return true;
}

export function computeMonthBudget(input: {
  incomes: BudgetItem[];
  fixedExpenses: BudgetItem[];
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  month: string;
  savingsAmount: number;
}) {
  const monthEntries = input.entries.filter((entry) => entry.month === input.month);
  const income = sumAmounts(input.incomes.filter((item) => itemCoversMonth(item, input.month)));
  const fixed = sumAmounts(
    input.fixedExpenses.filter((item) => itemCoversMonth(item, input.month))
  );
  const expenses = sumAmounts(monthEntries);
  const remaining = income - fixed;
  const savings = Math.max(0, Number(input.savingsAmount) || 0);
  const spendable = remaining - savings;
  const left = spendable - expenses;

  return {
    income,
    fixed,
    remaining,
    savings,
    spendable,
    expenses,
    left,
    monthEntries,
  };
}
