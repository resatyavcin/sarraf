import { formatMoney } from "@/lib/budget"
import type { BudgetCategory, BudgetEntry } from "@/types/budget"

export function SpendingChart({ entries, categories, status }: {
  entries: BudgetEntry[]
  categories: BudgetCategory[]
  status: string
}) {
  const names = new Map(categories.map(category => [category.id, category.name]))
  const amounts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.kind !== "expense" || entry.recurrence) continue
    const id = entry.categoryId && names.has(entry.categoryId) ? entry.categoryId : ""
    amounts.set(id, (amounts.get(id) ?? 0) + entry.amountCents)
  }
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0)
  const ranked = [...amounts].sort((a, b) => b[1] - a[1])
  const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 })
  const colors = new Map(categories.map((category, index) => [category.id, `hsl(${(260 + index * 137.508) % 360} 65% 57%)`]))
  const colorFor = (id: string) => colors.get(id) ?? "#94a3b8"

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Kategoriye göre harcamalar</h2>
      {status || !total ? <p className="mt-4 text-sm text-muted-foreground">{status || "Bu ay için sabit giderler dışında harcama yok."}</p> : (
        <div className="mt-5 space-y-5">
          <div role="img" aria-label={`Toplam harcama ${formatMoney(total)}. ${ranked.map(([id, amount]) => `${names.get(id) ?? "Kategorisiz"}: ${percent.format(amount / total)}`).join(", ")}`} className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
            {ranked.map(([id, amount]) => <div key={id} className="h-full min-w-0" style={{ width: `${amount / total * 100}%`, backgroundColor: colorFor(id) }} title={`${names.get(id) ?? "Kategorisiz"}: ${formatMoney(amount)} (${percent.format(amount / total)})`} />)}
          </div>
          <ol className="space-y-3">
          {ranked.map(([id, amount]) => (
            <li key={id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor(id) }} /><span className="min-w-0 break-words">{names.get(id) ?? "Kategorisiz"}</span></span>
                <span className="font-medium tabular-nums">{formatMoney(amount)} <span className="ml-1 text-xs text-muted-foreground">{percent.format(amount / total)}</span></span>
              </div>
            </li>
          ))}
          </ol>
        </div>
      )}
    </section>
  )
}
