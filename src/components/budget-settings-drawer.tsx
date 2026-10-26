"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { Plus, Trash2, X } from "lucide-react";
import { newBudgetId } from "@/hooks/use-budget";
import { MoneyPadSheet } from "@/components/money-pad";
import { playTick } from "@/lib/play-tick";
import type { BudgetItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

function fmt(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

interface BudgetSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
  defaultMonth: string;
  incomes: BudgetItem[];
  fixedExpenses: BudgetItem[];
  onSaveIncome: (item: BudgetItem) => void;
  onDeleteIncome: (id: string) => void;
  onSaveFixed: (item: BudgetItem) => void;
  onDeleteFixed: (id: string) => void;
}

export function BudgetSettingsDrawer({
  open,
  onOpenChange,
  readOnly,
  defaultMonth,
  incomes,
  fixedExpenses,
  onSaveIncome,
  onDeleteIncome,
  onSaveFixed,
  onDeleteFixed,
}: BudgetSettingsDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300">
          <div className="px-6 pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">Sabitler</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </Dialog.Close>
            </div>
          </div>
          <div className="space-y-8 overflow-y-auto px-6 pb-8">
            <FixedList
              title="Sabit gelirler"
              placeholder="Maaş"
              items={incomes}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveIncome}
              onDelete={onDeleteIncome}
            />
            <FixedList
              title="Sabit giderler"
              placeholder="Kira"
              items={fixedExpenses}
              readOnly={readOnly}
              defaultMonth={defaultMonth}
              onSave={onSaveFixed}
              onDelete={onDeleteFixed}
            />
            <p className="text-xs text-muted-foreground">
              Bir ay, başlangıç ile bitişin arasındaysa o aya yazılır. Bitiş boşsa devam eder.
            </p>
          </div>
          <Dialog.Description className="sr-only">
            Sabit gelir ve giderlerin geçerlilik aralığını düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FixedList({
  title,
  placeholder,
  items,
  readOnly,
  defaultMonth,
  onSave,
  onDelete,
}: {
  title: string;
  placeholder: string;
  items: BudgetItem[];
  readOnly: boolean;
  defaultMonth: string;
  onSave: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Henüz yok</p>
      )}
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <FixedEditor
            key={`${item.id}-${item.name}-${item.amount}-${item.validFrom}-${item.validTo ?? ""}`}
            item={item}
            readOnly={readOnly}
            onSave={onSave}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
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

  function commit() {
    const nextName = name.trim().replace(/\s+/g, " ");
    const nextTo = to || null;
    if (!nextName || !from) {
      setName(item.name);
      setAmount(item.amount);
      setFrom(item.validFrom);
      setTo(item.validTo ?? "");
      return;
    }
    if (nextTo && nextTo < from) {
      setTo(item.validTo ?? "");
      return;
    }
    if (
      nextName === item.name &&
      amount === item.amount &&
      from === item.validFrom &&
      nextTo === item.validTo
    ) {
      return;
    }
    onSave({ ...item, name: nextName, amount, validFrom: from, validTo: nextTo });
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          readOnly={readOnly}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          aria-label="Ad"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            playTick();
            setPadOpen(true);
          }}
          aria-label="Tutar"
          className="h-9 shrink-0 px-1 text-right text-sm tabular-nums"
        >
          {fmt(amount)} ₺
        </button>
        {!readOnly && (
          <button
            type="button"
            aria-label="Sil"
            onClick={onDelete}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Başlangıç</span>
          <input
            type="month"
            value={from}
            readOnly={readOnly}
            onChange={(event) => setFrom(event.target.value)}
            onBlur={commit}
            className={cn(fieldClass, "w-full")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Bitiş</span>
          <input
            type="month"
            value={to}
            readOnly={readOnly}
            onChange={(event) => setTo(event.target.value)}
            onBlur={commit}
            className={cn(fieldClass, "w-full")}
          />
        </label>
      </div>
      <MoneyPadSheet
        open={padOpen}
        title={name || "Tutar"}
        hint={amount > 0 ? `Şu an ${fmt(amount)} ₺` : undefined}
        onOpenChange={setPadOpen}
        onConfirm={(next) => {
          setAmount(next);
          const nextName = name.trim().replace(/\s+/g, " ");
          const nextTo = to || null;
          if (!nextName || !from || (nextTo && nextTo < from)) return;
          onSave({ ...item, name: nextName, amount: next, validFrom: from, validTo: nextTo });
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

  if (readOnly) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim().replace(/\s+/g, " ");
    const nextTo = to || null;
    if (!nextName || !from || amount <= 0) return;
    if (nextTo && nextTo < from) return;
    playTick();
    onAdd({
      name: nextName,
      amount,
      validFrom: from,
      validTo: nextTo,
    });
    setName("");
    setAmount(0);
    setTo("");
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        <button
          type="button"
          onClick={() => {
            playTick();
            setPadOpen(true);
          }}
          className={cn(fieldClass, "w-28 text-right tabular-nums")}
        >
          {amount > 0 ? `${fmt(amount)} ₺` : "Tutar"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Başlangıç</span>
          <input
            type="month"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
            className={cn(fieldClass, "w-full")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Bitiş</span>
          <input
            type="month"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={cn(fieldClass, "w-full")}
          />
        </label>
      </div>
      <button
        type="submit"
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-colors hover:bg-foreground/90"
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
