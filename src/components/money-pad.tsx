"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Delete } from "lucide-react";
import { playTick } from "@/lib/play-tick";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

function typeKey(prev: string, key: string) {
  if (key === "back") return prev.slice(0, -1);
  if (key === ",") {
    if (prev.includes(",")) return prev;
    return `${prev || "0"},`;
  }
  const fraction = prev.split(",")[1];
  if (fraction && fraction.length >= 2) return prev;
  if (prev.replace(",", "").length >= 9) return prev;
  if (prev === "0") return key;
  return prev + key;
}

function parseAmount(raw: string) {
  if (!raw) return 0;
  const amount = Number(raw.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

export function MoneyPadSheet({
  open,
  title,
  hint,
  allowZero,
  namePlaceholder,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint?: string;
  allowZero?: boolean;
  namePlaceholder?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: number, name: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const amount = parseAmount(raw);
  const canConfirm = allowZero ? raw.length > 0 : amount > 0;

  function close() {
    setRaw("");
    setName("");
  }

  function press(key: string) {
    playTick();
    setRaw((prev) => typeKey(prev, key));
  }

  function confirm() {
    if (!canConfirm) return;
    playTick();
    onConfirm(amount, name.trim().replace(/\s+/g, " "));
    close();
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/20" />
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
          {namePlaceholder && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={namePlaceholder}
              aria-label={namePlaceholder}
              maxLength={80}
              className="mt-4 h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          )}
          <p className="mt-4 text-center text-4xl font-semibold tracking-tight tabular-nums">
            {raw || "0"}
            <span className="ml-1 text-base font-normal text-muted-foreground">₺</span>
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
            disabled={!canConfirm}
            onPointerDown={(event) => {
              confirm();
              event.preventDefault();
            }}
            aria-label="Ekle"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Check className="h-5 w-5" />
          </button>
          <Dialog.Description className="sr-only">{title} tutarını gir</Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
