"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Minus, Plus, X } from "lucide-react";
import type { SavingsGoal } from "@/lib/types";

function defaultTargetDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function toMonthInput(date: string): string {
  return date.slice(0, 7);
}

function fromMonthInput(month: string): string {
  return `${month}-01`;
}

interface GoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGoal: SavingsGoal | null;
  onSave: (targetAmount: number, targetDate: string) => void;
}

export function GoalDrawer({
  open,
  onOpenChange,
  initialGoal,
  onSave,
}: GoalDrawerProps) {
  const [amount, setAmount] = useState(0);
  const [month, setMonth] = useState(toMonthInput(defaultTargetDate()));

  useEffect(() => {
    if (open) {
      setAmount(initialGoal?.targetAmount ?? 5_000_000);
      setMonth(
        initialGoal
          ? toMonthInput(initialGoal.targetDate)
          : toMonthInput(defaultTargetDate())
      );
    }
  }, [open, initialGoal]);

  function handleSave() {
    if (amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) return;
    onSave(amount, fromMonthInput(month));
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
              Birikim Hedefi
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Hedef Tutar
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmount(Math.max(0, amount - 100_000))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 transition-colors hover:bg-muted active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAmount(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="5000000"
                    className="h-11 w-full rounded-xl border bg-transparent px-3 pr-10 text-center text-sm font-medium tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ₺
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount(amount + 100_000)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 transition-colors hover:bg-muted active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Hedef Tarih
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={amount <= 0 || !month}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Kaydet
          </button>

          <Dialog.Description className="sr-only">
            Birikim hedef tutarı ve tarihini düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
