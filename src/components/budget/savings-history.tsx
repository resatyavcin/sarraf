"use client";

import { Dialog } from "radix-ui";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/budget";

export function SavingsHistory({ history, average, disabled }: {
  history: { month: string; amount: number }[]; average: number | null; disabled: boolean;
}) {
  return <Dialog.Root>
    <Dialog.Trigger asChild><Button variant="ghost" size="sm" className="rounded-full" disabled={disabled}><Info className="size-4" aria-hidden />Birikim dökümü</Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-60 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-6 shadow-xl outline-none">
        <Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Birikim dökümünü kapat" className="absolute right-2 top-2 rounded-full"><X className="size-4" aria-hidden /></Button></Dialog.Close>
        <Dialog.Title className="pr-5 text-lg font-bold tracking-tight">Birikim dökümü</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Seçili aydan önceki birikimlerin. Ortalamaya yalnızca kayıt girdiğin aylar dahil edilir.</Dialog.Description>
        {average !== null && <div className="my-5 rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{history.length} ayın ortalaması</p><p className="mt-1 break-all text-2xl font-semibold tabular-nums text-foreground">{formatMoney(average)}</p></div>}
        {history.length ? <dl className="mt-4 divide-y">{history.map(item => <div key={item.month} className="flex items-baseline justify-between gap-4 py-3 text-sm"><dt className="capitalize text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(`${item.month}-01T12:00:00`))}</dt><dd className="min-w-0 break-all text-right font-medium tabular-nums">{formatMoney(item.amount)}</dd></div>)}</dl> : <p className="py-8 text-center text-sm text-muted-foreground">Henüz geçmiş ay birikim kaydı yok.</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
