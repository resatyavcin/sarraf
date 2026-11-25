import assert from "node:assert/strict"
import { test } from "node:test"
import { parseAmount, budgetTotals, isValidDate, entriesForMonth, removeMonthEntries, selectBudgetEntries, monthBreakdown, upsertBudgetEntry, paginateBudgetEntries, savingsComparison, budgetPeriodForDate, budgetPeriodBounds } from "../src/lib/budget.ts"

test("accepts Turkish decimal amounts and rejects invalid or ambiguous amounts", () => {
  assert.equal(parseAmount(" 123,45 "), 12345)
  assert.equal(parseAmount("0.01"), 1)
  assert.equal(parseAmount("10"), 1000)
  for (const value of ["", "0", "-1", "1.234", "1.234,56", "1e3", "NaN", "12abc"]) assert.equal(parseAmount(value), null)
})

test("totals cents exactly and permits a negative balance", () => {
  assert.deepEqual(budgetTotals([]), { income: 0, expense: 0, balance: 0 })
  assert.deepEqual(budgetTotals([{ kind: "income", amountCents: 10 }, { kind: "income", amountCents: 20 }, { kind: "expense", amountCents: 50 }]), { income: 30, expense: 50, balance: -20 })
})

test("rejects impossible calendar dates", () => {
  assert.equal(isValidDate("2024-02-29"), true)
  for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "14/11/2026", ""]) assert.equal(isValidDate(value), false)
})

const recurring = { id: "rent", kind: "expense", description: "Kira", amountCents: 100000, date: "2026-10-01", createdAt: "2026-10-01T00:00:00Z", recurrence: { endMonth: "2027-01", excludedMonths: [] } }

test("recurring entries include both endpoints but never accrue in future months", () => {
  assert.equal(entriesForMonth([recurring], "2026-09", "2027-02").length, 0)
  assert.equal(entriesForMonth([recurring], "2026-10", "2026-10").length, 1)
  assert.equal(entriesForMonth([recurring], "2026-12", "2026-11").length, 0)
  assert.equal(entriesForMonth([recurring], "2027-01", "2027-01")[0].date, "2027-01-01")
  assert.equal(entriesForMonth([recurring], "2027-02", "2027-02").length, 0)
  assert.equal(entriesForMonth([recurring], "invalid", "2027-02").length, 0)
})

test("skipped months catch up once without duplication and combine with one-off entries", () => {
  const once = { ...recurring, id: "once", kind: "income", recurrence: undefined, date: "2026-11-10", amountCents: 150000 }
  const entries = [recurring, once]
  assert.deepEqual(budgetTotals(entriesForMonth(entries, "2026-11", "2027-01")), { income: 150000, expense: 100000, balance: 50000 })
  assert.equal(entriesForMonth(entries, "2026-12", "2027-01").length, 1)
  assert.equal(entriesForMonth(entries, "2026-12", "2027-01").length, 1)
  assert.equal(entriesForMonth(entries, "2027-01", "2027-01").length, 1)
})

test("deletion protects recurring entries and deletes only selected one-off entries", () => {
  const entries = removeMonthEntries([recurring], ["rent"], "2026-11")
  const reloaded = JSON.parse(JSON.stringify(entries))
  assert.equal(entriesForMonth(reloaded, "2026-11", "2026-12").length, 1)
  assert.equal(entriesForMonth(reloaded, "2026-10", "2026-12").length, 1)
  assert.equal(entriesForMonth(reloaded, "2026-12", "2026-12").length, 1)
  assert.equal(recurring.recurrence.excludedMonths.length, 0)
  const once = { ...recurring, id: "once", recurrence: undefined }
  assert.equal(removeMonthEntries([once], ["once"], "2026-10").length, 0)
})

test("open-ended fixed entries accrue up to the current month only", () => {
  const entry = { ...recurring, recurrence: { endMonth: "", excludedMonths: [] } }
  assert.equal(entriesForMonth([entry], "2028-01", "2028-01").length, 1)
  assert.equal(entriesForMonth([entry], "2028-02", "2028-01").length, 0)
})

test("category search respects Turkish casing and amount sorting leaves source untouched", () => {
  const categories = [{ id: "office", name: "İşletme" }]
  const entries = [{ ...recurring, id: "a", description: "Kira", categoryId: "office" }, { ...recurring, id: "b", description: "Malzeme", amountCents: 200000 }]
  assert.deepEqual(selectBudgetEntries(entries, categories, "işletme", "", "date").map((entry) => entry.id), ["a"])
  assert.deepEqual(selectBudgetEntries(entries, categories, "", "", "amount").map((entry) => entry.id), ["b", "a"])
  assert.deepEqual(selectBudgetEntries(entries, categories, "malzeme", "office", "date"), [])
  assert.deepEqual(entries.map((entry) => entry.id), ["a", "b"])
})

test("savings reduce spendable funds without becoming expenses or counting fixed costs twice", () => {
  const entries = [recurring, { ...recurring, id: "income", kind: "income", recurrence: undefined, amountCents: 500000 }, { ...recurring, id: "expense", recurrence: undefined, amountCents: 50000 }]
  const math = monthBreakdown(entries, 75000)
  assert.equal(math.fixed, 100000)
  assert.equal(math.other, 50000)
  assert.equal(math.expense, 150000)
  assert.equal(math.balance, 350000)
  assert.equal(math.spendable, 325000)
  assert.equal(math.left, 275000)
  assert.equal(monthBreakdown(entries, 600000).left, -250000)
})

test("transactions sharing a month and category remain independent; edits replace only their ID", () => {
  const first = { ...recurring, id: "first", categoryId: "card", recurrence: undefined }
  const second = { ...first, id: "second", amountCents: 20000 }
  const entries = upsertBudgetEntry([first], second)
  assert.equal(entries.length, 2)
  const updated = upsertBudgetEntry(entries, { ...second, amountCents: 30000, categoryId: undefined })
  assert.equal(updated.length, 2)
  assert.equal(updated.find((entry) => entry.id === "first").amountCents, first.amountCents)
  assert.equal(updated.find((entry) => entry.id === "second").amountCents, 30000)
  assert.equal(updated.find((entry) => entry.id === "second").categoryId, undefined)
  assert.equal(monthBreakdown(updated, 0).expense, first.amountCents + 30000)
})


test("transaction pages contain five records and clamp after removal or empty filtering", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ id: String(index) }))
  assert.deepEqual(paginateBudgetEntries(entries, 1).items.map(entry => entry.id), ["0", "1", "2", "3", "4"])
  assert.deepEqual(paginateBudgetEntries(entries, 2).items.map(entry => entry.id), ["5", "6", "7", "8", "9"])
  assert.equal(paginateBudgetEntries(entries, 3).items.length, 2)
  assert.equal(paginateBudgetEntries(entries.slice(0, 10), 3).page, 2)
  assert.equal(paginateBudgetEntries([], 5).page, 1)
  assert.equal(paginateBudgetEntries([], 5).start, 0)
  assert.equal(entries.length, 12)
})


test("savings comparison uses only earlier recorded months, including explicit zeros", () => {
  const result = savingsComparison({ "2026-06": 10000, "2026-08": 0, "2026-10": 20000, "2026-11": 15000, "2026-12": 999999 }, "2026-11")
  assert.equal(result.history.length, 3)
  assert.equal(result.average, 10000)
  assert.equal(result.percent, 150)
  assert.equal(result.progress, 100)
  assert.equal(result.history[0].month, "2026-10")
  assert.equal(savingsComparison({ "2026-10": 10000, "2026-11": 2500 }, "2026-11").progress, 25)
  assert.equal(savingsComparison({ "2026-10": 10000 }, "2026-11").percent, null)
  assert.equal(savingsComparison({ "2026-10": 10000, "2026-11": 0 }, "2026-11").percent, 0)
  assert.equal(savingsComparison({ "2026-10": 0, "2026-11": 10000 }, "2026-11").percent, null)
  assert.equal(savingsComparison({}, "2026-11").average, null)
})

test("monthly breakdown separates card statements from ordinary spending without double subtraction", () => {
  const base = { date: "2026-11-25", createdAt: "2026-11-25T12:00:00Z", description: "İşlem" }
  const entries = [
    { ...base, id: "income", kind: "income", amountCents: 200000 },
    { ...base, id: "fixed", kind: "expense", amountCents: 50000, recurrence: { endMonth: "", excludedMonths: [] } },
    { ...base, id: "card", kind: "expense", amountCents: 30000, categoryId: "statement" },
    { ...base, id: "normal", kind: "expense", amountCents: 20000, categoryId: "market" },
  ]
  const result = monthBreakdown(entries, 10000, ["statement"])
  assert.equal(result.statements, 30000)
  assert.equal(result.other, 20000)
  assert.equal(result.expense, result.fixed + result.statements + result.other)
  assert.equal(result.left, 90000)
  assert.equal(result.spendable, 110000)
  assert.equal(result.left, monthBreakdown(entries, 10000).left)
})


test("all dated transactions after the 24th belong to the next budget period without mutating dates", () => {
  assert.equal(budgetPeriodForDate("2026-10-23"), "2026-10")
  assert.equal(budgetPeriodForDate("2026-10-24"), "2026-10")
  assert.equal(budgetPeriodForDate("2026-10-25"), "2026-11")
  assert.equal(budgetPeriodForDate("2026-10-31"), "2026-11")
  assert.equal(budgetPeriodForDate("2026-11-23"), "2026-11")
  assert.equal(budgetPeriodForDate("2026-11-24"), "2026-11")
  assert.equal(budgetPeriodForDate("2026-11-25"), "2026-12")
  assert.equal(budgetPeriodForDate("2026-12-31"), "2027-01")
  assert.equal(budgetPeriodForDate("2028-02-29"), "2028-03")
  assert.deepEqual(budgetPeriodBounds("2026-11"), { min: "2026-10-25", max: "2026-11-24" })
  const entries = ["2026-10-24", "2026-10-25", "2026-11-24", "2026-11-25"].map((date, index) => ({ ...recurring, id: String(index), recurrence: undefined, date }))
  assert.deepEqual(entriesForMonth(entries, "2026-11", "2026-12").map(entry => entry.id), ["2", "1"])
  assert.equal(removeMonthEntries(entries, ["1"], "2026-11").some(entry => entry.id === "1"), false)
  assert.equal(removeMonthEntries(entries, ["1"], "2026-10").length, 4)
  assert.equal(entries[1].date, "2026-10-25")
})
