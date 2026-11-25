import type { BudgetCategory, BudgetEntry } from "@/types/budget";

const normalize = (name: string) => name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
export function isCardStatementCategory(name: string) {
  return ["kart ekstresi", "enpara", "garanti", "garanti 2", "garanti-2", "hadi"].includes(normalize(name));
}

// Keep existing row IDs and labels intact; expose one category for all banks.
export function groupCardStatements(categories: BudgetCategory[], entries: BudgetEntry[]) {
  const bankCategories = categories.filter(category => isCardStatementCategory(category.name));
  const representative = bankCategories.find(category => normalize(category.name) === "kart ekstresi") ?? bankCategories[0];
  if (!representative) return { categories, entries };
  const ids = new Set(bankCategories.map(category => category.id));
  return {
    categories: categories.filter(category => !ids.has(category.id)).concat({ id: representative.id, name: "Kart Ekstresi", locked: true }),
    entries: entries.map(entry => entry.categoryId && ids.has(entry.categoryId) ? { ...entry, categoryId: representative.id } : entry),
  };
}
