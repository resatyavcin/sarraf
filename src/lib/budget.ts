import type { BudgetCategory, BudgetEntry } from "@/types/budget"

export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ""] = normalized.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function budgetTotals(entries: BudgetEntry[]) {
  const income = entries.filter((entry) => entry.kind === "income").reduce((total, entry) => total + entry.amountCents, 0)
  const expense = entries.filter((entry) => entry.kind === "expense").reduce((total, entry) => total + entry.amountCents, 0)
  return { income, expense, balance: income - expense }
}

export const formatMoney = (cents: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(cents === 0 ? 0 : cents / 100)

export function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && isValidDate(`${value}-01`)
}

export function shiftBudgetMonth(month: string, offset: number): string {
  if (!isValidMonth(month)) return ""
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export function budgetPeriodForDate(date: string): string {
  if (!isValidDate(date)) return ""
  const month = date.slice(0, 7)
  return Number(date.slice(8, 10)) > 24 ? shiftBudgetMonth(month, 1) : month
}

export function budgetPeriodBounds(month: string) {
  return { min: `${shiftBudgetMonth(month, -1)}-25`, max: `${month}-24` }
}

export function entriesForMonth(entries: BudgetEntry[], month: string, currentMonth: string): BudgetEntry[] {
  if (!isValidMonth(month)) return []
  return entries.flatMap((entry) => {
    if (!entry.recurrence) return budgetPeriodForDate(entry.date) === month ? [entry] : []
    if (month > currentMonth || month < entry.date.slice(0, 7) || (entry.recurrence.endMonth && month > entry.recurrence.endMonth) || entry.recurrence.excludedMonths.includes(month)) return []
    return [{ ...entry, date: `${month}-01` }]
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function removeMonthEntries(entries: BudgetEntry[], ids: string[], month: string): BudgetEntry[] {
  return entries.flatMap((entry) => {
    if (!ids.includes(entry.id)) return [entry]
    if (entry.recurrence || budgetPeriodForDate(entry.date) !== month) return [entry]
    return []
  })
}

export function selectBudgetEntries(entries: BudgetEntry[], categories: BudgetCategory[], query: string, categoryId: string, sort: "date" | "amount") {
  const term = query.trim().toLocaleLowerCase("tr-TR")
  const names = new Map(categories.map((category) => [category.id, category.name]))
  return entries.filter((entry) => (!categoryId || entry.categoryId === categoryId) && (!term || `${entry.description} ${names.get(entry.categoryId ?? "") ?? ""}`.toLocaleLowerCase("tr-TR").includes(term)))
    .sort((a, b) => (sort === "amount" ? b.amountCents - a.amountCents : b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt))
}

export function monthBreakdown(entries: BudgetEntry[], savings: number, statementCategoryIds: string[] = []) {
  const totals = budgetTotals(entries)
  const fixed = entries.filter((entry) => entry.kind === "expense" && entry.recurrence).reduce((sum, entry) => sum + entry.amountCents, 0)
  const statements = entries.filter(entry => entry.kind === "expense" && !entry.recurrence && statementCategoryIds.includes(entry.categoryId ?? "")).reduce((sum, entry) => sum + entry.amountCents, 0)
  return { ...totals, fixed, statements, other: totals.expense - fixed - statements, savings, spendable: totals.income - fixed - statements - savings, left: totals.balance - savings }
}

export function upsertBudgetEntry(entries: BudgetEntry[], entry: BudgetEntry): BudgetEntry[] {
  return [entry, ...entries.filter((item) => item.id !== entry.id) ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}


export function paginateBudgetEntries(entries: BudgetEntry[], requestedPage: number) {
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize))
  const page = Math.max(1, Math.min(totalPages, Math.floor(requestedPage) || 1))
  const offset = (page - 1) * pageSize
  return { items: entries.slice(offset, offset + pageSize), page, totalPages, start: entries.length ? offset + 1 : 0, end: Math.min(offset + pageSize, entries.length) }
}

export function savingsComparison(savings: Record<string, number>, month: string) {
  const history = Object.entries(savings)
    .filter(([key, amount]) => isValidMonth(key) && key < month && Number.isSafeInteger(amount) && amount >= 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, amount]) => ({ month, amount }))
  // Divide first to keep the average within the integer precision of cents.
  const average = history.length ? Math.round(history.reduce((sum, item) => sum + item.amount / history.length, 0)) : null
  const hasCurrent = Object.hasOwn(savings, month)
  const percent = hasCurrent && average !== null && average > 0 ? Math.round(savings[month] / average * 100) : null
  return { history, average, percent, progress: percent === null ? 0 : Math.max(0, Math.min(100, percent)) }
}
