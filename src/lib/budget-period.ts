/** Periods are named for their ending month: November is Oct 24–Nov 23. */
export function shiftBudgetMonth(month: string, offset: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

export function budgetPeriodForDate(date: string) {
  const month = date.slice(0, 7);
  return Number(date.slice(8, 10)) >= 24 ? shiftBudgetMonth(month, 1) : month;
}

export function budgetPeriodBounds(month: string) {
  return { min: `${shiftBudgetMonth(month, -1)}-24`, max: `${month}-23` };
}

export function budgetToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function currentBudgetPeriod(now = new Date()) {
  return budgetPeriodForDate(budgetToday(now));
}

export function last12BudgetPeriods(now = new Date()) {
  const current = currentBudgetPeriod(now);
  return Array.from({ length: 12 }, (_, index) => shiftBudgetMonth(current, index - 11));
}
