"use client";

import { useState, useEffect } from "react";
import { Dialog } from "radix-ui";
import { Minus, Plus, X, Banknote, Smartphone } from "lucide-react";

interface AssetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  unit: string;
  step: number;
  holding: { physical: number; digital: number };
  onSave: (holding: { physical: number; digital: number }) => void;
}

export function AssetDrawer({
  open,
  onOpenChange,
  title,
  unit,
  step,
  holding,
  onSave,
}: AssetDrawerProps) {
  const [physical, setPhysical] = useState(holding.physical);
  const [digital, setDigital] = useState(holding.digital);

  useEffect(() => {
    if (open) {
      setPhysical(holding.physical);
      setDigital(holding.digital);
    }
  }, [open, holding]);

  function handleSave() {
    onSave({ physical, digital });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300">
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <StepperInput
              label="Fiziksel"
              icon={<Banknote className="h-4 w-4" />}
              value={physical}
              onChange={setPhysical}
              unit={unit}
              step={step}
            />
            <StepperInput
              label="Dijital"
              icon={<Smartphone className="h-4 w-4" />}
              value={digital}
              onChange={setDigital}
              unit={unit}
              step={step}
            />
          </div>

          <button
            onClick={handleSave}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kaydet
          </button>

          <Dialog.Description className="sr-only">
            Fiziksel ve dijital varlık miktarını düzenle
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepperInput({
  label,
  icon,
  value,
  onChange,
  unit,
  step,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
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
              onChange(isNaN(v) ? 0 : Math.max(0, v));
            }}
            placeholder="0"
            className="h-11 w-full rounded-xl border bg-transparent px-3 pr-10 text-center text-sm font-medium tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        </div>
        <button
          onClick={() => onChange(value + step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 transition-colors hover:bg-muted active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
