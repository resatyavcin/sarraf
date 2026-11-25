import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/supabase/server") return { url: "test:supabase", shortCircuit: true }
    if (specifier.startsWith("@/")) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    if (specifier === "./budget" || specifier === "./budget-validation") return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === "test:supabase") return { format: "module", source: "export async function createClient() { return globalThis.budgetTestClient }", shortCircuit: true }
    return next(url, context)
  },
})

const { entryFromRow, fixedFromRow, amountToCents } = await import("../src/lib/budget-mapping.ts")
const { validEntry } = await import("../src/lib/budget-validation.ts")
const { loadBudget, saveEntry, deleteEntries, saveCategory, saveSavings, saveSavingsTarget } = await import("../src/data/budget-server.ts")
const id = "a97bf142-efdb-4931-903b-cdb4a95f2f16"
const row = { id, kind: "expense", label: "Market", amount: "12.34", month: "2026-11-01", spent_on: "2026-11-24", created_at: "2026-11-24T12:00:00Z", category_id: id, recurrence: null }

function setup({ user = "owner-a", email, categoryName = "Market", failure = false, rows = {} } = {}) {
  const calls = []
  globalThis.budgetTestClient = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user, email } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [], range: null, single: false, write: null }
      calls.push(call)
      const query = {
        select(columns) { call.columns = columns; return query }, order() { return query }, limit() { return query },
        eq(...args) { call.filters.push(args); return query },
        is(...args) { call.filters.push(args); return query },
        in(...args) { call.filters.push(args); return query },
        or(value) { call.or = value; return query },
        range(a, b) { call.range = [a, b]; return query },
        insert(value) { call.write = value; return query },
        upsert(value) { call.write = value; return query },
        update(value) { call.write = value; return query },
        delete() { call.delete = true; return query },
        single() { call.single = true; return query },
        maybeSingle() { call.maybeSingle = true; return query },
        then(resolve, reject) {
          let data = rows[table] ?? []
          if (call.maybeSingle) data = data[0] ?? null
          else if (call.single) data = { ...row, name: categoryName, ...call.write }
          else if (call.range) data = data.slice(call.range[0], call.range[1] + 1)
          return Promise.resolve({ data, error: failure ? { code: "offline" } : null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return calls
}

test("database mapping preserves decimal cents, dates, categories and fixed periods", () => {
  assert.equal(amountToCents("0.29"), 29)
  assert.equal(entryFromRow(row).amountCents, 1234)
  assert.equal(entryFromRow({ ...row, spent_on: null }).date, "2026-11-01")
  assert.equal(entryFromRow({ ...row, category_id: "category" }).categoryId, "category")
  const fixed = fixedFromRow({ id, name: "Maaş", amount: "100.01", valid_from: "2026-01-01", valid_to: "2026-12-01", created_at: row.created_at }, "income")
  assert.equal(fixed.id, `income:${id}`)
  assert.equal(fixed.amountCents, 10001)
  assert.deepEqual(fixed.recurrence, { endMonth: "2026-12", excludedMonths: [] })
  assert.equal(validEntry({ ...entryFromRow(row), amountCents: 0 }), false)
  assert.equal(validEntry({ ...entryFromRow(row), recurrence: { endMonth: "2026-01", excludedMonths: [] } }), false)
})

test("reads all pages and applies the authenticated owner to every table query", async () => {
  const calls = setup({ rows: { budget_entries: Array.from({ length: 501 }, (_, index) => ({ ...row, id: String(index) })) } })
  const result = await loadBudget()
  assert.equal(result.error, "")
  assert.equal(result.entries.length, 501)
  assert.equal(calls.filter(call => call.table === "budget_entries").length, 2)
  assert.ok(calls.every(call => call.filters.some(([key, value]) => key === "user_id" && value === "owner-a")))
})

test("writes derive ownership from the session and database failure stays a failure", async () => {
  const calls = setup({ user: "owner-b" })
  const saved = await saveEntry({ ...entryFromRow(row), user_id: "attacker" })
  assert.ok(saved.entry)
  assert.equal(calls.find(call => call.table === "budget_entries").write.user_id, "owner-b")
  assert.equal(calls.find(call => call.table === "budget_entries").write.amount, 12.34)
  assert.ok(!("kind" in calls.find(call => call.table === "budget_entries").write))
  assert.ok(!("recurrence" in calls.find(call => call.table === "budget_entries").write))
  setup({ failure: true })
  assert.ok((await saveEntry(entryFromRow(row))).error)
  assert.ok((await saveCategory({ id, name: "Market" })).error)
  assert.ok((await saveSavings("2026-11", 500)).error)
  assert.ok((await loadBudget()).error)
})

test("unauthenticated requests never reach the database", async () => {
  const calls = setup({ user: null })
  assert.ok((await saveEntry(entryFromRow(row))).error)
  assert.ok((await saveSavings("2026-11", 100)).error)
  assert.ok((await saveSavingsTarget("2026-11", 100)).error)
  assert.ok((await deleteEntries([id], "2026-11")).error)
  assert.equal(calls.length, 0)
})

test("deletion is owner and month scoped, targets regular expense rows and returns only deleted ids", async () => {
  const calls = setup({ rows: { budget_entries: [{ ...row, month: "2026-12-01", spent_on: "2026-12-23" }] } })
  const result = await deleteEntries([id], "2026-12")
  assert.deepEqual(result.deletedIds, [id])
  assert.ok(calls[0].filters.some(([key, value]) => key === "user_id" && value === "owner-a"))
  const deletion = calls.find(call => call.delete)
  assert.ok(deletion.filters.some(([key, value]) => key === "month" && value === "2026-12-01"))
  assert.ok(deletion.filters.some(([key, value]) => key === "spent_on" && value === "2026-12-23"))
})


test("savings and recurring entries use the original tables and decimal amounts", async () => {
  const calls = setup()
  assert.deepEqual(await saveSavings("2026-11", 12550), {})
  assert.equal(calls[0].table, "savings")
  assert.equal(calls[0].write.month, "2026-11-01")
  assert.equal(calls[0].write.amount, 125.5)
  const result = await saveEntry({ ...entryFromRow(row), kind: "income", recurrence: { endMonth: "", excludedMonths: [] }, date: "2026-11-01" })
  assert.ok(result.entry)
  assert.equal(calls.find(call => call.table === "budget_incomes").table, "budget_incomes")
  assert.equal(calls.find(call => call.table === "budget_incomes").write.valid_from, "2026-11-01")
  assert.equal(calls.find(call => call.table === "budget_incomes").write.valid_to, null)
  assert.ok(!calls.some(call => call.table === "budget_savings"))
})

test("same-day income is represented once and remains a single transaction", () => {
  const income = fixedFromRow({ id, name: "Ek gelir", amount: "25.50", valid_from: "2026-11-24", valid_to: "2026-11-24", created_at: row.created_at }, "income")
  assert.equal(income.recurrence, undefined)
  assert.equal(income.date, "2026-11-24")
  assert.equal(income.amountCents, 2550)
})


test("regular expense requires a category while fixed entries have no category", async () => {
  const calls = setup()
  const missingCategory = await saveEntry({ ...entryFromRow(row), categoryId: undefined })
  assert.ok(missingCategory.error)
  assert.equal(calls.length, 0)
  const fixed = await saveEntry({ ...entryFromRow(row), categoryId: undefined, recurrence: { endMonth: "", excludedMonths: [] } })
  assert.equal(fixed.category, undefined)
  assert.equal(fixed.entry.categoryId, undefined)
  assert.equal(calls.find(call => call.write)?.table, "budget_fixed_expenses")
})


test("bank categories collapse into Kart Ekstresi without changing entries or totals", async () => {
  const { groupCardStatements } = await import("../src/lib/budget-categories.ts")
  const categories = [{ id: "enpara", name: "Enpara" }, { id: "garanti", name: "Garanti" }, { id: "hadi", name: "Hadi" }, { id: "garanti-2", name: "Garanti 2" }, { id: "market", name: "Market" }]
  const entries = categories.map((category, index) => ({ ...entryFromRow(row), id: String(index), categoryId: category.id, description: category.name, amountCents: 100 + index }))
  const result = groupCardStatements(categories, entries)
  assert.equal(result.categories.length, 2)
  assert.equal(result.categories.filter(category => category.name === "Kart Ekstresi").length, 1)
  assert.equal(new Set(result.entries.slice(0, 4).map(entry => entry.categoryId)).size, 1)
  assert.deepEqual(result.entries.map(entry => entry.description), entries.map(entry => entry.description))
  assert.deepEqual(result.entries.map(entry => entry.amountCents), entries.map(entry => entry.amountCents))
  assert.equal(result.entries[4].categoryId, "market")
  const canonical = groupCardStatements([...categories, { id: "card", name: "Kart Ekstresi" }], entries)
  assert.equal(canonical.entries[0].categoryId, "card")
  assert.equal(entries[1].categoryId, "garanti")
})


test("expense quick actions stay owner and category scoped and validate input", async () => {
  const { getQuickActions, addQuickAction, removeQuickAction } = await import("../src/data/budget-quick-actions.ts")
  const calls = setup({ rows: { budget_quick_actions: [{ id, label: "Acıbadem", category_id: id }] } })
  const result = await getQuickActions()
  assert.deepEqual(result.items, [{ id, label: "Acıbadem", categoryId: id }])
  assert.ok(calls[0].filters.some(([key, value]) => key === "user_id" && value === "owner-a"))
  assert.ok(!calls[0].filters.some(([key]) => key === "category_id"))
  await addQuickAction(id, "MedicalPark")
  const saved = calls.find(call => call.write)
  assert.equal(saved.table, "budget_quick_actions")
  assert.equal(saved.write.user_id, "owner-a")
  assert.equal(saved.write.category_id, id)
  assert.equal(saved.write.label, "MedicalPark")
  await removeQuickAction(id)
  const deleted = calls.find(call => call.delete)
  assert.ok(deleted.filters.some(([key, value]) => key === "user_id" && value === "owner-a"))
  assert.ok((await addQuickAction(id, " ")).error)
  assert.ok((await addQuickAction("invalid", "Test")).error)
  const unauthenticated = setup({ user: null })
  assert.ok((await getQuickActions()).error)
  assert.ok((await addQuickAction(id, "Test")).error)
  assert.ok((await removeQuickAction(id)).error)
  assert.equal(unauthenticated.length, 0)
})


test("quick actions preload all categories once with pagination and owner scope", async () => {
  const { getQuickActions } = await import("../src/data/budget-quick-actions.ts")
  const calls = setup({ rows: { budget_quick_actions: Array.from({ length: 501 }, (_, index) => ({ id: String(index), label: `Seçim ${index}`, category_id: index % 2 ? "hospital" : "market" })) } })
  const result = await getQuickActions()
  assert.equal(result.items.length, 501)
  assert.ok(result.items.some(item => item.categoryId === "hospital"))
  assert.ok(result.items.some(item => item.categoryId === "market"))
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.filters.some(([key, value]) => key === "user_id" && value === "owner-a")))
  assert.ok(calls.every(call => !call.filters.some(([key]) => key === "category_id")))
})


test("shared budget viewers read the host rows but every mutation is denied", async () => {
  const { addQuickAction, removeQuickAction } = await import("../src/data/budget-quick-actions.ts")
  const { addBudgetViewer, removeBudgetViewer } = await import("../src/data/budget-viewers.ts")
  const calls = setup({ user: "reader", email: "reader@example.com", rows: { viewers: [{ host_id: "host-owner" }], budget_entries: [row] } })
  const loaded = await loadBudget()
  assert.equal(loaded.error, "")
  assert.equal(loaded.entries.length, 1)
  assert.ok(calls.filter(call => call.table !== "viewers").every(call => call.filters.some(([key, value]) => key === "user_id" && value === "host-owner")))
  assert.ok((await saveEntry(entryFromRow(row))).error)
  assert.ok((await saveCategory({ id, name: "Market" })).error)
  assert.ok((await saveSavings("2026-11", 100)).error)
  assert.ok((await saveSavingsTarget("2026-11", 100)).error)
  assert.ok((await deleteEntries([id], "2026-11")).error)
  assert.ok((await addQuickAction(id, "Acıbadem")).error)
  assert.ok((await removeQuickAction(id)).error)
  assert.ok((await addBudgetViewer("someone@example.com")).error)
  assert.ok((await removeBudgetViewer("someone@example.com")).error)
  assert.ok(calls.every(call => !call.write && !call.delete))
})

test("owners manage only their own viewer grants and normalize email", async () => {
  const { addBudgetViewer, removeBudgetViewer } = await import("../src/data/budget-viewers.ts")
  const calls = setup({ user: "host-owner", email: "host@example.com" })
  assert.deepEqual(await addBudgetViewer(" Reader@Example.com "), {})
  const insert = calls.find(call => call.write)
  assert.deepEqual(insert.write, { host_id: "host-owner", viewer_email: "reader@example.com" })
  assert.deepEqual(await removeBudgetViewer("Reader@Example.com"), {})
  const deletion = calls.find(call => call.delete)
  assert.ok(deletion.filters.some(([key, value]) => key === "host_id" && value === "host-owner"))
  assert.ok(deletion.filters.some(([key, value]) => key === "viewer_email" && value === "reader@example.com"))
  assert.ok((await addBudgetViewer("host@example.com")).error)
  assert.ok((await addBudgetViewer("invalid")).error)
})


test("a new account reads its own rows and access lookup errors prevent writes", async () => {
  const calls = setup({ user: "new-owner", email: "new@example.com", rows: { budget_entries: [row] } })
  const budget = await loadBudget()
  assert.equal(budget.error, "")
  assert.ok(calls.filter(call => call.table !== "viewers").every(call => call.filters.some(([key, value]) => key === "user_id" && value === "new-owner")))
  const failed = setup({ user: "new-owner", email: "new@example.com", failure: true })
  assert.ok((await saveSavings("2026-11", 100)).error)
  assert.ok((await saveSavingsTarget("2026-11", 100)).error)
  assert.ok(failed.every(call => call.table === "viewers" && !call.write))
})


test("undated October statement is displayed in November without changing the source row", () => {
  const stored = { ...row, month: "2026-10-01", spent_on: null }
  const shown = entryFromRow(stored, true)
  assert.equal(shown.date, "2026-11-01")
  assert.equal(shown.statementMonth, "2026-10")
  assert.equal(stored.month, "2026-10-01")
  assert.equal(stored.spent_on, null)
  assert.equal(entryFromRow(stored, false).date, "2026-10-01")
  assert.equal(entryFromRow({ ...stored, spent_on: "2026-10-30" }, true).date, "2026-10-30")
  assert.equal(entryFromRow({ ...stored, month: "2026-12-01" }, true).date, "2027-01-01")
})

test("editing the amount of a legacy displayed statement preserves its stored dates", async () => {
  const stored = { ...row, month: "2026-10-01", spent_on: null }
  const calls = setup({ categoryName: "Kart Ekstresi", rows: { budget_entries: [stored], budget_categories: [{ id, name: "Kart Ekstresi" }] } })
  const result = await saveEntry({ ...entryFromRow(stored, true), amountCents: 5000 })
  assert.equal(result.entry.date, "2026-11-01")
  const write = calls.find(call => call.write)
  assert.equal(write.write.month, "2026-10-01")
  assert.equal(write.write.spent_on, null)
  assert.equal(write.write.amount, 50)
})


test("deleting in November targets an October 25 transaction without rewriting its date", async () => {
  const calls = setup({ rows: { budget_entries: [{ ...row, month: "2026-10-01", spent_on: "2026-10-25" }] } })
  const result = await deleteEntries([id], "2026-11")
  assert.deepEqual(result.deletedIds, [id])
  const deletion = calls.find(call => call.delete)
  assert.ok(deletion.filters.some(([key, value]) => key === "month" && value === "2026-10-01"))
  assert.ok(deletion.filters.some(([key, value]) => key === "spent_on" && value === "2026-10-25"))
  assert.ok(calls.every(call => !call.write))
})


test("monthly savings targets and actual savings use independent storage", async () => {
  const calls = setup({ rows: { savings: [{ month: "2026-11-01", amount: "250" }], budget_savings_targets: [{ month: "2026-11-01", amount: "1000" }] } })
  const result = await loadBudget()
  assert.equal(result.preferences.savings["2026-11"], 25000)
  assert.equal(result.preferences.savingsTargets["2026-11"], 100000)
  await saveSavingsTarget("2026-11", 200000)
  const writes = calls.filter(call => call.write)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].table, "budget_savings_targets")
  assert.equal(writes[0].write.amount, 2000)
  await saveSavings("2026-11", 30000)
  assert.equal(calls.filter(call => call.write).at(-1).table, "savings")
})
