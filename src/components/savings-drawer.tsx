"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Minus, Plus, X } from "lucide-react";
import { last12MonthKeys } from "@/hooks/use-savings";

const MONTH_LABELS = [
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

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_LABELS[(m ?? 1) - 1]} ${y}`;
}

interface SavingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMonth: string;
  entries: { month: string; amount: number }[];
  onSave: (month: string, amount: number) => void;
}

export function SavingsDrawer({
  open,
  onOpenChange,
  initialMonth,
  entries,
  onSave,
}: SavingsDrawerProps) {
  const monthOptions = last12MonthKeys();
  const [month, setMonth] = useState(initialMonth);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (open) {
      setMonth(initialMonth);
      setValue(entries.find((e) => e.month === initialMonth)?.amount ?? 0);
    }
  }, [open, initialMonth, entries]);

  function handleMonthChange(next: string) {
    setMonth(next);
    setValue(entries.find((e) => e.month === next)?.amount ?? 0);
  }

  function handleSave() {
    onSave(month, value);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300">
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Aylık Birikim
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Ay
              </label>
              <select
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Tutar
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setValue(Math.max(0, value - 100))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 transition-colors hover:bg-muted active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={value || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setValue(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border bg-transparent px-3 pr-10 text-center text-sm font-medium tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ₺
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setValue(value + 100)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 transition-colors hover:bg-muted active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kaydet
          </button>

          <Dialog.Description className="sr-only">
            Aylık birikim tutarını düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
