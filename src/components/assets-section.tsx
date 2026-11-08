"use client";

import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Banknote, Gem, Pencil, Plus, RefreshCw, Wallet, X } from "lucide-react";
import type { AssetHolding, AssetKey, MarketData, Portfolio } from "@/lib/types";
import { ASSET_KEYS, assetBuyPrice, parseHoldingAmount, portfolioValue } from "@/lib/portfolio";

const ASSETS = {
  gold: { name: "Gram altın", unit: "gr", color: "bg-amber-500", tint: "bg-amber-500/10 text-amber-600", Icon: Gem },
  usd: { name: "Amerikan doları", unit: "USD", color: "bg-emerald-500", tint: "bg-emerald-500/10 text-emerald-600", Icon: Banknote },
  eur: { name: "Euro", unit: "EUR", color: "bg-blue-500", tint: "bg-blue-500/10 text-blue-600", Icon: Banknote },
};
const fmt = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function AssetsSection({ portfolio, market, readOnly, loading, error, onRetry, onUpdate, onGoldAdd }: {
  portfolio: Portfolio;
  market: MarketData | null;
  readOnly: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdate: (key: AssetKey, holding: AssetHolding) => Promise<void>;
  onGoldAdd: (side: keyof AssetHolding) => void;
}) {
  const [editing, setEditing] = useState<AssetKey | null>(null);
  const total = portfolioValue(portfolio, market);
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" />Varlıklarım</div>
        <p className="mt-4 text-xs text-muted-foreground">Tahmini toplam değer</p>
        <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums">{total === null ? "—" : `${fmt(total)} ₺`}</p>
        <p className="mt-2 text-xs text-muted-foreground">{market ? "Altın ve döviz alış fiyatlarıyla hesaplanır." : "Fiyatlar geldiğinde TL karşılıkları hesaplanacak."}</p>
        {total !== null && total > 0 && (
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {ASSET_KEYS.map((key) => <div key={key} className={ASSETS[key].color} style={{ width: `${((portfolio[key].physical + portfolio[key].digital) * (assetBuyPrice(key, market) ?? 0) / total) * 100}%` }} />)}
          </div>
        )}
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600">{error}</div>}
      {ASSET_KEYS.map((key) => {
        const { name, unit, tint, Icon } = ASSETS[key];
        const holding = portfolio[key];
        const amount = holding.physical + holding.digital;
        const price = assetBuyPrice(key, market);
        return (
          <div key={key} className="overflow-hidden rounded-2xl border bg-card">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></div>
                <h2 className="min-w-0 flex-1 text-sm font-semibold">{name}</h2>
                {!readOnly && <button type="button" disabled={loading} onClick={() => setEditing(key)} aria-label={`${name} bakiyesini düzenle`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:bg-muted disabled:opacity-40"><Pencil className="h-4 w-4" /></button>}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <p className="break-words text-2xl font-semibold tracking-tight tabular-nums">{fmt(amount)} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
                <p className="text-sm tabular-nums text-muted-foreground">{price === null ? "— ₺" : `${fmt(amount * price)} ₺`}</p>
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">{price === null ? "Güncel fiyat bekleniyor" : `1 ${unit} ≈ ${fmt(price)} ₺`}</p>
            </div>
            <div className="grid grid-cols-2 divide-x border-t bg-muted/20">
              {(["physical", "digital"] as const).map((side) => <div key={side} className="min-w-0 px-5 py-3"><p className="text-xs text-muted-foreground">{side === "physical" ? "Fiziksel" : "Dijital"}</p><p className="mt-1 break-words text-sm font-medium tabular-nums">{fmt(holding[side])} {unit}</p></div>)}
            </div>
            {key === "gold" && !readOnly && <div className="grid grid-cols-2 gap-2 border-t p-3">{(["physical", "digital"] as const).map((side) => <button key={side} type="button" disabled={loading} onClick={() => onGoldAdd(side)} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-sm hover:bg-muted active:bg-muted disabled:opacity-40"><Plus className="h-4 w-4" />{side === "physical" ? "Fiziksel ekle" : "Dijital ekle"}</button>)}</div>}
          </div>
        );
      })}
      <button type="button" onClick={onRetry} disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"><RefreshCw className="h-4 w-4" />{loading ? "Güncelleniyor…" : "Fiyatları yenile"}</button>
      {editing && !readOnly && <HoldingEditor key={editing} asset={editing} holding={portfolio[editing]} onClose={() => setEditing(null)} onSave={(holding) => onUpdate(editing, holding)} />}
    </section>
  );
}

function HoldingEditor({ asset, holding, onClose, onSave }: { asset: AssetKey; holding: AssetHolding; onClose: () => void; onSave: (holding: AssetHolding) => Promise<void> }) {
  const [physical, setPhysical] = useState(String(holding.physical).replace(".", ","));
  const [digital, setDigital] = useState(String(holding.digital).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const p = parseHoldingAmount(physical), d = parseHoldingAmount(digital);
  const { name, unit } = ASSETS[asset];
  async function save() {
    if (busy.current || p === null || d === null) return;
    busy.current = true; setSaving(true); setError("");
    try { await onSave({ physical: p, digital: d }); onClose(); }
    catch { setError("Kaydedilemedi. Bağlantını kontrol edip tekrar dene."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy.current) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50" />
    <Dialog.Content className="sarraf-sheet fixed inset-x-0 bottom-0 z-[70] max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-2xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-semibold">{name} bakiyesi</Dialog.Title><Dialog.Close disabled={saving} aria-label="Kapat" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></Dialog.Close></div>
      <Dialog.Description className="mb-5 text-sm text-muted-foreground">Elindeki toplam miktarları gir. Kaydettiğin miktarlar mevcut bakiyelerin yerini alır.</Dialog.Description>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
        {([{ side: "physical", label: "Fiziksel", value: physical, set: setPhysical }, { side: "digital", label: "Dijital", value: digital, set: setDigital }]).map((field) => <div key={field.side}><label htmlFor={`holding-${field.side}`} className="mb-2 block text-sm font-medium">{field.label} ({unit})</label><input id={`holding-${field.side}`} value={field.value} onChange={(event) => field.set(event.target.value)} type="text" inputMode="decimal" autoComplete="off" disabled={saving} aria-invalid={parseHoldingAmount(field.value) === null} className="h-12 w-full rounded-xl border bg-transparent px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>)}
        {(p === null || d === null) && <p className="text-xs text-red-600">Sıfır veya daha büyük, en fazla iki ondalık basamaklı miktarlar gir.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving || p === null || d === null} className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40">{saving ? "Kaydediliyor…" : "Bakiyeyi kaydet"}</button>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
