"use client"

import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Pencil, Plus, ReceiptText, Search } from "lucide-react"
import { Checkbox } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/booking-link/panel-sheet"
import { DrawerTrigger } from "@/components/ui/drawer"
import { budgetTotals, formatMoney, selectBudgetEntries, paginateBudgetEntries } from "@/lib/budget"
import { cn } from "@/lib/utils"
import type { BudgetCategory, BudgetEntry } from "@/types/budget"

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" })
const dateLabel = (date: string) => dateFormat.format(new Date(`${date}T12:00:00`))

function SelectionCheckbox({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <Checkbox.Root aria-label={label} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="absolute inset-0 z-10 flex w-full cursor-pointer items-center pl-5.5 pr-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:pl-7.5 sm:pr-5">
      <span className={cn("flex size-5 items-center justify-center rounded-md border transition-colors", checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/35 bg-background")}>
        <Checkbox.Indicator><Check className="size-3.5" strokeWidth={3} /></Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  )
}

type TransactionProps = {
  readOnly?: boolean
  entries: BudgetEntry[]
  categories: BudgetCategory[]
  query: string
  filter: string
  onQuery: (query: string) => void
  onFilter: (filter: string) => void
  selecting: boolean
  selectedIds: string[]
  onToggleSelection: () => void
  onSelect: (id: string, checked: boolean) => void
  onEdit: (entry: BudgetEntry) => void
  loading: boolean
  error: string
  onLatestMonth?: () => void
  onAdd: () => void
}

export function BudgetTransactions({
  readOnly = false, entries, categories, query, filter, onQuery: updateQuery, onFilter: updateFilter,
  selecting, selectedIds, onToggleSelection, onSelect, onEdit, loading, error, onLatestMonth, onAdd,
}: TransactionProps) {
  const [requestedPage, setPage] = useState(1)
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false)
  function onQuery(value: string) { setPage(1); updateQuery(value) }
  function onFilter(value: string) { setPage(1); updateFilter(value) }
  const shown = selectBudgetEntries(entries, categories, query, filter, "date")
  const pagination = paginateBudgetEntries(shown, requestedPage)
  const filtered = Boolean(query || filter)
  const totals = filtered ? budgetTotals(shown) : null
  const names = new Map(categories.map((category) => [category.id, category.name]))
  const selected = new Set(selectedIds)
  const groups = new Map<string, BudgetEntry[]>()
  for (const entry of pagination.items) {
    const key = ""
    const group = groups.get(key)
    if (group) group.push(entry)
    else groups.set(key, [entry])
  }

  return (
    <section aria-labelledby="budget-transactions" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 id="budget-transactions" className="text-base font-semibold tracking-tight">İşlem hareketleri</h2>
          {!loading && !error && <p role="status" className="mt-0.5 text-xs text-muted-foreground">
            {filtered ? `${entries.length} işlemden ${shown.length} tanesi gösteriliyor` : `${entries.length} işlem`}
          </p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {!readOnly && entries.some((entry) => !entry.recurrence) && (
          <Button variant="outline" size="sm" className="rounded-full" disabled={loading || Boolean(error)} onClick={onToggleSelection}>
            {selecting ? "Vazgeç" : "Seç"}
          </Button>
        )}
          {!readOnly && <Button size="sm" className="rounded-full" disabled={loading || Boolean(error)} onClick={onAdd}><Plus className="size-4" aria-hidden />İşlem ekle</Button>}
        </div>
      </header>

      {entries.length > 0 && (
        <div className="space-y-3 border-t px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full sm:w-auto sm:min-w-48 sm:flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" aria-label="İşlem veya kategori ara" placeholder="İşlem veya kategori ara"
                value={query} onChange={(event) => onQuery(event.target.value)}
                className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" />
            </label>
            {categories.length > 0 && (
              <Sheet open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" aria-label="Kategori filtresi" className="group min-w-0 max-w-full rounded-full">
                    <span className="truncate">{names.get(filter) ?? "Tüm Kategoriler"}</span>
                    <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none" />
                  </Button>
                </DrawerTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Kategori filtresi</SheetTitle>
                    <SheetDescription>İşlemlerini görmek istediğin kategoriyi seç.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-2">
                    {[{ id: "", name: "Tüm Kategoriler" }, ...categories].map(category => (
                      <Button key={category.id} type="button" variant={filter === category.id ? "secondary" : "outline"}
                        aria-pressed={filter === category.id}
                        className="h-auto min-h-12 w-full justify-between gap-3 whitespace-normal rounded-xl py-3 text-left"
                        onClick={() => { onFilter(category.id); setCategoryFilterOpen(false) }}>
                        <span className="min-w-0 break-words">{category.name}</span>
                        {filter === category.id && <Check className="size-4 shrink-0" aria-hidden />}
                      </Button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
          {totals && <p className="text-xs text-muted-foreground">Gelir {formatMoney(totals.income)} · Gider {formatMoney(totals.expense)}</p>}
        </div>
      )}

      {error ? <p role="alert" className="border-t p-5 text-sm text-destructive">{error}</p>
        : loading ? <p role="status" className="border-t p-5 text-sm text-muted-foreground">Yükleniyor…</p>
        : !shown.length ? (
          <div className="flex flex-col items-center border-t px-4 py-10 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              {filtered ? <Search aria-hidden className="size-5" /> : <ReceiptText aria-hidden className="size-5" />}
            </span>
            <h3 className="text-sm font-semibold">{filtered ? "Sonuç bulunamadı" : "Bu ay işlem yok"}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {filtered ? "Aramanı veya kategori filtreni değiştirebilirsin." : "Bu aya ait gelir ve giderler burada görünecek."}
            </p>
            {filtered ? (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => { onQuery(""); onFilter("") }}>Filtreleri temizle</Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {onLatestMonth && <Button size="sm" variant="ghost" className="rounded-full" onClick={onLatestMonth}>Son kayıtlı aya git</Button>}
              </div>
            )}
          </div>
        ) : Array.from(groups, ([date, group]) => (
          <div key={date} className="border-t">
            {date && <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/50 px-4 py-2 text-xs sm:px-5">
              <h3 className="font-medium"><time dateTime={date}>{dateLabel(date)}</time></h3>
              <span className="tabular-nums text-muted-foreground">Net {formatMoney(budgetTotals(group).balance)}</span>
            </div>}
            <ul className="divide-y divide-border/60">
              {group.map((entry) => {
                const income = entry.kind === "income"
                const metadata = [income ? "Gelir" : "Gider", entry.categoryId && (names.get(entry.categoryId) ?? "Kategorisiz"),
                  entry.recurrence && "Her ay sabit", !date && (entry.statementMonth ? `${new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(`${entry.date.slice(0, 7)}-01T12:00:00`))} dönemi` : dateLabel(entry.date))].filter(Boolean).join(" · ")
                return (
                  <li key={entry.id} className={cn("relative flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5", selecting && !entry.recurrence && "cursor-pointer", selected.has(entry.id) && "bg-muted/50")}>
                    {selecting && !entry.recurrence ? (
                      <div className="flex size-10 shrink-0 items-center justify-center">
                        <SelectionCheckbox label={`${entry.description} işlemini seç`} checked={selected.has(entry.id)}
                          onCheckedChange={(checked) => onSelect(entry.id, checked)} />
                      </div>
                    ) : (
                      <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full",
                        income ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                        {income ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                      </span>
                    )}
                    <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">{entry.description}</p>
                      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere] sm:col-start-1">{metadata}</p>
                      <span className={cn("text-sm font-semibold tabular-nums sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center",
                        income && "text-emerald-600 dark:text-emerald-400")}>
                        {income ? "+" : "−"}{formatMoney(entry.amountCents)}
                      </span>
                    </div>
                    {!readOnly && !selecting && <Button variant="ghost" size="icon-sm" className="size-10 shrink-0 rounded-full text-muted-foreground"
                      aria-label={`${entry.description} işlemini düzenle`} onClick={() => onEdit(entry)}><Pencil className="size-4" /></Button>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      {!loading && !error && pagination.totalPages > 1 && <nav aria-label="İşlem sayfaları" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <p className="text-xs text-muted-foreground">{pagination.start}–{pagination.end} / {shown.length} işlem</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={pagination.page === 1} onClick={() => setPage(pagination.page - 1)}>Önceki</Button>
          <span role="status" aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{pagination.page} / {pagination.totalPages}</span>
          <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={pagination.page === pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>Sonraki</Button>
        </div>
      </nav>}
    </section>
  )
}
