import type { BudgetCategory, BudgetEntry, BudgetItem } from "@/lib/types";
import { budgetPeriodForDate, shiftBudgetMonth } from "@/lib/budget-period";

export function entryBudgetPeriod(entry: BudgetEntry, categories: BudgetCategory[] = []) {
  if (entry.spentOn) return budgetPeriodForDate(entry.spentOn);
  // Legacy statements store the calendar month in which the period starts.
  const isStatement = categories.some(
    (category) => category.id === entry.categoryId && category.kind === "statement"
  );
  return isStatement ? shiftBudgetMonth(entry.month, 1) : entry.month;
}

function sumAmounts(items: { amount: number }[]) {
  return items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
}

export function selectBudgetEntries(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  filterId: string | null,
  query = "",
  sort: "date" | "amount" = "date"
) {
  const categoryEntries = filterId
    ? entries.filter((entry) => entry.categoryId === filterId)
    : entries;
  const term = query.trim().toLocaleLowerCase("tr-TR");
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const shown = categoryEntries.filter((entry) =>
    !term || `${entry.label} ${names.get(entry.categoryId) ?? ""}`.toLocaleLowerCase("tr-TR").includes(term)
  ).slice().sort((a, b) => {
    if (sort === "amount" && a.amount !== b.amount) return b.amount - a.amount;
    return (b.spentOn ?? "").localeCompare(a.spentOn ?? "") || b.id.localeCompare(a.id);
  });
  return {
    shown,
    total: sumAmounts(categoryEntries),
    count: categoryEntries.length,
    shownTotal: sumAmounts(shown),
  };
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
  const monthEntries = input.entries.filter(
    (entry) => entryBudgetPeriod(entry, input.categories) === input.month
  );
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
