"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AccountRole, SavingEntry } from "@/lib/types";

const STORAGE_KEY = "sarraf-savings";

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function last12MonthKeys(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

function fillLast12(rows: SavingEntry[]): SavingEntry[] {
  const map = new Map(rows.map((r) => [r.month, r.amount]));
  return last12MonthKeys().map((month) => ({
    month,
    amount: map.get(month) ?? 0,
  }));
}

function loadLocal(): SavingEntry[] {
  if (typeof window === "undefined") return fillLast12([]);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fillLast12([]);
    const parsed = JSON.parse(raw) as SavingEntry[];
    if (!Array.isArray(parsed)) return fillLast12([]);
    return fillLast12(
      parsed
        .filter((e) => e && typeof e.month === "string")
        .map((e) => ({ month: e.month, amount: Number(e.amount) || 0 }))
    );
  } catch {
    return fillLast12([]);
  }
}

function saveLocal(entries: SavingEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded */
  }
}

function hasAnyAmount(entries: SavingEntry[]) {
  return entries.some((e) => e.amount > 0);
}

export function useSavings(user: User | null) {
  const [entries, setEntries] = useState<SavingEntry[]>(loadLocal);
  const [access, setAccess] = useState<AccountRole>("owner");
  const userRef = useRef<User | null>(null);
  const accessRef = useRef<AccountRole>("owner");

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      setAccess("owner");
      setEntries(loadLocal());
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;

    (async () => {
      try {
        const res = await fetch("/api/savings", { cache: "no-store" });
        const data = await res.json();
        const role: AccountRole = data.access === "viewer" ? "viewer" : "owner";
        const list = Array.isArray(data.entries)
          ? data.entries
          : Array.isArray(data)
            ? data
            : [];
        const filled = fillLast12(list);
        accessRef.current = role;
        setAccess(role);
        setEntries(filled);
        if (role === "owner") saveLocal(filled);
      } catch {
        const local = loadLocal();
        setEntries(local);
        setAccess("owner");
        accessRef.current = "owner";
        if (hasAnyAmount(local)) {
          try {
            await Promise.all(
              local
                .filter((e) => e.amount > 0)
                .map((e) =>
                  fetch("/api/savings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(e),
                  })
                )
            );
          } catch {
            /* ignore */
          }
        }
      }
    })();
  }, [user]);

  const setMonth = useCallback(async (month: string, amount: number) => {
    if (accessRef.current === "viewer") return;

    const nextAmount = Math.max(0, Number(amount) || 0);
    setEntries((prev) => {
      const filled = fillLast12(
        prev.map((e) =>
          e.month === month ? { month, amount: nextAmount } : e
        )
      );
      saveLocal(filled);
      return filled;
    });

    if (userRef.current) {
      try {
        await fetch("/api/savings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, amount: nextAmount }),
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const totals = useMemo(() => {
    const withData = entries.filter((e) => e.amount > 0);
    const sum = entries.reduce((acc, e) => acc + e.amount, 0);
    const monthsWithData = withData.length;
    const average = monthsWithData > 0 ? sum / monthsWithData : 0;
    return { sum, average, monthsWithData };
  }, [entries]);

  return {
    entries,
    setMonth,
    totals,
    access,
    isViewer: access === "viewer",
  };
}
