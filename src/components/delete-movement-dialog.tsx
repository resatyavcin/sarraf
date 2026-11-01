"use client";

import { useId, useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Trash2, X } from "lucide-react";
import type { BudgetEntry } from "@/lib/types";

export function DeleteMovementDialog({ entry, categoryName, onClose, onConfirm }: {
  entry: BudgetEntry | null;
  categoryName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const inputId = useId();
  const hintId = useId();
  const ready = confirmation.trim().toLocaleLowerCase("tr-TR") === "onaylıyorum";
  const amount = entry?.amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const date = entry?.spentOn
    ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })
        .format(new Date(`${entry.spentOn}T12:00:00+03:00`))
    : "Tarih belirtilmemiş";

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[80] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-y-contain rounded-3xl border bg-background p-5 shadow-2xl outline-none sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" aria-hidden />
            </div>
            <Dialog.Close aria-label="Kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-4 text-xl font-semibold tracking-tight">Hareketi sil</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Bu hareket bütçenden kaldırılacak. Bu işlem geri alınamaz.
          </Dialog.Description>

          <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
            <p className="break-words text-sm font-medium leading-5">{entry?.label.trim() || "Hareket"}</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{categoryName} · {date}</p>
            <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums">{amount} ₺</p>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); if (ready && entry) onConfirm(); }}>
            <label htmlFor={inputId} className="mt-5 block text-sm font-medium">
              Devam etmek için <span className="select-text">onaylıyorum</span> yaz
            </label>
            <div className="relative mt-2">
              <input
                id={inputId}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                aria-describedby={hintId}
                placeholder="onaylıyorum"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                className={`h-12 w-full rounded-xl border bg-transparent px-3 pr-11 text-base outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 ${ready ? "border-emerald-500 focus-visible:ring-emerald-500/20" : "focus-visible:border-primary focus-visible:ring-primary/20"}`}
              />
              {ready && <Check aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />}
            </div>
            <p id={hintId} role="status" className="mt-2 min-h-5 text-xs text-muted-foreground">
              {ready ? "Onay tamamlandı. Hareketi silebilirsin." : "Onay metni tamamlandığında silme düğmesi açılır."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Dialog.Close className="flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-medium hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Vazgeç
              </Dialog.Close>
              <button type="submit" disabled={!ready} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <Trash2 className="h-4 w-4" aria-hidden />Hareketi sil
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
