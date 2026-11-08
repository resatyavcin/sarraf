"use client";

import { useState, type FormEvent } from "react";
import { Dialog, Tabs } from "radix-ui";
import { Plus, Trash2, X } from "lucide-react";
import { newBudgetId } from "@/hooks/use-budget";
import { MoneyPadSheet } from "@/components/money-pad";
import { playTick } from "@/lib/play-tick";
import type { BudgetCategory, BudgetItem } from "@/lib/types";
import { itemCoversMonth } from "@/lib/budget";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full rounded-xl border bg-transparent px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

function fmt(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

interface BudgetSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
  defaultMonth: string;
  incomes: BudgetItem[];
  fixedExpenses: BudgetItem[];
  categories: BudgetCategory[];
  onSaveIncome: (item: BudgetItem) => void;
  onDeleteIncome: (id: string) => void;
  onSaveFixed: (item: BudgetItem) => void;
  onDeleteFixed: (id: string) => void;
  onSaveCategory: (category: BudgetCategory) => void;
  onDeleteCategory: (id: string) => void;
}

export function BudgetSettingsDrawer({
  open,
  onOpenChange,
  readOnly,
  defaultMonth,
  incomes,
  fixedExpenses,
  categories,
  onSaveIncome,
  onDeleteIncome,
  onSaveFixed,
  onDeleteFixed,
  onSaveCategory,
  onDeleteCategory,
}: BudgetSettingsDrawerProps) {
  const statements = categories.filter((category) => category.kind === "statement");
  const incomeTotal = incomes.filter((item) => itemCoversMonth(item, defaultMonth)).reduce((sum, item) => sum + item.amount, 0);
  const fixedTotal = fixedExpenses.filter((item) => itemCoversMonth(item, defaultMonth)).reduce((sum, item) => sum + item.amount, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="sarraf-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-3xl border-t bg-background shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
          <div className="shrink-0 border-b px-5 pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <div className="mb-4 flex items-center justify-between">
              <div><Dialog.Title className="text-lg font-semibold">Bütçe ayarları</Dialog.Title><p className="mt-1 text-xs text-muted-foreground">Gelirlerini ve düzenli ödemelerini yönet</p></div>
              <Dialog.Close aria-label="Ayarları kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="my-4 rounded-2xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">{periodLabel(defaultMonth)} dönemi</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Sabit gelir</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{fmt(incomeTotal)} ₺</p></div>
                <div className="border-l pl-3"><p className="text-xs text-muted-foreground">Sabit gider</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{fmt(fixedTotal)} ₺</p></div>
              </div>
              <p className="mt-3 border-t pt-3 text-xs leading-5 text-muted-foreground">Dönemler önceki ayın 24’ünde başlar, seçilen ayın 23’ünde biter. Bitiş dönemini boş bırakırsan kayıt devam eder.</p>
            </div>
            {readOnly && <p className="mb-4 rounded-xl border p-3 text-sm text-muted-foreground">Paylaşılan hesabı görüntülüyorsun. Ayarlar salt okunur.</p>}
            <Tabs.Root key={defaultMonth} defaultValue="income">
              <Tabs.List aria-label="Bütçe ayarları" className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {[["income", "Gelirler", incomes.length], ["fixed", "Giderler", fixedExpenses.length], ["statements", "Ekstreler", statements.length]].map(([value, label, count]) => <Tabs.Trigger key={value} value={String(value)} className="min-h-11 rounded-lg px-1 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label} <span className="ml-1 text-xs opacity-60">{count}</span></Tabs.Trigger>)}
              </Tabs.List>
              <Tabs.Content value="income" forceMount className="data-[state=inactive]:hidden outline-none">
            <FixedList
              title="Sabit gelirler"
              hint="Seçtiğin aylarda gelire eklenir."
              placeholder="Maaş"
              empty="Henüz gelir yok"
              items={incomes}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveIncome}
              onDelete={onDeleteIncome}
            />
              </Tabs.Content>
              <Tabs.Content value="fixed" forceMount className="data-[state=inactive]:hidden outline-none">
            <FixedList
              title="Sabit giderler"
              hint="Seçtiğin aylarda gider olarak düşer."
              placeholder="Kira"
              empty="Henüz gider yok"
              items={fixedExpenses}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveFixed}
              onDelete={onDeleteFixed}
            />
              </Tabs.Content>
              <Tabs.Content value="statements" forceMount className="data-[state=inactive]:hidden outline-none">
            <StatementList
              items={statements}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveCategory}
              onDelete={onDeleteCategory}
            />
              </Tabs.Content>
            </Tabs.Root>
          </div>
          <Dialog.Description className="sr-only">
            Sabit gelir, sabit gider ve ekstre dönemlerini düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function periodLabel(month: string) {
  if (!month) return "Belirtilmemiş";
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}

function RecordSummary({ name, from, to, amount }: { name: string; from: string | null; to: string | null; amount?: number }) {
  return <summary className="flex min-h-20 cursor-pointer items-center justify-between gap-3 p-4 marker:content-none">
    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{name}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{periodLabel(from ?? "")} · {to ? `${periodLabel(to)} sonuna kadar` : "Devam ediyor"}</span></span>
    <span className="shrink-0 text-right">{amount !== undefined && <span className="block text-sm font-semibold tabular-nums">{fmt(amount)} ₺</span>}<span className="mt-1 block text-xs text-muted-foreground">Detaylar ↓</span></span>
  </summary>;
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MonthFields({
  from,
  to,
  readOnly,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  readOnly: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const invalid = Boolean(from && to && to < from);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted-foreground">İlk dönem</span>
        <input
          type="month"
          value={from}
          readOnly={readOnly}
          onChange={(event) => onFrom(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
          Son dönem
          <span>İsteğe bağlı</span>
        </span>
        <input
          type="month"
          value={to}
          min={from || undefined}
          readOnly={readOnly}
          onChange={(event) => onTo(event.target.value)}
          className={fieldClass}
        />
      </label>
      {invalid && (
        <p role="alert" className="text-xs text-red-600 sm:col-span-2">Bitiş, başlangıçtan önce olamaz.</p>
      )}
    </div>
  );
}

function StatementList({
  items,
  readOnly,
  defaultMonth,
  onSave,
  onDelete,
}: {
  items: BudgetCategory[];
  readOnly: boolean;
  defaultMonth: string;
  onSave: (category: BudgetCategory) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(defaultMonth);
  const [to, setTo] = useState("");
  const nextTo = to || null;
  const invalid = Boolean(from && nextTo && nextTo < from);
  const canAdd = Boolean(clean(name) && from && !invalid);

  function add(event: FormEvent) {
    event.preventDefault();
    if (!canAdd || !from) return;
    playTick();
    onSave({
      id: newBudgetId(),
      name: clean(name),
      kind: "statement",
      validFrom: from,
      validTo: nextTo,
    });
    setName("");
    setTo("");
    setFrom(defaultMonth);
  }

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Ekstreler"
        hint="Ekstrenin geçerli olduğu dönemleri belirle. Her dönemin tutarını bütçe kartından gir."
      />
      {items.length === 0 && <p className="text-sm text-muted-foreground">Henüz ekstre yok</p>}
      {items.map((item) => (
        <StatementEditor
          key={item.id}
          item={item}
          readOnly={readOnly}
          onSave={onSave}
          onDelete={() => onDelete(item.id)}
        />
      ))}
      {!readOnly && (
        <form onSubmit={add} className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-4">
          <h4 className="text-sm font-semibold">Yeni ekstre</h4>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ekstre adı"
            maxLength={60}
          aria-label="Ekstre adı"
            autoComplete="off"
            enterKeyHint="done"
            className={fieldClass}
          />
          <MonthFields from={from} to={to} readOnly={false} onFrom={setFrom} onTo={setTo} />
          <button
            type="submit"
            disabled={!canAdd}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </form>
      )}
    </section>
  );
}

function StatementEditor({
  item,
  readOnly,
  onSave,
  onDelete,
}: {
  item: BudgetCategory;
  readOnly: boolean;
  onSave: (category: BudgetCategory) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [from, setFrom] = useState(item.validFrom ?? "");
  const [to, setTo] = useState(item.validTo ?? "");

  function save(next: { name?: string; from?: string; to?: string }) {
    const nextName = clean(next.name ?? name);
    const nextFrom = next.from ?? from;
    const nextTo = (next.to ?? to) || null;
    if (!nextName || !nextFrom || (nextTo && nextTo < nextFrom)) return;
    if (nextName === item.name && nextFrom === item.validFrom && nextTo === item.validTo) return;
    onSave({ ...item, name: nextName, validFrom: nextFrom, validTo: nextTo });
  }

  return (
    <details className="rounded-2xl border">
      <RecordSummary name={item.name} from={item.validFrom} to={item.validTo} />
      <div className="space-y-4 border-t p-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          readOnly={readOnly}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          aria-label="Ekstre adı"
          autoComplete="off"
          enterKeyHint="done"
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        {!readOnly && (
          <DeleteButton
            label="Ekstre sil"
            confirm="Bu ekstre ve tüm dönemlerdeki hareketleri silinecek. Devam edilsin mi?"
            onDelete={onDelete}
          />
        )}
      </div>
      <MonthFields
        from={from}
        to={to}
        readOnly={readOnly}
        onFrom={setFrom}
        onTo={setTo}
      />
      {!readOnly && <button type="button" disabled={!clean(name) || !from || Boolean(to && to < from) || (clean(name) === item.name && from === item.validFrom && (to || null) === item.validTo)} onClick={() => save({})} className="min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">Değişiklikleri kaydet</button>}
      </div>
    </details>
  );
}

function FixedList({
  title,
  hint,
  placeholder,
  empty,
  items,
  readOnly,
  defaultMonth,
  onSave,
  onDelete,
}: {
  title: string;
  hint: string;
  placeholder: string;
  empty: string;
  items: BudgetItem[];
  readOnly: boolean;
  defaultMonth: string;
  onSave: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <SectionTitle title={title} hint={hint} />
      {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {items.map((item) => (
        <FixedEditor
          key={item.id}
          item={item}
          readOnly={readOnly}
          onSave={onSave}
          onDelete={() => onDelete(item.id)}
        />
      ))}
      <AddFixedForm
        key={defaultMonth}
        readOnly={readOnly}
        placeholder={placeholder}
        defaultMonth={defaultMonth}
        onAdd={(item) => onSave({ ...item, id: newBudgetId() })}
      />
    </section>
  );
}

function FixedEditor({
  item,
  readOnly,
  onSave,
  onDelete,
}: {
  item: BudgetItem;
  readOnly: boolean;
  onSave: (item: BudgetItem) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount);
  const [from, setFrom] = useState(item.validFrom);
  const [to, setTo] = useState(item.validTo ?? "");
  const [padOpen, setPadOpen] = useState(false);

  function save(next: { name?: string; amount?: number; from?: string; to?: string }) {
    const nextName = clean(next.name ?? name);
    const nextAmount = next.amount ?? amount;
    const nextFrom = next.from ?? from;
    const nextTo = (next.to ?? to) || null;
    if (!nextName || !nextFrom || (nextTo && nextTo < nextFrom)) return;
    if (
      nextName === item.name &&
      nextAmount === item.amount &&
      nextFrom === item.validFrom &&
      nextTo === item.validTo
    ) {
      return;
    }
    onSave({ ...item, name: nextName, amount: nextAmount, validFrom: nextFrom, validTo: nextTo });
  }

  return (
    <details className="rounded-2xl border">
      <RecordSummary name={item.name} from={item.validFrom} to={item.validTo} amount={item.amount} />
      <div className="space-y-4 border-t p-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          readOnly={readOnly}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          aria-label="Ad"
          autoComplete="off"
          enterKeyHint="done"
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        {!readOnly && (
          <DeleteButton label="Sil" confirm="Bu kayıt tüm dönemlerden kaldırılacak. Devam edilsin mi?" onDelete={onDelete} />
        )}
      </div>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          playTick();
          setPadOpen(true);
        }}
        className="flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left disabled:opacity-70"
      >
        <span className="text-sm text-muted-foreground">Tutar</span>
        <span className="text-sm font-medium tabular-nums">{fmt(amount)} ₺</span>
      </button>
      <MonthFields
        from={from}
        to={to}
        readOnly={readOnly}
        onFrom={setFrom}
        onTo={setTo}
      />
      <MoneyPadSheet
        open={padOpen}
        title={clean(name) || "Tutar"}
        hint={amount > 0 ? `Şu an ${fmt(amount)} ₺` : undefined}
        onOpenChange={setPadOpen}
        onConfirm={(next) => {
          setAmount(next);
        }}
      />
      {!readOnly && <button type="button" disabled={!clean(name) || !from || Boolean(to && to < from) || (clean(name) === item.name && amount === item.amount && from === item.validFrom && (to || null) === item.validTo)} onClick={() => save({})} className="min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">Değişiklikleri kaydet</button>}
      </div>
    </details>
  );
}

function AddFixedForm({
  readOnly,
  placeholder,
  defaultMonth,
  onAdd,
}: {
  readOnly: boolean;
  placeholder: string;
  defaultMonth: string;
  onAdd: (item: Omit<BudgetItem, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState(defaultMonth);
  const [to, setTo] = useState("");
  const [padOpen, setPadOpen] = useState(false);
  const nextTo = to || null;
  const invalid = Boolean(from && nextTo && nextTo < from);
  const canAdd = Boolean(clean(name) && from && amount > 0 && !invalid);

  if (readOnly) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canAdd || !from) return;
    playTick();
    onAdd({
      name: clean(name),
      amount,
      validFrom: from,
      validTo: nextTo,
    });
    setName("");
    setAmount(0);
    setTo("");
    setFrom(defaultMonth);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-4">
      <h4 className="text-sm font-semibold">Yeni kayıt ekle</h4>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => {
          playTick();
          setPadOpen(true);
        }}
        className="flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left"
      >
        <span className="text-sm text-muted-foreground">Tutar</span>
        <span className={cn("text-sm font-medium tabular-nums", amount === 0 && "text-muted-foreground")}>
          {amount > 0 ? `${fmt(amount)} ₺` : "Tutar gir"}
        </span>
      </button>
      <MonthFields from={from} to={to} readOnly={false} onFrom={setFrom} onTo={setTo} />
      <button
        type="submit"
        disabled={!canAdd}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Ekle
      </button>
      <MoneyPadSheet
        open={padOpen}
        title={placeholder}
        onOpenChange={setPadOpen}
        onConfirm={setAmount}
      />
    </form>
  );
}

function DeleteButton({
  label,
  confirm,
  onDelete,
}: {
  label: string;
  confirm: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        playTick();
        onDelete();
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
