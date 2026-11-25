"use client";

import { useRef, useState, type FormEvent } from "react";
import { ChevronRight, Info, ReceiptText, X, Pencil } from "lucide-react";
import { Dialog } from "radix-ui";
import { BudgetCards } from "@/components/budget/budget-cards";
import { isCardStatementCategory } from "@/lib/budget-categories";
import { SavingsHistory } from "@/components/budget/savings-history";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/booking-link/panel-sheet";
import {
  BudgetAmountField,
} from "@/components/budget/budget-fields";
import {
  formatMoney,
  isValidMonth,
  monthBreakdown,
  savingsComparison,
  parseAmount,
} from "@/lib/budget";
import type {
  BudgetCategory,
  BudgetEntry,
  BudgetPreferences,
} from "@/types/budget";

const inputClass =
  "h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BudgetCategoryManager({
  readOnly = false,
  categories,
  onSave,
  disabled,
}: {
  categories: BudgetCategory[];
  onSave: (categories: BudgetCategory[]) => Promise<boolean>;
  disabled: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  function edit(category?: BudgetCategory) {
    setEditing(category?.id ?? null);
    setName(category?.name ?? "");
    setError("");
    if (category) nameInput.current?.focus();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) { setError("Kategori adı gir."); return; }
    if (
      categories.some(
        (category) =>
          category.id !== editing &&
          category.name.toLocaleLowerCase("tr-TR") ===
            clean.toLocaleLowerCase("tr-TR"),
      )
    ) {
      setError("Bu ad zaten kullanılıyor.");
      return;
    }
    const next: BudgetCategory = {
      id: editing ?? crypto.randomUUID(),
      name: clean,
    };
    if (
      await onSave(
        editing
          ? categories.map((category) =>
              category.id === editing ? next : category,
            )
          : [...categories, next],
      )
    )
      edit();
  }
  return (
    <>
      <Button
        variant="outline"
        className="rounded-full"
        disabled={disabled}
        onClick={() => {
          edit();
          setOpen(true);
        }}
      >
        Kategoriler
      </Button>
      <Sheet open={open} onOpenChange={(value) => { if (!disabled) setOpen(value); }}>
        <SheetContent contained>
          <SheetHeader>
            <SheetTitle>Kategoriler</SheetTitle>
            <SheetDescription>Kategori ekle veya adını değiştirmek için listeden seç.</SheetDescription>
          </SheetHeader>
          {!readOnly && <form onSubmit={submit} className="shrink-0 space-y-3 border-b pb-5"><fieldset disabled={disabled} className="space-y-3">
            <label htmlFor="category-name" className="block text-sm font-medium">
              {editing ? "Kategoriyi düzenle" : "Yeni kategori"}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="category-name"
                ref={nameInput}
                required
                maxLength={60}
                placeholder="Örn. Market, ulaşım"
                value={name}
                onChange={(event) => { setName(event.target.value); setError(""); }}
                className={inputClass}
              />
              <Button type="submit" disabled={disabled || !name.trim()} className="h-12 shrink-0 rounded-xl px-5">
                {editing ? "Kaydet" : "Ekle"}
              </Button>
            </div>
            {editing && <Button type="button" variant="ghost" className="rounded-full" onClick={() => edit()}>Vazgeç</Button>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </fieldset></form>}
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 text-xs text-muted-foreground">{categories.length} kategori</p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Button
                      type="button"
                      variant={editing === category.id ? "secondary" : "outline"}
                      aria-label={`${category.name} kategorisini düzenle`}
                      disabled={disabled || readOnly || category.automatic || category.locked}
                      aria-pressed={editing === category.id}
                      className="h-auto min-h-12 w-full justify-between gap-3 whitespace-normal rounded-xl py-3 text-left"
                      onClick={() => edit(category)}
                    >
                      <span className="min-w-0 break-words">{category.name}</span>
                      {category.automatic || category.locked ? <span className="shrink-0 text-xs text-muted-foreground">{category.automatic ? "Otomatik" : "Ortak kategori"}</span> : <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    </Button>
                  </li>
                ))}
              </ul>
              {!categories.length && <p className="py-8 text-center text-sm leading-6 text-muted-foreground">Henüz kategori yok.<br />İlk kategorini yukarıdan ekleyebilirsin.</p>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function BudgetSummary({
  readOnly = false,
  entries,
  preferences,
  month,
  onSave,
  onSaveTarget,
  disabled,
}: {
  entries: BudgetEntry[];
  preferences: BudgetPreferences;
  month: string;
  onSave: (preferences: BudgetPreferences) => Promise<boolean>;
  onSaveTarget: (cents: number) => Promise<boolean>;
  disabled: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const savings = preferences.savings[month] ?? 0;
  const target = preferences.savingsTargets?.[month] ?? 0;
  const [savingsMode, setSavingsMode] = useState<"target" | "actual">("actual");
  const hasSavings = Object.hasOwn(preferences.savings, month);
  const savingsTrigger = useRef<HTMLButtonElement>(null);
  const savingsFromModal = useRef(false);
  const comparison = savingsComparison(preferences.savings, month);
  const summaryTrigger = useRef<HTMLButtonElement>(null);
  const statementCategoryIds = preferences.categories.filter(category => isCardStatementCategory(category.name)).map(category => category.id);
  const math = monthBreakdown(entries, target, statementCategoryIds);
  const used =
    math.spendable > 0
      ? Math.min(100, Math.round((math.other / math.spendable) * 100))
      : math.other > 0
        ? 100
        : 0;
  function returnToSummary() {
    setSavingsOpen(false);
    if (savingsFromModal.current) setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const cents =
      draft === "0" || /^0+(?:,0{0,2})?$/.test(draft) ? 0 : parseAmount(draft);
    if (cents === null) return;
    const saved = savingsMode === "target" ? await onSaveTarget(cents) : await onSave({
      ...preferences, savings: { ...preferences.savings, [month]: cents },
    });
    if (saved) returnToSummary();
  }
  return (
    <>
      <BudgetCards>
      <section aria-label="Harcanabilir kalan" className="flex h-full min-w-0 flex-col gap-2 rounded-2xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {math.left < 0 ? "Bütçe açığı" : "Harcanabilir kalan"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={disabled}
            ref={summaryTrigger}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Info aria-hidden className="size-4" />
            Ay dökümü
          </Button>
        </div>
        <p
          className={`break-all text-2xl font-semibold tabular-nums ${math.left < 0 ? "text-destructive" : ""}`}
        >
          {disabled ? "—" : formatMoney(math.left)}
        </p>
        <div
          role="progressbar"
          aria-label="Harcanabilir bütçenin kullanılan oranı"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${used}%` }}
          />
        </div>
      </section>
      <section aria-label="Aylık birikim" className="flex h-full min-w-0 flex-col gap-2 rounded-2xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Bu ay biriktirdiğin</h2>
          <SavingsHistory history={comparison.history} average={comparison.average} disabled={disabled} />
        </div>
        <button ref={savingsTrigger} type="button" disabled={disabled || readOnly} aria-label={hasSavings ? "Bu ayın birikimini düzenle" : "Bu aya birikim ekle"} aria-haspopup="dialog" aria-expanded={savingsOpen}
          onClick={() => { savingsFromModal.current = false; setSavingsMode("actual"); setDraft(hasSavings ? String(savings / 100).replace(".", ",") : ""); setSavingsOpen(true); }}
          className={`flex w-fit max-w-full items-center gap-2 rounded-lg text-left text-2xl font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${hasSavings ? "text-foreground" : "text-muted-foreground"}`}>
          <span className="min-w-0 break-all">{disabled ? "—" : hasSavings ? formatMoney(savings) : readOnly ? "Henüz girilmedi" : "Birikim ekle"}</span><Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <div role="progressbar" aria-label="Geçmiş ay ortalamasına göre birikim" aria-valuemin={0} aria-valuemax={100} aria-valuenow={comparison.progress}
          aria-valuetext={comparison.percent !== null ? `Geçmiş ay ortalamasının yüzde ${comparison.percent} kadarı` : "Karşılaştırma için yeterli birikim kaydı yok"}
          className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all motion-reduce:transition-none" style={{ width: `${comparison.progress}%` }} /></div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{disabled ? "—" : comparison.average !== null ? `Ortalama: ${formatMoney(comparison.average)}` : "Henüz geçmiş ay kaydı yok"}</span>
          {!disabled && comparison.percent !== null && <span className="tabular-nums">%{comparison.percent}</span>}
        </div>
      </section>
      </BudgetCards>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          <Dialog.Content onCloseAutoFocus={(event) => {
            if (savingsOpen) event.preventDefault();
            else { event.preventDefault(); summaryTrigger.current?.focus(); }
          }} className="fixed left-1/2 top-1/2 z-60 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-6 font-dashboard text-foreground antialiased shadow-xl outline-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none">
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2 rounded-full"
                aria-label="Ay dökümünü kapat"
              >
                <X aria-hidden className="size-4" />
              </Button>
            </Dialog.Close>
            <div className="mb-5 flex flex-col items-center gap-2 px-5 pt-2 text-center">
              <ReceiptText
                aria-hidden
                className="mb-1 size-6 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Dialog.Title className="font-display text-lg font-bold tracking-tight">
                Ay dökümü
              </Dialog.Title>
              <p className="text-sm capitalize text-muted-foreground">
                {isValidMonth(month) ? new Intl.DateTimeFormat("tr-TR", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${month}-01T12:00:00`)) : "Ay seçilmedi"}
              </p>
              <Dialog.Description className="sr-only">
                Seçili ayın gelir, gider, birikim ve harcanabilir kalan dökümü.
              </Dialog.Description>
            </div>
            <dl className="space-y-4 border-y border-dashed py-5 text-sm">
              {[
                { label: "Gelir", value: math.income },
                { label: "Sabit gider", value: -math.fixed },
                { label: "Kart Ekstresi", value: -math.statements },
                { label: "Harcamalar", value: -math.other },
                { label: "Birikim hedefi", value: -target },
              ].map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-3"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 break-all text-right font-semibold tabular-nums">
                    {formatMoney(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {math.left < 0 ? "Bütçe açığı" : "Harcanabilir kalan"}
              </p>
              <p
                className={`break-all text-2xl font-semibold tabular-nums ${math.left < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {formatMoney(math.left)}
              </p>
            </div>
            <p className="py-4 text-center text-xs leading-relaxed text-muted-foreground">
              {entries.length} işlem · Hedef tutar, harcanabilir bütçeden ayrılır.
            </p>
            {!readOnly && <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => {
                savingsFromModal.current = true;
                setSavingsMode("target");
                setDraft(String(target / 100).replace(".", ","));
                setOpen(false);
                setSavingsOpen(true);
              }}
            >
              Birikim hedefini düzenle
            </Button>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Sheet open={savingsOpen} onOpenChange={(nextOpen) => {
        if (nextOpen) setSavingsOpen(true);
        else returnToSummary();
      }}>
        <SheetContent onCloseAutoFocus={(event) => { event.preventDefault(); if (!savingsFromModal.current) savingsTrigger.current?.focus(); }}>
          <SheetHeader>
            <SheetTitle>{savingsMode === "target" ? "Birikim hedefi" : "Bu ay biriktirdiğim"}</SheetTitle>
            <SheetDescription>
              {savingsMode === "target" ? "Bu bütçe döneminde biriktirmek istediğin tutarı belirle." : "Bu ay gerçekten biriktirdiğin tutarı kaydet."}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={save} className="space-y-4"><fieldset disabled={disabled} className="space-y-4">
            <BudgetAmountField
              label={savingsMode === "target" ? "Bu ay biriktirmek istediğim (₺)" : "Bu ay biriktirdiğim (₺)"}
              value={draft}
              onChange={setDraft}
              allowZero
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {savingsMode === "target" ? "Hedef tutar harcanabilir bütçenden düşülür. Gerçek birikim kaydını değiştirmez." : "Gerçek birikimin ayrı tutulur; bütçe hedefini değiştirmez. Birikim yapmadıysan sıfır girebilirsin."}
            </p>
            <Button type="submit" className="h-12 w-full rounded-full">
              Kaydet
            </Button>
          </fieldset></form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function BudgetCategoryField({
  categories,
  value,
  onChange,
}: {
  categories: BudgetCategory[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Kategori</span>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full min-w-0 justify-between rounded-xl font-normal"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {categories.find((category) => category.id === value)?.name ??
            "Kategori seç"}
        </span>
        <ChevronRight />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Kategori seç</SheetTitle>
            <SheetDescription>
              Bu işlemin hangi grupta gösterileceğini seç.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            {!categories.some(category => !category.automatic && category.name.toLocaleLowerCase("tr-TR") !== "kategorisiz") && <p className="text-sm leading-6 text-muted-foreground">Önce Kategoriler bölümünden bir kategori ekle.</p>}
            {categories.filter(category => !category.automatic && category.name.toLocaleLowerCase("tr-TR") !== "kategorisiz").map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={value === category.id ? "default" : "outline"}
                className="h-auto min-h-12 w-full justify-start whitespace-normal break-words rounded-xl py-3 text-left"
                onClick={() => {
                  onChange(category.id);
                  setOpen(false);
                }}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
