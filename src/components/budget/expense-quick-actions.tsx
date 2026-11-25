"use client";

import { useRef, useState } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { addQuickAction, removeQuickAction, type QuickAction } from "@/data/budget-quick-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExpenseQuickActions({ categoryId, items, error, onAdd, onRemove, description, onSelect, disabled }: {
  items: QuickAction[]; error?: string; onAdd: (item: QuickAction) => void; onRemove: (id: string) => void;
  categoryId: string; description: string; onSelect: (value: string) => void; disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const toast = useToast();
  async function add() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const result = await addQuickAction(categoryId, description);
      if (result.error || !result.item) { toast.error(result.error ?? "Kaydedilemedi."); return; }
      onAdd(result.item);
      toast.success("Hızlı seçim eklendi");
    } catch { toast.error("Hızlı seçim kaydedilemedi."); }
    finally { busy.current = false; setPending(false); }
  }
  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const result = await removeQuickAction(id);
      if (result.error) { toast.error(result.error); return; }
      onRemove(id);
    } catch { toast.error("Hızlı seçim kaldırılamadı."); }
    finally { busy.current = false; setPending(false); }
  }
  const canAdd = description.trim() && description.trim().length <= 80 && !items?.some(item => item.label.toLocaleLowerCase("tr-TR") === description.trim().toLocaleLowerCase("tr-TR"));
  return <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Hızlı seçimler</p>
    {error ? <p role="status" className="text-xs text-muted-foreground">{error}</p> : <>
      <div className="flex flex-wrap gap-2">
        {items.map(item => <span key={item.id} className="inline-flex items-center rounded-full border bg-background">
          <button type="button" disabled={disabled || pending} aria-pressed={description === item.label} onClick={() => onSelect(item.label)} className="min-h-10 rounded-l-full py-2 pl-3.5 pr-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground">{item.label}</button>
          <button type="button" disabled={disabled || pending} onClick={() => remove(item.id)} aria-label={`${item.label} hızlı seçimini kaldır`} className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><X className="size-3.5" aria-hidden /></button>
        </span>)}
      </div>
      {!items.length && <p className="text-xs leading-5 text-muted-foreground">Sık kullandığın açıklamayı yazıp hızlı seçim olarak kaydedebilirsin.</p>}
      {canAdd && <Button type="button" variant="ghost" size="sm" disabled={disabled || pending} className="rounded-full" onClick={add}><BookmarkPlus className="size-4" aria-hidden />{pending ? "Kaydediliyor…" : "Açıklamayı hızlı seçim olarak kaydet"}</Button>}
    </>}
  </div>;
}
