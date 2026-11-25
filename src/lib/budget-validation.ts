import { isValidDate, isValidMonth } from "./budget";
import type { BudgetCategory, BudgetEntry } from "@/types/budget";

export function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 100;
}

export function validCategory(value: BudgetCategory): boolean {
  return Boolean(value && validId(value.id) && typeof value.name === "string" && value.name.trim() && value.name.length <= 60);
}

export function validEntry(value: BudgetEntry): boolean {
  if (!value || !validId(value.id) || !["income", "expense"].includes(value.kind) ||
    typeof value.description !== "string" || !value.description.trim() || value.description.length > 160 ||
    !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0 ||
    typeof value.date !== "string" || !isValidDate(value.date) ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    (value.categoryId !== undefined && !validId(value.categoryId))) return false;
  const recurrence = value.recurrence;
  return recurrence === undefined || Boolean(recurrence && typeof recurrence.endMonth === "string" &&
    (!recurrence.endMonth || (isValidMonth(recurrence.endMonth) && recurrence.endMonth >= value.date.slice(0, 7))) &&
    Array.isArray(recurrence.excludedMonths) && recurrence.excludedMonths.every(month => typeof month === "string" && isValidMonth(month)));
}
