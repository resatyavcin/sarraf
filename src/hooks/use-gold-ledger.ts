"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sarraf-gold-ledger";

export type GoldSide = "physical" | "digital";

export interface GoldLedgerEntry {
  id: string;
  side: GoldSide;
  grams: number;
  at: number;
}

function load(): GoldLedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GoldLedgerEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        (e.side === "physical" || e.side === "digital") &&
        typeof e.id === "string" &&
        Number(e.grams) > 0
    );
  } catch {
    return [];
  }
}

function save(entries: GoldLedgerEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded */
  }
}

export function useGoldLedger() {
  const [entries, setEntries] = useState<GoldLedgerEntry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    setEntries(load());
  }, []);

  const push = useCallback((side: GoldSide, grams: number) => {
    const entry: GoldLedgerEntry = {
      id: crypto.randomUUID(),
      side,
      grams,
      at: Date.now(),
    };
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, 40);
      save(next);
      return next;
    });
    return entry;
  }, []);

  const drop = useCallback((id: string) => {
    const removed = entriesRef.current.find((e) => e.id === id) ?? null;
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
    return removed;
  }, []);

  return { entries, push, drop };
}
