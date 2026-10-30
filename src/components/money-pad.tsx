"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { Check, Delete, X } from "lucide-react";
import { playTick } from "@/lib/play-tick";
import { cn } from "@/lib/utils";

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

function formatPad(raw: string) {
  if (!raw) return "0";
  const [whole, fraction] = raw.split(",");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

function CommitButton({
  disabled,
  onConfirm,
  className,
  children,
}: {
  disabled: boolean;
  onConfirm: () => void;
  className: string;
  children: ReactNode;
}) {
  const handled = useRef(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!releasedInside(event)) return;
        handled.current = true;
        onConfirm();
        requestAnimationFrame(() => {
          handled.current = false;
        });
      }}
      onClick={() => {
        if (handled.current) return;
        onConfirm();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

function releasedInside(event: ReactPointerEvent<HTMLButtonElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const slop = 10;
  return (
    event.clientX >= rect.left - slop &&
    event.clientX <= rect.right + slop &&
    event.clientY >= rect.top - slop &&
    event.clientY <= rect.bottom + slop
  );
}

function PadKey({
  children,
  label,
  repeat,
  onPress,
}: {
  children: ReactNode;
  label: string;
  repeat?: boolean;
  onPress: () => void;
}) {
  const held = useRef(false);
  const repeated = useRef(false);
  const handled = useRef(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    held.current = false;
    if (startTimer.current) clearTimeout(startTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    startTimer.current = null;
    repeatTimer.current = null;
  }

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        held.current = true;
        repeated.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!repeat) return;
        startTimer.current = setTimeout(() => {
          if (!held.current) return;
          repeated.current = true;
          onPress();
          repeatTimer.current = setInterval(() => {
            if (held.current) onPress();
          }, 80);
        }, 380);
      }}
      onPointerUp={(event) => {
        const shouldCommit = held.current && !repeated.current && releasedInside(event);
        stop();
        if (!shouldCommit) return;
        handled.current = true;
        onPress();
        requestAnimationFrame(() => {
          handled.current = false;
        });
      }}
      onPointerCancel={stop}
      onClick={() => {
        if (handled.current) return;
        onPress();
      }}
      className="flex h-14 items-center justify-center rounded-2xl bg-muted text-[1.375rem] font-medium tabular-nums text-foreground active:bg-foreground/10"
    >
      {children}
    </button>
  );
}

export function AmountPad({
  raw,
  unit,
  canConfirm,
  onKey,
  onConfirm,
}: {
  raw: string;
  unit: string;
  canConfirm: boolean;
  onKey: (key: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="shrink-0">
      <p
        className={cn(
          "text-center text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums",
          !raw && "text-muted-foreground/40"
        )}
        style={{ fontOpticalSizing: "auto" }}
      >
        {formatPad(raw)}
        <span className="ml-1.5 text-base font-normal tracking-normal text-muted-foreground">{unit}</span>
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <PadKey
            key={key}
            label={key === "back" ? "Sil" : key === "," ? "Virgül" : key}
            repeat={key === "back"}
            onPress={() => onKey(key)}
          >
            {key === "back" ? <Delete className="h-5 w-5 text-muted-foreground" /> : key}
          </PadKey>
        ))}
      </div>
      <CommitButton
        disabled={!canConfirm}
        onConfirm={onConfirm}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        <Check className="h-4 w-4" />
        Ekle
      </CommitButton>
    </div>
  );
}

export function MoneyPadSheet({
  open,
  title,
  hint,
  allowZero,
  namePlaceholder,
  defaultDate,
  dateMin,
  dateMax,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint?: string;
  allowZero?: boolean;
  namePlaceholder?: string;
  defaultDate?: string;
  dateMin?: string;
  dateMax?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: number, name: string, spentOn: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [spentOn, setSpentOn] = useState(defaultDate ?? "");
  const amount = parseAmount(raw);
  const dateReady = !defaultDate || /^\d{4}-\d{2}-\d{2}$/.test(spentOn);
  const canConfirm = (allowZero ? raw.length > 0 : amount > 0) && dateReady;

  function close() {
    setRaw("");
    setName("");
    setSpentOn(defaultDate ?? "");
  }

  function press(key: string) {
    playTick();
    setRaw((prev) => typeKey(prev, key));
  }

  function confirm() {
    if (!canConfirm) return;
    playTick();
    onConfirm(amount, name.trim().replace(/\s+/g, " "), spentOn);
    close();
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setSpentOn(defaultDate ?? "");
        else close();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 duration-200 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t bg-background shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 pt-2">
                <Dialog.Title className="text-lg font-semibold leading-tight">{title}</Dialog.Title>
                {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
              </div>
              <Dialog.Close
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
                onClick={() => playTick()}
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            {namePlaceholder && (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={namePlaceholder}
                aria-label={namePlaceholder}
                maxLength={80}
                enterKeyHint="done"
                autoComplete="off"
                className="mt-4 h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
            {defaultDate && (
              <label className="mt-3 block">
                <span className="mb-1 block text-[11px] tracking-wide text-muted-foreground">Tarih</span>
                <input
                  type="date"
                  value={spentOn}
                  min={dateMin}
                  max={dateMax}
                  onChange={(event) => setSpentOn(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            )}
          </div>
          <div className="px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <AmountPad
              raw={raw}
              unit="₺"
              canConfirm={canConfirm}
              onKey={press}
              onConfirm={confirm}
            />
          </div>
          <Dialog.Description className="sr-only">{title} tutarını gir</Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
