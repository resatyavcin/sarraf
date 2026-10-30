"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Delete, History, Undo2, X } from "lucide-react";
import type { GoldLedgerEntry, GoldSide } from "@/hooks/use-gold-ledger";
import { playTick } from "@/lib/play-tick";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

function gramsLabel(n: number) {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function whenLabel(at: number) {
  const d = new Date(at);
  const date = d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

function typeKey(prev: string, key: string) {
  if (key === "back") return prev.slice(0, -1);
  if (key === ",") {
    if (prev.includes(",")) return prev;
    return `${prev || "0"},`;
  }
  const fraction = prev.split(",")[1];
  if (fraction && fraction.length >= 2) return prev;
  if (prev.replace(",", "").length >= 7) return prev;
  if (prev === "0") return key;
  return prev + key;
}

export function GoldAddSheet({
  side,
  total,
  entries,
  onOpenChange,
  onAdd,
  onUndo,
}: {
  side: GoldSide | null;
  total: number;
  entries: GoldLedgerEntry[];
  onOpenChange: (open: boolean) => void;
  onAdd: (side: GoldSide, grams: number) => void;
  onUndo: (entry: GoldLedgerEntry) => void;
}) {
  const [raw, setRaw] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const open = side !== null;
  const title = side === "digital" ? "Dijital" : "Fiziksel";
  const grams = parseFloat(raw.replace(",", "."));
  const canAdd = Number.isFinite(grams) && grams > 0;

  function press(key: string) {
    playTick();
    setRaw((prev) => typeKey(prev, key));
  }

  function submit() {
    if (!side || !canAdd) return;
    playTick();
    onAdd(side, Math.round(grams * 100) / 100);
    setRaw("");
  }

  return (
    <>
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRaw("");
          setHistoryOpen(false);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/20" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                Şu an {gramsLabel(total)} gr
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setHistoryOpen(true);
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Son girişler"
              >
                <History className="h-5 w-5" />
              </button>
              <Dialog.Close
                className="rounded-lg p-1.5 transition-colors hover:bg-muted"
                onClick={() => playTick()}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Dialog.Close>
            </div>
          </div>

          <p className="text-center text-4xl font-semibold tracking-tight tabular-nums">
            {raw || "0"}
            <span className="ml-1 text-base font-normal text-muted-foreground">gr</span>
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onPointerDown={(event) => {
                  press(key);
                  event.preventDefault();
                }}
                className="flex h-14 items-center justify-center rounded-2xl bg-muted text-xl font-medium tabular-nums active:bg-muted/70"
              >
                {key === "back" ? <Delete className="h-5 w-5" /> : key}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!canAdd}
            onPointerDown={(event) => {
              submit();
              event.preventDefault();
            }}
            aria-label="Ekle"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Check className="h-5 w-5" />
          </button>

          <Dialog.Description className="sr-only">
            {title} gram gir
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <Dialog.Root open={historyOpen} onOpenChange={setHistoryOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/20" />
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Son girişler</Dialog.Title>
            <Dialog.Close
              className="rounded-lg p-1.5 transition-colors hover:bg-muted"
              onClick={() => playTick()}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Henüz ekleme yok.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto overscroll-y-contain">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium tabular-nums">+{gramsLabel(entry.grams)} gr</p>
                    <p className="text-xs text-muted-foreground">{whenLabel(entry.at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playTick();
                      onUndo(entry);
                    }}
                    aria-label="Geri al"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Dialog.Description className="sr-only">
            {title} için son gram girişlerini geri al
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
