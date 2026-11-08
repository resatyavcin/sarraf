"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
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
  onSave: (month: string, amount: number) => void | Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const [raw, setRaw] = useState("");
  const value = Number(raw.replace(",", "."));
  const valid = raw.trim() !== "" && /^\d+(?:[.,]\d{0,2})?$/.test(raw) && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000;
  const savedAmount = entries.find((entry) => entry.month === month)?.amount ?? 0;

  useEffect(() => {
    if (open) {
      setError("");
      setMonth(initialMonth);
      const amount = entries.find((e) => e.month === initialMonth)?.amount ?? 0;
      setRaw(amount > 0 ? String(amount).replace(".", ",") : "");
    }
  }, [open, initialMonth, entries]);

  function handleMonthChange(next: string) {
    setMonth(next);
    const amount = entries.find((e) => e.month === next)?.amount ?? 0;
    setRaw(amount > 0 ? String(amount).replace(".", ",") : "");
  }

  async function handleSave() {
    if (!valid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(month, Math.round(value * 100) / 100);
      onOpenChange(false);
    } catch {
      setError("Kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!savingRef.current) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content className="sarraf-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300">
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Aylık Birikim
            </Dialog.Title>
            <Dialog.Close disabled={saving} aria-label="Kapat" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="savings-month" className="mb-2 block text-sm font-medium text-muted-foreground">
                Ay
              </label>
              <select
                disabled={saving}
                id="savings-month"
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="h-11 w-full rounded-xl border bg-transparent px-3 text-base font-medium outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="savings-amount" className="mb-2 block text-sm font-medium text-muted-foreground">
                Ayın toplam birikimi
              </label>
              <div className="relative">
                <input
                  disabled={saving}
                  id="savings-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSave();
                  }}
                  aria-describedby="savings-amount-hint"
                  aria-invalid={raw !== "" && !valid}
                  placeholder="0"
                  className="h-14 w-full rounded-xl border bg-transparent px-4 pr-12 text-2xl font-semibold tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
              </div>
              <p id="savings-amount-hint" className="mt-2 text-xs text-muted-foreground">
                Mevcut tutar: {savedAmount.toLocaleString("tr-TR")} ₺. Kaydettiğin tutar bu ayın toplamının yerini alır.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1000, 5000, 10000].map((increment) => (
                  <button
                    key={increment}
                    disabled={saving}
                    type="button"
                    onClick={() => setRaw(String(Math.round(((valid ? value : savedAmount) + increment) * 100) / 100).replace(".", ","))}
                    className="min-h-11 rounded-xl border px-2 text-sm font-medium tabular-nums hover:bg-muted active:bg-muted"
                  >
                    +{increment.toLocaleString("tr-TR")} ₺
                  </button>
                ))}
              </div>
              {raw !== "" && !valid && <p role="alert" className="mt-2 text-xs text-red-600">En fazla iki ondalık basamaklı, geçerli bir tutar gir.</p>}
            </div>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="disabled:opacity-40 mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {saving ? "Kaydediliyor…" : "Toplamı kaydet"}
          </button>

          <Dialog.Description className="sr-only">
            Aylık birikim tutarını düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
