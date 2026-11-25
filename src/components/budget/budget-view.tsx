"use client"

import { PanelShell } from "@/components/layout/panel-shell"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Info, X, Plus, Trash2, ChartNoAxesCombined } from "lucide-react"
import { Dialog } from "radix-ui"
import { useToast } from "@/components/ui/toast"
import { BudgetTransactions } from "@/components/budget/budget-transactions"
import { ExpenseQuickActions } from "@/components/budget/expense-quick-actions"
import { SpendingChart } from "@/components/budget/spending-chart"
import { BudgetDateField } from "@/components/budget/budget-fields"
import { BudgetCategoryField, BudgetCategoryManager, BudgetSummary } from "@/components/budget/budget-panels"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/booking-link/panel-sheet"
import { saveEntry, deleteEntries, saveCategory, saveSavings, saveSavingsTarget } from "@/data/budget-server"
import { budgetPeriodForDate, budgetPeriodBounds, entriesForMonth, formatMoney, isValidDate, isValidMonth, parseAmount, removeMonthEntries, upsertBudgetEntry, todayLocal } from "@/lib/budget"
import { useHydrated } from "@/lib/use-hydrated"
import { groupCardStatements } from "@/lib/budget-categories"
import { cn } from "@/lib/utils"
import type { AccountProfile } from "@/types/account"
import type { QuickAction } from "@/data/budget-quick-actions"
import type { BudgetEntry, BudgetPreferences } from "@/types/budget"

const inputClass = "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
const formatDate = (date: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`))

export function BudgetView({ initial, quickActions, profile }: { profile: AccountProfile; quickActions: { items: QuickAction[]; error?: string }; initial: { entries: BudgetEntry[]; preferences: BudgetPreferences; error: string } }) {
  const toast = useToast()
  const readOnly = profile.role === "viewer"
  const hydrated = useHydrated()
  const [quickItems, setQuickItems] = useState(quickActions.items)
  const [entries, setUpdated] = useState(initial.entries)
  const [preferences, setUpdatedPreferences] = useState(initial.preferences)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  function beginSave() {
    if (savingRef.current || initial.error || readOnly) return false
    savingRef.current = true
    setSaving(true)
    return true
  }
  function endSave() { savingRef.current = false; setSaving(false) }
  const [editingId, setEditingId] = useState<string | null>(null)
  const legacyEditing = Boolean(editingId)
  const [categoryId, setCategoryId] = useState("")
  const [fixedOpen, setFixedOpen] = useState(false)
  const [spendingOpen, setSpendingOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<BudgetEntry["kind"]>("expense")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [recurring, setRecurring] = useState(false)
  const fixedSource = recurring || kind === "income"
  const [startMonth, setStartMonth] = useState("")
  const [endMonth, setEndMonth] = useState("")
  const [clockDate, setClockDate] = useState<string | null>(null)
  useEffect(() => {
    const refresh = () => setClockDate(todayLocal())
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [])
  const currentMonth = hydrated ? budgetPeriodForDate(clockDate ?? todayLocal()) : ""
  const [date, setDate] = useState("")
  const [error, setError] = useState("")
  const [monthOverride, setMonth] = useState<string | null>(null)
  const month = monthOverride ?? currentMonth
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const monthlyEntries = entriesForMonth(entries, month, currentMonth)
  const latestMonth = entries.filter((entry) => !entry.recurrence).map((entry) => budgetPeriodForDate(entry.date)).sort().at(-1)
  const selectedIds = selected.filter((id) => monthlyEntries.some((entry) => entry.id === id && !entry.recurrence))
  const periodBounds = month ? budgetPeriodBounds(month) : null
  const monthLabel = month ? new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`)) : "…"

  async function commitCategories(categories: BudgetPreferences["categories"]) {
    if (!beginSave()) return false
    try {
      const changed = categories.filter(category => !preferences.categories.some(old => old.id === category.id && old.name === category.name))
      if (changed.length !== 1) return false
      const result = await saveCategory(changed[0])
      if (result.error) { toast.error(result.error); return false }
      const grouped = groupCardStatements(categories, entries)
      setUpdatedPreferences(current => ({ ...current, categories: grouped.categories }))
      setUpdated(grouped.entries)
      toast.success("Kategori kaydedildi")
      return true
    } catch { toast.error("Kategori kaydedilemedi. Tekrar dene."); return false }
    finally { endSave() }
  }

  async function commitSavings(next: BudgetPreferences) {
    if (!beginSave()) return false
    try {
      const result = await saveSavings(month, next.savings[month] ?? 0)
      if (result.error) { toast.error(result.error); return false }
      setUpdatedPreferences(current => ({ ...current, savings: { ...current.savings, [month]: next.savings[month] ?? 0 } }))
      toast.success("Birikim kaydedildi")
      return true
    } catch { toast.error("Birikim kaydedilemedi. Tekrar dene."); return false }
    finally { endSave() }
  }

  async function commitSavingsTarget(cents: number) {
    if (!beginSave()) return false
    try {
      const result = await saveSavingsTarget(month, cents)
      if (result.error) { toast.error(result.error); return false }
      setUpdatedPreferences(current => ({ ...current, savingsTargets: { ...current.savingsTargets, [month]: cents } }))
      toast.success("Birikim hedefi kaydedildi")
      return true
    } catch { toast.error("Birikim hedefi kaydedilemedi."); return false }
    finally { endSave() }
  }

  function goToMonth(next: string) {
    setMonth(next); setSelected([]); setSelecting(false); setQuery(""); setFilter("")
  }

  function openEntry(isRecurring: boolean) {
    setEditingId(null)
    setCategoryId("")
    setRecurring(isRecurring)
    setStartMonth(month)
    setEndMonth("")
    setKind("expense")
    setDescription("")
    setAmount("")
    setDate(month === currentMonth ? todayLocal() : `${month}-01`)
    setError("")
    setOpen(true)
  }

  function editEntry(entry: BudgetEntry) {
    setEditingId(entry.id); setRecurring(Boolean(entry.recurrence))
    setKind(entry.kind); setDescription(entry.description); setAmount(String(entry.amountCents / 100).replace(".", ","))
    setDate(entry.date); setStartMonth(entry.date.slice(0, 7)); setEndMonth(entry.recurrence?.endMonth ?? ""); setCategoryId(entry.categoryId ?? ""); setError(""); setOpen(true)
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountCents = parseAmount(amount)
    const entryDate = recurring ? `${startMonth}-01` : date
    if (!description.trim() || amountCents === null || !isValidDate(entryDate) || (recurring && endMonth && (!isValidMonth(endMonth) || endMonth < startMonth))) {
      setError("Açıklama, geçerli bir tarih aralığı ve sıfırdan büyük bir tutar gir. Bitiş ayı başlangıçtan önce olamaz.")
      return
    }
    if (!fixedSource && !categoryId) { setError("Kategori seçmelisin."); return }
    if (!beginSave()) return
    try {
      const current = entries
      const previous = current.find((entry) => entry.id === editingId)
      const nextEntry: BudgetEntry = { id: editingId ?? crypto.randomUUID(), kind, description: description.trim(), amountCents, date: entryDate, createdAt: previous?.createdAt ?? new Date().toISOString(), ...(!fixedSource && categoryId ? { categoryId } : {}), ...(recurring ? { recurrence: { endMonth, excludedMonths: previous?.recurrence?.excludedMonths ?? [] } } : {}) }
      const result = await saveEntry(nextEntry)
      if (result.error || !result.entry) { setError(result.error ?? "İşlem kaydedilemedi."); return }
      setUpdated(current => upsertBudgetEntry(current, result.entry!))
      if (result.category) setUpdatedPreferences(current => ({ ...current, categories: current.categories.some(category => category.id === result.category!.id) ? current.categories : [...current.categories, result.category!] }))
      setMonth(recurring ? (startMonth > currentMonth ? currentMonth : startMonth) : budgetPeriodForDate(date))
      setSelected([])
      setSelecting(false)
      setOpen(false)
      toast.success(editingId ? "İşlem güncellendi" : recurring ? "Sabit işlem eklendi" : "İşlem eklendi")
    } catch { setError("İşlem kaydedilemedi. Bağlantını kontrol edip tekrar dene.") }
    finally { endSave() }
  }

  async function removeSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmation !== "onaylıyorum" || !selectedIds.length) return
    if (!beginSave()) return
    try {
      const result = await deleteEntries(selectedIds, month)
      setUpdated(current => removeMonthEntries(current, result.deletedIds ?? [], month))
      if (result.error) { toast.error(result.error); return }
      setDeleteOpen(false)
      setSelected([])
      setSelecting(false)
      toast.success("Seçilen işlemler silindi")
    } catch { toast.error("İşlemler silinemedi. Tekrar dene.") }
    finally { endSave() }
  }

  return (
    <PanelShell profile={profile} headerAction={entries.some((entry) => entry.recurrence) && (
        <Button variant="ghost" className="rounded-full" disabled={selecting} onClick={() => setFixedOpen(true)}>
          <Info className="size-4" />Sabit gelir ve giderler
        </Button>
    )}>
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 p-4 md:p-6" style={selecting ? { paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" } : undefined}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><BudgetDateField heading="Bütçe" label="Bütçe ayı" value={month} monthOnly onChange={goToMonth} /><p className="mt-1 text-sm text-muted-foreground">{periodBounds ? `${formatDate(periodBounds.min)} – ${formatDate(periodBounds.max)}` : "Aylık gelir, gider ve işlem hareketlerin."}</p></div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && <Button disabled={!hydrated || saving || Boolean(initial.error)} variant="outline" className="rounded-full" onClick={() => openEntry(true)}><Plus className="size-4" />Sabit işlem ekle</Button>}
        </div>
      </header>

      {initial.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 p-4"><p className="text-sm text-destructive">{initial.error}</p><Button variant="outline" className="rounded-full" onClick={() => window.location.reload()}>Tekrar dene</Button></div>}

      {readOnly && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">Paylaşılan bütçeyi görüntülüyorsun · Salt okunur</p>}
      <BudgetSummary readOnly={readOnly} entries={monthlyEntries} preferences={preferences} month={month} onSave={commitSavings} onSaveTarget={commitSavingsTarget} disabled={!hydrated || saving || Boolean(initial.error)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2"><BudgetCategoryManager readOnly={readOnly} categories={preferences.categories} disabled={!hydrated || saving || Boolean(initial.error)} onSave={commitCategories} /><Button variant="outline" className="rounded-full" disabled={!hydrated || saving || Boolean(initial.error)} onClick={() => setSpendingOpen(true)}><ChartNoAxesCombined className="size-4" aria-hidden />Harcamalar</Button></div>
      </div>

      <BudgetTransactions
        readOnly={readOnly}
        key={month}
        entries={monthlyEntries}
        categories={preferences.categories}
        query={query}
        filter={filter}
        onQuery={setQuery}
        onFilter={setFilter}
        selecting={selecting}
        selectedIds={selectedIds}
        onToggleSelection={() => {
          setSelecting(!selecting)
          setSelected([])
        }}
        onSelect={(id, checked) => setSelected((ids) => checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id))}
        onEdit={(entry) => editEntry(entries.find((item) => item.id === entry.id) ?? entry)}
        loading={!hydrated}
        error={initial.error}
        onLatestMonth={latestMonth && latestMonth !== month ? () => goToMonth(latestMonth) : undefined}
        onAdd={() => openEntry(false)}
      />
      {entries.some((entry) => entry.recurrence) && <>

        <Sheet open={fixedOpen} onOpenChange={setFixedOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sabit gelir ve giderler</SheetTitle>
              <SheetDescription>Her kayıt, belirlediğin aylar boyunca işlem hareketlerine eklenir.</SheetDescription>
            </SheetHeader>
            <ul className="divide-y divide-border/60">{entries.filter((entry) => entry.recurrence).map((entry) => <li key={entry.id} className="flex flex-col items-start gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="break-words text-sm font-medium">{entry.description}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.date).replace(/^1 /, "")} – {entry.recurrence!.endMonth ? formatDate(`${entry.recurrence!.endMonth}-01`).replace(/^1 /, "") : "Bitiş yok"}</p><p className="mt-1 text-xs text-muted-foreground">{entry.date.slice(0, 7) > currentMonth ? "Başlangıç ayını bekliyor" : entry.recurrence!.endMonth && entry.recurrence!.endMonth < currentMonth ? "Tamamlandı" : "Her ay tekrarlanıyor"}</p></div>
              <span className={cn("min-w-0 break-all text-sm font-semibold sm:shrink-0", entry.kind === "income" && "text-emerald-600 dark:text-emerald-400")}>{entry.kind === "income" ? "+" : "−"}{formatMoney(entry.amountCents)}<span className="block text-right text-xs font-normal text-muted-foreground">/ ay</span></span>
              {!readOnly && <Button variant="outline" className="rounded-full" onClick={() => { setFixedOpen(false); editEntry(entry) }}>Düzenle</Button>}
            </li>)}</ul>
          </SheetContent>
        </Sheet>
      </>}
      <Sheet open={spendingOpen} onOpenChange={setSpendingOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Harcamalar</SheetTitle>
            <SheetDescription><span className="capitalize">{monthLabel}</span> dönemindeki harcamalarının kategori dağılımı. Sabit giderler dahil değildir.</SheetDescription>
          </SheetHeader>
          <SpendingChart entries={monthlyEntries} categories={preferences.categories} status={initial.error || (!hydrated ? "Yükleniyor…" : "")} />
        </SheetContent>
      </Sheet>

      {selecting && !deleteOpen && !open && (
        <div role="region" aria-label="Seçilen işlem eylemleri" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-2 rounded-2xl border bg-background p-3 shadow-lg">
            <p role="status" className="pl-1 text-sm font-medium">{selectedIds.length ? `${selectedIds.length} işlem seçildi` : "İşlem seç"}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => { setSelecting(false); setSelected([]) }}>Vazgeç</Button>
              <Button variant="outline" className="rounded-full text-destructive hover:text-destructive" disabled={!selectedIds.length} onClick={() => { setConfirmation(""); setDeleteOpen(true) }}><Trash2 className="size-4" />Sil</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog.Root open={deleteOpen} onOpenChange={(value) => { if (!savingRef.current) setDeleteOpen(value) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-80 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-80 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border bg-background p-6 shadow-xl">
            <Dialog.Close asChild><Button variant="ghost" size="icon-sm" className="absolute right-4 top-4 rounded-full" aria-label="Kapat"><X className="size-4" /></Button></Dialog.Close>
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="size-5" aria-hidden /></div>
            <Dialog.Title className="pr-6 font-display text-xl font-semibold tracking-tight">İşlemleri sil</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Seçtiğin {selectedIds.length} işlem kalıcı olarak silinecek. Sabit gelir ve giderler silinmez. Bu işlem geri alınamaz.</Dialog.Description>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm"><span className="capitalize text-muted-foreground">{monthLabel}</span><span className="font-medium">{selectedIds.length} işlem</span></div>
            <form onSubmit={removeSelected} className="mt-5 space-y-5">
              <label className="grid gap-2 text-sm"><span>Devam etmek için <span className="font-semibold">onaylıyorum</span> yaz.</span><input autoComplete="off" spellCheck={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="onaylıyorum" className={inputClass} /></label>
              <div className="grid grid-cols-2 gap-3"><Dialog.Close asChild><Button type="button" variant="outline" className="h-11 rounded-full">Vazgeç</Button></Dialog.Close><Button type="submit" variant="destructive" className="h-11 rounded-full" disabled={saving || confirmation !== "onaylıyorum" || !selectedIds.length}>Sil</Button></div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Sheet open={open} onOpenChange={(value) => { if (!savingRef.current) setOpen(value) }}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editingId ? "İşlemi düzenle" : recurring ? "Sabit işlem ekle" : "İşlem ekle"}</SheetTitle><SheetDescription>{recurring ? "Belirlediğin aylar boyunca her ay otomatik yansır." : "Gelir veya giderini kaydet."}</SheetDescription></SheetHeader>
          {editingId && recurring && <p className="mb-5 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">Sabit kayıttaki değişiklikler, geçerli olduğu tüm aylara uygulanır.</p>}
          <form onSubmit={addEntry} className="space-y-5"><fieldset disabled={saving} className="space-y-5">

            <div role="group" aria-label="İşlem türü" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">{(["income", "expense"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} disabled={legacyEditing} onClick={() => { setKind(value); setCategoryId("") }} className={cn("rounded-full py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", kind === value && "bg-background shadow-sm")}>{value === "income" ? "Gelir" : "Gider"}</button>)}</div>
            <label className="grid gap-2 text-sm font-medium">Tutar (₺)
              <input required inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} />
            </label>
            {!fixedSource && <BudgetCategoryField categories={preferences.categories} value={categoryId} onChange={setCategoryId} />}
            <label className="grid gap-2 text-sm font-medium">Açıklama<input required maxLength={fixedSource ? 60 : 80} placeholder="Örn. kira, malzeme, ödeme" value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></label>
            {open && !fixedSource && categoryId && <ExpenseQuickActions key={categoryId} categoryId={categoryId} items={quickItems.filter(item => item.categoryId === categoryId)} error={quickActions.error} onAdd={item => setQuickItems(current => [...current.filter(old => old.id !== item.id), item])} onRemove={id => setQuickItems(current => current.filter(item => item.id !== id))} description={description} onSelect={setDescription} disabled={saving} />}

            {!recurring && kind === "income" && <p className="rounded-xl bg-muted/40 px-3 py-3 text-sm">Kategori: <span className="font-medium">Gelir</span> <span className="text-muted-foreground">· Otomatik</span></p>}
            {recurring ? <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <BudgetDateField label="Başlangıç ayı" value={startMonth} onChange={setStartMonth} monthOnly />
                <BudgetDateField label="Bitiş ayı" value={endMonth} onChange={setEndMonth} monthOnly min={startMonth} optional />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Başlangıç ve bitiş ayı dahil her ay otomatik yansır. Bitişi boş bırakırsan devam eder. Gelecek aylara ait tutarlar, o ay gelene kadar hareketlere ve toplamlara eklenmez.</p>
            </div> : (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <BudgetDateField label="Tarih" value={date} onChange={setDate} />
              </div>
            )}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={saving} className="h-12 w-full rounded-xl">{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
          </fieldset></form>
        </SheetContent>
      </Sheet>
    </div>
    </PanelShell>
  )
}
