"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, Info, Plus, Settings, Trash2, Wallet, X } from "lucide-react";
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

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTHS[(monthIndex ?? 1) - 1]} ${year}`;
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

const fieldClass =
  "h-10 rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

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
  const [pad, setPad] = useState<"wish" | "expense" | null>(null);
  const [statementPad, setStatementPad] = useState<string | null>(null);
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
  const statementIds = new Set(required.map((category) => category.id));
  const statementTotal = math.monthEntries
    .filter((entry) => statementIds.has(entry.categoryId))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const categoryEntries = math.monthEntries.filter((entry) => !statementIds.has(entry.categoryId));
  const categoryExpenses = categoryEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const wish = wishes[activeMonth] ?? 0;

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
          onClick={() => setInfoOpen(true)}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = selected?.id === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  playTick();
                  setSelectedId(category.id);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {category.name}
              </button>
            );
          })}
          {selected && !locked && (
            <button
              type="button"
              aria-label="Kategoriyi sil"
              onClick={() => {
                const storedCount = budget.entries.filter(
                  (entry) => entry.categoryId === selected.id
                ).length;
                if (
                  storedCount > 0 &&
                  !window.confirm("Bu kategori ve tüm aylardaki giderleri silinsin mi?")
                ) {
                  return;
                }
                playTick();
                budget.deleteCategory(selected.id);
                setSelectedId(null);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <AddNameForm
          readOnly={locked}
          placeholder="Kategori ekle"
          onAdd={(name) => {
            playTick();
            const id = newBudgetId();
            budget.saveCategory({ id, name, kind: "custom", validFrom: null, validTo: null });
            setSelectedId(id);
          }}
        />
        {!locked && (
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              playTick();
              setPad("expense");
            }}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-foreground text-sm font-medium text-background disabled:opacity-40"
          >
            {selected ? `${selected.name} ekle` : "Önce kategori seç"}
          </button>
        )}
        <SpendBreakdown
          categories={categories}
          entries={categoryEntries}
          total={categoryExpenses}
          locked={locked}
          onDelete={(id) => {
            playTick();
            budget.deleteEntry(id);
          }}
        />
      </div>

      <Dialog.Root open={infoOpen} onOpenChange={setInfoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setInfoOpen(false);
            }}
          >
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-2xl border bg-background p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Dialog.Title className="text-base font-semibold">
                  {formatMonth(activeMonth)}
                </Dialog.Title>
                <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Dialog.Close>
              </div>
              <div className="space-y-1">
                <FlowLine label="Sabit gelir" value={math.income} />
                <FlowLine label="Sabit gider" value={-math.fixed} />
                <FlowLine label="Kalan para" value={math.remaining} strong />
                <FlowLine label="Biriktirmek istediğim" value={-wish} />
                <FlowLine label="Harcanacak" value={math.spendable} strong />
                <FlowLine label="Ekstre" value={-statementTotal} />
                <FlowLine label="Giderler" value={-categoryExpenses} />
              </div>
              {math.remaining < 0 && (
                <p className="mt-3 text-xs text-red-600">Sabit gider, geliri aşıyor.</p>
              )}
              {wish > math.remaining && math.remaining >= 0 && (
                <p className="mt-3 text-xs text-red-600">
                  Biriktirmek istediğin, kalan paradan büyük.
                </p>
              )}
              <Dialog.Description className="sr-only">
                Bu ayın gelir, gider ve kalan para dökümü
              </Dialog.Description>
            </div>
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
          });
        }}
      />
      <MoneyPadSheet
        open={pad === "expense"}
        title={selected?.name ?? "Gider"}
        onOpenChange={(open) => setPad(open ? "expense" : null)}
        namePlaceholder="İşlem adı"
        onConfirm={(amount, name) => {
          if (!selected || amount <= 0) return;
          budget.saveEntry({
            id: newBudgetId(),
            month: activeMonth,
            categoryId: selected.id,
            label: name || selected.name,
            amount,
          });
        }}
      />
    </section>
  );
}

function FlowLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1", strong && "font-semibold")}>
      <span className={cn("text-sm", !strong && "text-muted-foreground")}>{label}</span>
      <span
        className={cn(
          "text-sm tabular-nums",
          value > 0 && "text-emerald-600 dark:text-emerald-400",
          value < 0 && "text-red-600 dark:text-red-400"
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
  total,
  locked,
  onDelete,
}: {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  total: number;
  locked: boolean;
  onDelete: (id: string) => void;
}) {
  const slices = categories.flatMap((category, index) => {
    const amount = entries
      .filter((entry) => entry.categoryId === category.id)
      .reduce((sum, entry) => sum + entry.amount, 0);
    if (amount <= 0) return [];
    return [{ category, amount, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }];
  });

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
      <ul className="mt-2">
        {[...entries].reverse().map((entry) => {
          const category = categories.find((item) => item.id === entry.categoryId);
          const title = entry.label.trim() || category?.name || "Gider";
          return (
            <li key={entry.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{category?.name ?? "Gider"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                  −{fmt(entry.amount)} ₺
                </p>
                <p className="text-[11px] text-muted-foreground">Gider</p>
              </div>
              {!locked && (
                <button
                  type="button"
                  aria-label="Sil"
                  onClick={() => onDelete(entry.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
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
  placeholder,
  onAdd,
}: {
  readOnly: boolean;
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");
  if (readOnly) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim().replace(/\s+/g, " ");
    if (!nextName) return;
    onAdd(nextName);
    setName("");
  }

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(fieldClass, "min-w-0 flex-1")}
      />
      <button
        type="submit"
        aria-label="Kategori ekle"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-colors hover:bg-foreground/90"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  );
}
