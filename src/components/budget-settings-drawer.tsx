"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { Plus, Trash2, X } from "lucide-react";
import { newBudgetId } from "@/hooks/use-budget";
import { MoneyPadSheet } from "@/components/money-pad";
import { playTick } from "@/lib/play-tick";
import type { BudgetCategory, BudgetItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
          <div className="px-5 pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">Ayarlar</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </Dialog.Close>
            </div>
          </div>
          <div className="space-y-8 overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
            <StatementList
              items={statements}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveCategory}
              onDelete={onDeleteCategory}
            />
          </div>
          <Dialog.Description className="sr-only">
            Sabit gelir, sabit gider ve ekstre dönemlerini düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted-foreground">Başlangıç</span>
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
          Bitiş
          <span>Boşsa sürer</span>
        </span>
        <input
          type="month"
          value={to}
          readOnly={readOnly}
          onChange={(event) => onTo(event.target.value)}
          className={fieldClass}
        />
      </label>
      {invalid && (
        <p className="text-xs text-red-600">Bitiş, başlangıçtan önce olamaz.</p>
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
        hint="Dönemi burada. Tutarı bütçe sayfasındaki satırdan girersin."
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
        <form onSubmit={add} className="space-y-2 rounded-2xl border border-dashed p-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ekstre adı"
            aria-label="Ekstre adı"
            autoComplete="off"
            enterKeyHint="done"
            className={fieldClass}
          />
          <MonthFields from={from} to={to} readOnly={false} onFrom={setFrom} onTo={setTo} />
          <button
            type="submit"
            disabled={!canAdd}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background disabled:opacity-40"
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
    <div className="space-y-2 rounded-2xl border p-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          readOnly={readOnly}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (!clean(name)) setName(item.name);
            else save({ name });
          }}
          aria-label="Ekstre adı"
          autoComplete="off"
          enterKeyHint="done"
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        {!readOnly && (
          <DeleteButton
            label="Ekstre sil"
            confirm="Bu ekstre silinsin mi?"
            onDelete={onDelete}
          />
        )}
      </div>
      <MonthFields
        from={from}
        to={to}
        readOnly={readOnly}
        onFrom={(value) => {
          setFrom(value);
          save({ from: value });
        }}
        onTo={(value) => {
          setTo(value);
          save({ to: value });
        }}
      />
    </div>
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
    <div className="space-y-2 rounded-2xl border p-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          readOnly={readOnly}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (!clean(name)) setName(item.name);
            else save({ name });
          }}
          aria-label="Ad"
          autoComplete="off"
          enterKeyHint="done"
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        {!readOnly && (
          <DeleteButton label="Sil" confirm="Bu kayıt silinsin mi?" onDelete={onDelete} />
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
        onFrom={(value) => {
          setFrom(value);
          save({ from: value });
        }}
        onTo={(value) => {
          setTo(value);
          save({ to: value });
        }}
      />
      <MoneyPadSheet
        open={padOpen}
        title={clean(name) || "Tutar"}
        hint={amount > 0 ? `Şu an ${fmt(amount)} ₺` : undefined}
        onOpenChange={setPadOpen}
        onConfirm={(next) => {
          setAmount(next);
          save({ amount: next });
        }}
      />
    </div>
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
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-dashed p-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
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
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background disabled:opacity-40"
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
