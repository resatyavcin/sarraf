import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/budget") return nextResolve(new URL("../src/lib/budget.ts", import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
const { readBudgetPreferences, saveBudgetPreferences, readBudget, saveBudget } = await import("../src/data/budget.ts")

test("legacy categories become optional labels while transactions and savings stay intact", () => {
  const store = new Map()
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  } })
  try {
    store.set("randevu-link.budget.preferences.v1", JSON.stringify({
      categories: [{ id: "card", name: "Kart", kind: "statement", startMonth: "2026-01", endMonth: "" }],
      savings: { "2026-11": 50000 },
    }))
    const entry = { id: "existing", kind: "expense", description: "Ödeme", amountCents: 10000, date: "2026-11-20", categoryId: "card", createdAt: "2026-11-20T12:00:00Z" }
    saveBudget([entry])
    const prefs = readBudgetPreferences()
    assert.deepEqual(prefs, { categories: [{ id: "card", name: "Kart" }], savings: { "2026-11": 50000 } })
    saveBudgetPreferences(prefs)
    assert.deepEqual(readBudgetPreferences(), prefs)
    assert.deepEqual(readBudget(), [entry])
    saveBudget([{ ...entry, id: "uncategorized", categoryId: undefined }])
    assert.equal(readBudget()[0].categoryId, undefined)
    saveBudgetPreferences({ categories: [], savings: {} })
    assert.deepEqual(readBudgetPreferences(), { categories: [], savings: {} })

    // Signed-in accounts cannot inherit legacy or another account's records.
    assert.deepEqual(readBudget("alice"), [])
    saveBudget([entry], "alice")
    saveBudgetPreferences(prefs, "alice")
    assert.deepEqual(readBudget("alice"), [entry])
    assert.deepEqual(readBudgetPreferences("alice"), prefs)
    assert.deepEqual(readBudget("bob"), [])
    assert.deepEqual(readBudgetPreferences("bob"), { categories: [], savings: {} })
    saveBudget([], "bob")
    assert.deepEqual(readBudget("alice"), [entry])
    assert.equal(readBudget()[0].id, "uncategorized")
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous)
    else delete globalThis.localStorage
  }
})
