"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, Info, Settings, Trash2, Wallet, X } from "lucide-react";
import { BudgetSettingsDrawer } from "@/components/budget-settings-drawer";
import { FetchChecks } from "@/components/fetch-checks";
import { MoneyPadSheet } from "@/components/money-pad";
import { playTick } from "@/lib/play-tick";
import { last12MonthKeys } from "@/hooks/use-savings";
import { newBudgetId, useBudget } from "@/hooks/use-budget";
import { categoryCoversMonth, computeMonthBudget } from "@/lib/budget";
import type { BudgetCategory, BudgetEntry } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const SHORT_MONTHS = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTHS[(monthIndex ?? 1) - 1]} ${year}`;
}

function monthDateBounds(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const last = new Date(year, monthIndex, 0).getDate();
  return {
    min: `${month}-01`,
    max: `${month}-${String(last).padStart(2, "0")}`,
  };
}

function defaultSpentOn(month: string) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { min, max } = monthDateBounds(month);
  if (today >= min && today <= max) return today;
  return max;
}

function formatSpentOn(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [, monthIndex, day] = value.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[(monthIndex ?? 1) - 1]}`;
}

function fmt(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.001;
  return rounded.toLocaleString("tr-TR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

const CATEGORY_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-400",
  "bg-orange-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-lime-500",
];

const WISH_KEY = "sarraf-budget-wish";

function loadWishes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WISH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, number> = {};
    for (const [month, amount] of Object.entries(parsed)) {
      const value = Number(amount);
      if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(value) && value >= 0) {
        next[month] = value;
      }
    }
    return next;
  } catch {
    return {};
  }
}

interface BudgetSectionProps {
  user: User | null;
  readOnly: boolean;
}

export function BudgetSection({ user, readOnly }: BudgetSectionProps) {
  const months = useMemo(() => last12MonthKeys(), []);
  const [month, setMonth] = useState(currentMonthKey);
  const budget = useBudget(user);
  const locked = readOnly || budget.isViewer;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [wishes, setWishes] = useState(loadWishes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [pad, setPad] = useState<"wish" | "expense" | null>(null);
  const [statementPad, setStatementPad] = useState<string | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<BudgetEntry | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const activeMonth = months.includes(month) ? month : months[months.length - 1];
  const monthIndex = Math.max(0, months.indexOf(activeMonth));

  const math = computeMonthBudget({
    incomes: budget.incomes,
    fixedExpenses: budget.fixedExpenses,
    categories: budget.categories,
    entries: budget.entries,
    month: activeMonth,
    savingsAmount: wishes[activeMonth] ?? 0,
  });
  const categories = budget.categories.filter((category) => category.kind !== "statement");
  const required = budget.categories.filter(
    (category) => category.kind === "statement" && categoryCoversMonth(category, activeMonth)
  );
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0] ?? null;
  const filteredCategory = categories.find((category) => category.id === filterId) ?? null;
  const statementIds = new Set(required.map((category) => category.id));
  const statementTotal = math.monthEntries
    .filter((entry) => statementIds.has(entry.categoryId))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const categoryEntries = math.monthEntries.filter((entry) => !statementIds.has(entry.categoryId));
  const categoryExpenses = categoryEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const wish = wishes[activeMonth] ?? 0;

  const confirmReady = confirmText.trim().toLocaleLowerCase("tr") === "onaylıyorum";

  function askDelete(entry: BudgetEntry) {
    setConfirmText("");
    setConfirmEntry(entry);
  }

  function closeConfirm() {
    setConfirmEntry(null);
    setConfirmText("");
  }

  function confirmDelete() {
    if (!confirmEntry || !confirmReady) return;
    playTick();
    budget.deleteEntry(confirmEntry.id);
    closeConfirm();
  }

  function setWish(amount: number) {
    setWishes((prev) => {
      const next = { ...prev, [activeMonth]: amount };
      try {
        localStorage.setItem(WISH_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }
  const spentRatio =
    math.spendable > 0 ? Math.min(100, (math.expenses / math.spendable) * 100) : math.expenses > 0 ? 100 : 0;

  if (budget.loading) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
            <Wallet className="h-5 w-5 text-sky-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Aylık Bütçe</h2>
            <p className="truncate text-xs text-muted-foreground">Gelir, gider, harcama</p>
          </div>
        </div>
        <FetchChecks onRefetch={budget.refetch} />
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
          <Wallet className="h-5 w-5 text-sky-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Aylık Bütçe</h2>
          <p className="truncate text-xs text-muted-foreground">Gelir, gider, harcama</p>
        </div>
        <button
          type="button"
          onClick={() => {
            playTick();
            setInfoOpen(true);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Ay dökümü"
        >
          <Info className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Sabitler"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <FetchChecks onRefetch={budget.refetch} />

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Önceki ay"
          disabled={monthIndex === 0}
          onClick={() => setMonth(months[monthIndex - 1])}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium">{formatMonth(activeMonth)}</p>
        <button
          type="button"
          aria-label="Sonraki ay"
          disabled={monthIndex === months.length - 1}
          onClick={() => setMonth(months[monthIndex + 1])}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs font-medium text-muted-foreground">Kalan</p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold tracking-tight tabular-nums",
            math.left < 0 && "text-red-600"
          )}
        >
          {fmt(math.left)} ₺
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Harcanacak {fmt(math.spendable)} ₺
        </p>
        <div className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", math.left < 0 ? "bg-red-500" : "bg-emerald-500")}
            style={{ width: `${spentRatio}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={() => {
          playTick();
          setPad("wish");
        }}
        className="mt-5 flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left disabled:opacity-70"
      >
        <span className="text-sm text-muted-foreground">Biriktirmek istediğim</span>
        <span className={cn("text-sm font-medium tabular-nums", wish === 0 && "text-muted-foreground")}>
          {wish > 0 ? `${fmt(wish)} ₺` : "Tutar gir"}
        </span>
      </button>

      {required.length > 0 && (
        <div className="mt-6">
          <BlockTitle title="Ekstre" hint="Kalan paradan düşer" total={statementTotal} />
          <div className="mt-3 space-y-2">
            {required.map((category) => {
              const saved = math.monthEntries.find((entry) => entry.categoryId === category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    playTick();
                    setStatementPad(category.id);
                  }}
                  className="flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left disabled:opacity-70"
                >
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{category.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      saved == null && "text-muted-foreground"
                    )}
                  >
                    {saved != null ? `${fmt(saved.amount)} ₺` : "Tutar gir"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <BlockTitle
          title="Giderler"
          hint="Harcanacak paradan düşer"
          total={categoryExpenses}
        />
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playTick();
                setFilterId(null);
              }}
              className={cn(
                "flex h-11 items-center rounded-full px-3.5 text-sm font-medium",
                filterId === null ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}
            >
              Tümü
            </button>
            {categories.map((category) => {
              const active = filterId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    playTick();
                    setSelectedId(category.id);
                    setFilterId((current) => (current === category.id ? null : category.id));
                  }}
                  className={cn(
                    "flex h-11 max-w-48 items-center rounded-full px-3.5 text-sm font-medium",
                    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="truncate">{category.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {filteredCategory && !locked && (
          <button
            type="button"
            onClick={() => {
              const storedCount = budget.entries.filter(
                (entry) => entry.categoryId === filteredCategory.id
              ).length;
              if (
                storedCount > 0 &&
                !window.confirm("Bu kategori ve tüm aylardaki giderleri silinsin mi?")
              ) {
                return;
              }
              playTick();
              budget.deleteCategory(filteredCategory.id);
              setSelectedId(null);
              setFilterId(null);
            }}
            className="mt-1 flex h-11 items-center text-sm text-muted-foreground"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {filteredCategory.name} kategorisini sil
          </button>
        )}
        {!locked && selected && (
          <button
            type="button"
            onClick={() => {
              playTick();
              setPad("expense");
            }}
            className="mt-3 flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-foreground px-3.5 text-background"
          >
            <span className="text-sm font-medium">Hareket ekle</span>
            <span className="truncate text-sm text-background/70">{selected.name}</span>
          </button>
        )}
        {!locked && categories.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Hareket girmek için önce bir kategori ekle.
          </p>
        )}
        <AddNameForm
          readOnly={locked}
          onAdd={(name) => {
            playTick();
            const id = newBudgetId();
            budget.saveCategory({ id, name, kind: "custom", validFrom: null, validTo: null });
            setSelectedId(id);
            setFilterId(id);
          }}
        />
        <SpendBreakdown
          categories={categories}
          entries={categoryEntries}
          filterId={filterId}
          total={categoryExpenses}
          locked={locked}
          onDelete={askDelete}
        />
      </div>

      <Dialog.Root open={infoOpen} onOpenChange={setInfoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none duration-200 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setInfoOpen(false);
            }}
          >
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-2xl border bg-background p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1.5">
                  <Dialog.Title className="text-sm font-semibold">Ay dökümü</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                    {formatMonth(activeMonth)}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>

              <p className="mt-4 text-xs font-medium text-muted-foreground">Kalan</p>
              <p
                className={cn(
                  "mt-1 text-[2rem] font-semibold leading-none tracking-tight tabular-nums",
                  math.left < 0 && "text-red-600"
                )}
              >
                {fmt(math.left)} ₺
              </p>

              <div className="mt-5 overflow-hidden rounded-xl bg-muted/60">
                <BreakdownRow label="Sabit gelir" value={math.income} />
                <BreakdownRow label="Sabit gider" value={-math.fixed} />
                <BreakdownRow label="Kalan para" value={math.remaining} result />
                {math.remaining < 0 && (
                  <p className="px-3 pb-2.5 text-xs text-red-600">Sabit gider, geliri aşıyor.</p>
                )}
                <BreakdownRow label="Biriktirmek istediğim" value={-wish} />
                <BreakdownRow label="Harcanacak" value={math.spendable} result />
                {wish > math.remaining && math.remaining >= 0 && (
                  <p className="px-3 pb-2.5 text-xs text-red-600">
                    Biriktirmek istediğin, kalan paradan büyük.
                  </p>
                )}
                <BreakdownRow label="Ekstre" value={-statementTotal} />
                <BreakdownRow label="Giderler" value={-categoryExpenses} />
                <BreakdownRow label="Kalan" value={math.left} result />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={confirmEntry !== null} onOpenChange={(open) => !open && closeConfirm()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none duration-200 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeConfirm();
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1.5">
                  <Dialog.Title className="text-sm font-semibold">Hareketi sil</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    {confirmEntry
                      ? `${confirmEntry.label.trim() || "Hareket"} · ${fmt(confirmEntry.amount)} ₺`
                      : "Bu hareket silinecek."}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs text-muted-foreground">
                  Silmek için onaylıyorum yaz
                </span>
                <input
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="onaylıyorum"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  className="h-11 w-full rounded-xl border bg-transparent px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <button
                type="submit"
                disabled={!confirmReady}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-medium text-white disabled:opacity-40"
              >
                Sil
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <BudgetSettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        readOnly={locked}
        defaultMonth={activeMonth}
        incomes={budget.incomes}
        fixedExpenses={budget.fixedExpenses}
        onSaveIncome={budget.saveIncome}
        onDeleteIncome={budget.deleteIncome}
        onSaveFixed={budget.saveFixed}
        onDeleteFixed={budget.deleteFixed}
        categories={budget.categories}
        onSaveCategory={budget.saveCategory}
        onDeleteCategory={budget.deleteCategory}
      />
      <MoneyPadSheet
        open={pad === "wish"}
        title="Biriktirmek istediğim"
        hint={wish > 0 ? `Şu an ${fmt(wish)} ₺` : "Kalan paradan düşer"}
        allowZero
        onOpenChange={(open) => setPad(open ? "wish" : null)}
        onConfirm={setWish}
      />
      <MoneyPadSheet
        open={statementPad !== null}
        title={budget.categories.find((category) => category.id === statementPad)?.name ?? "Ekstre"}
        hint="Bu ay girilmesi zorunlu"
        allowZero
        onOpenChange={(open) => {
          if (!open) setStatementPad(null);
        }}
        onConfirm={(amount) => {
          const category = budget.categories.find((item) => item.id === statementPad);
          if (!category) return;
          const existing = budget.entries.find(
            (entry) => entry.categoryId === category.id && entry.month === activeMonth
          );
          budget.saveEntry({
            id: existing?.id ?? newBudgetId(),
            month: activeMonth,
            categoryId: category.id,
            label: category.name,
            amount,
            spentOn: null,
          });
        }}
      />
      <MoneyPadSheet
        open={pad === "expense"}
        title={selected?.name ?? "Gider"}
        onOpenChange={(open) => setPad(open ? "expense" : null)}
        namePlaceholder="İşlem adı"
        defaultDate={defaultSpentOn(activeMonth)}
        dateMin={monthDateBounds(activeMonth).min}
        dateMax={monthDateBounds(activeMonth).max}
        onConfirm={(amount, name, spentOn) => {
          if (!selected || amount <= 0) return;
          const bounds = monthDateBounds(activeMonth);
          const date = spentOn >= bounds.min && spentOn <= bounds.max ? spentOn : bounds.max;
          budget.saveEntry({
            id: newBudgetId(),
            month: activeMonth,
            categoryId: selected.id,
            label: name || selected.name,
            amount,
            spentOn: date,
          });
        }}
      />
    </section>
  );
}

function BreakdownRow({
  label,
  value,
  result,
}: {
  label: string;
  value: number;
  result?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-3 py-2.5",
        result && "border-t border-border/70 font-semibold"
      )}
    >
      <span className={cn("text-sm", !result && "text-muted-foreground")}>{label}</span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums tracking-tight",
          result && value < 0 && "text-red-600"
        )}
      >
        {value < 0 ? "−" : ""}
        {fmt(Math.abs(value))} ₺
      </span>
    </div>
  );
}

function SpendBreakdown({
  categories,
  entries,
  filterId,
  total,
  locked,
  onDelete,
}: {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  filterId: string | null;
  total: number;
  locked: boolean;
  onDelete: (entry: BudgetEntry) => void;
}) {
  const slices = categories.flatMap((category, index) => {
    const amount = entries
      .filter((entry) => entry.categoryId === category.id)
      .reduce((sum, entry) => sum + entry.amount, 0);
    if (amount <= 0) return [];
    return [{ category, amount, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }];
  });

  const shown = (filterId ? entries.filter((entry) => entry.categoryId === filterId) : entries)
    .slice()
    .sort((a, b) => (b.spentOn ?? "").localeCompare(a.spentOn ?? ""));

  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Bu ay henüz gider yok</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">Toplam harcama</p>
        <p className="text-sm font-semibold tabular-nums">{fmt(total)} ₺</p>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted">
        {slices.map((slice) => (
          <div
            key={slice.category.id}
            className={cn("h-full", slice.color)}
            style={{ width: `${total > 0 ? (slice.amount / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {slices.map((slice) => (
          <span key={slice.category.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("size-2 rounded-full", slice.color)} />
            {slice.category.name}
          </span>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Bu kategoride hareket yok</p>
      ) : (
      <ul className="mt-2">
        {shown.map((entry) => {
          const category = categories.find((item) => item.id === entry.categoryId);
          const title = entry.label.trim() || category?.name || "Gider";
          const when = formatSpentOn(entry.spentOn);
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{category?.name ?? "Gider"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                  −{fmt(entry.amount)} ₺
                </p>
                <p className="text-[11px] text-muted-foreground">{when ?? "Tarih yok"}</p>
              </div>
            </>
          );
          if (locked) {
            return (
              <li key={entry.id} className="flex items-center gap-3 py-3">
                {body}
              </li>
            );
          }
          if (reducedMotion) {
            return (
              <li key={entry.id} className="flex items-center gap-3 py-1.5">
                {body}
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  className="flex h-11 shrink-0 items-center px-1 text-sm font-medium text-red-600"
                >
                  Sil
                </button>
              </li>
            );
          }
          return (
            <SwipeRow
              key={entry.id}
              open={openId === entry.id}
              onOpenChange={(next) => setOpenId(next ? entry.id : null)}
              onDelete={() => onDelete(entry)}
            >
              {body}
            </SwipeRow>
          );
        })}
      </ul>
      )}
    </div>
  );
}

function BlockTitle({
  title,
  hint,
  total,
}: {
  title: string;
  hint: string;
  total: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums">{fmt(total)} ₺</p>
    </div>
  );
}

function AddNameForm({
  readOnly,
  onAdd,
}: {
  readOnly: boolean;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const nextName = name.trim().replace(/\s+/g, " ");
  if (readOnly) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!nextName) return;
    onAdd(nextName);
    setName("");
  }

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Yeni kategori"
        aria-label="Yeni kategori"
        maxLength={60}
        enterKeyHint="done"
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        disabled={!nextName}
        className="flex h-11 shrink-0 items-center rounded-xl bg-muted px-4 text-sm font-medium text-foreground disabled:opacity-40"
      >
        Ekle
      </button>
    </form>
  );
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const REVEAL = 88;

function rubber(overshoot: number, size: number) {
  const constant = 0.55;
  return (overshoot * size * constant) / (size + constant * Math.abs(overshoot));
}

function SwipeRow({
  open,
  onOpenChange,
  onDelete,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const face = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: number;
    armed: boolean;
    points: { x: number; t: number }[];
  } | null>(null);

  function place(x: number, animate: boolean) {
    const el = face.current;
    if (!el) return;
    el.style.transition = animate ? "transform 220ms var(--ease-out)" : "none";
    el.style.transform = `translate3d(${x}px,0,0)`;
  }

  useEffect(() => {
    if (drag.current?.armed) return;
    place(open ? -REVEAL : 0, true);
  }, [open]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: open ? -REVEAL : 0,
      armed: false,
      points: [{ x: event.clientX, t: Date.now() }],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.armed) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      current.armed = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const width = event.currentTarget.offsetWidth || 1;
    let x = current.origin + dx;
    if (x > 0) x = rubber(x, width);
    else if (x < -REVEAL) x = -REVEAL - rubber(-REVEAL - x, width);
    place(x, false);
    current.points.push({ x: event.clientX, t: Date.now() });
    if (current.points.length > 5) current.points.shift();
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!current.armed) {
      if (open) onOpenChange(false);
      return;
    }
    const dx = event.clientX - current.startX;
    const width = event.currentTarget.offsetWidth || 1;
    let x = current.origin + dx;
    if (x > 0) x = rubber(x, width);
    else if (x < -REVEAL) x = -REVEAL - rubber(-REVEAL - x, width);
    const recent = current.points.slice(-4);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.t - first.t;
    const velocity = dt > 0 ? (last.x - first.x) / dt : 0;
    const flickedLeft = velocity < -0.11 && dx < -24;
    if (x < -REVEAL - 36 || (flickedLeft && x < -REVEAL)) {
      place(0, false);
      onOpenChange(false);
      onDelete();
      return;
    }
    if (x < -REVEAL / 2 || flickedLeft) {
      place(-REVEAL, true);
      onOpenChange(true);
      return;
    }
    place(0, true);
    onOpenChange(false);
  }

  return (
    <li
      data-row-swipe=""
      className="relative overflow-hidden"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          place(0, false);
          onOpenChange(false);
          onDelete();
        }}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-600 text-sm font-medium text-white"
      >
        Sil
      </button>
      <div
        ref={face}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = null;
          place(open ? -REVEAL : 0, true);
        }}
        className="relative flex touch-pan-y items-center gap-3 bg-card py-3"
      >
        {children}
      </div>
    </li>
  );
}
