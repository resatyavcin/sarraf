"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { setBudgetFetchMark, setFetchMark, type FetchKey } from "@/lib/fetch-marks";
import type {
  AccountRole,
  BudgetCategory,
  BudgetEntry,
  BudgetItem,
  BudgetSnapshot,
} from "@/lib/types";

const STORAGE_KEY = "sarraf-budget";

const BUDGET_FETCH_KEYS = [
  "incomes",
  "fixedExpenses",
  "categories",
  "entries",
] as const satisfies readonly FetchKey[];

function applyFetched(fetched: unknown) {
  const row = fetched && typeof fetched === "object" ? (fetched as Record<string, unknown>) : null;
  for (const key of BUDGET_FETCH_KEYS) {
    setFetchMark(key, row == null || row[key] === true ? "ok" : "error");
  }
}

function mergeRemote(remote: BudgetSnapshot, local: BudgetSnapshot, fetched: unknown) {
  const row = fetched && typeof fetched === "object" ? (fetched as Record<string, unknown>) : null;
  if (!row) return remote;
  return {
    incomes: row.incomes === false ? local.incomes : remote.incomes,
    fixedExpenses: row.fixedExpenses === false ? local.fixedExpenses : remote.fixedExpenses,
    categories: row.categories === false ? local.categories : remote.categories,
    entries: row.entries === false ? local.entries : remote.entries,
  };
}

function emptySnapshot(): BudgetSnapshot {
  return { incomes: [], fixedExpenses: [], categories: [], entries: [] };
}

export function newBudgetId() {
  return crypto.randomUUID();
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isEffectivelyEmpty(snapshot: BudgetSnapshot) {
  return (
    snapshot.incomes.length === 0 &&
    snapshot.fixedExpenses.length === 0 &&
    snapshot.entries.length === 0 &&
    snapshot.categories.length === 0
  );
}

function asMonth(value: unknown) {
  return typeof value === "string" && MONTH_RE.test(value) ? value : null;
}

function asItem(value: unknown): BudgetItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    id?: unknown;
    name?: unknown;
    amount?: unknown;
    validFrom?: unknown;
    validTo?: unknown;
  };
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    id: row.id,
    name: row.name,
    amount: Math.max(0, amount),
    validFrom: asMonth(row.validFrom) ?? "2000-01",
    validTo: asMonth(row.validTo),
  };
}

function asCategory(value: unknown): BudgetCategory | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    id?: unknown;
    name?: unknown;
    kind?: unknown;
    validFrom?: unknown;
    validTo?: unknown;
  };
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  if (row.kind !== "custom" && row.kind !== "statement") return null;
  const validFrom = asMonth(row.validFrom);
  const validTo = row.validTo == null || row.validTo === "" ? null : asMonth(row.validTo);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    validFrom: row.kind === "statement" ? validFrom ?? "2000-01" : validFrom,
    validTo,
  };
}

function asEntry(value: unknown): BudgetEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    id?: unknown;
    month?: unknown;
    categoryId?: unknown;
    label?: unknown;
    amount?: unknown;
  };
  if (
    typeof row.id !== "string" ||
    typeof row.month !== "string" ||
    typeof row.categoryId !== "string" ||
    typeof row.label !== "string"
  ) {
    return null;
  }
  const amount = Number(row.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    id: row.id,
    month: row.month.slice(0, 7),
    categoryId: row.categoryId,
    label: row.label,
    amount: Math.max(0, amount),
  };
}

function normalize(value: unknown): BudgetSnapshot {
  const row = (value ?? {}) as {
    incomes?: unknown;
    fixedExpenses?: unknown;
    categories?: unknown;
    entries?: unknown;
  };
  const categories = Array.isArray(row.categories)
    ? row.categories.flatMap((item) => {
        const category = asCategory(item);
        return category ? [category] : [];
      })
    : [];
  return {
    incomes: Array.isArray(row.incomes)
      ? row.incomes.flatMap((item) => {
          const income = asItem(item);
          return income ? [income] : [];
        })
      : [],
    fixedExpenses: Array.isArray(row.fixedExpenses)
      ? row.fixedExpenses.flatMap((item) => {
          const expense = asItem(item);
          return expense ? [expense] : [];
        })
      : [],
    categories,
    entries: Array.isArray(row.entries)
      ? row.entries.flatMap((item) => {
          const entry = asEntry(item);
          return entry ? [entry] : [];
        })
      : [],
  };
}

function loadLocal(): BudgetSnapshot {
  if (typeof window === "undefined") return emptySnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    return normalize(JSON.parse(raw));
  } catch {
    return emptySnapshot();
  }
}

function saveLocal(snapshot: BudgetSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota exceeded */
  }
}

async function pushOp(op: Record<string, unknown>) {
  const res = await fetch("/api/budget", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
  });
  if (!res.ok) throw new Error("budget");
}

export function useBudget(user: User | null) {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>(emptySnapshot);
  const [access, setAccess] = useState<AccountRole>("owner");
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const accessRef = useRef<AccountRole>("owner");
  const sourceRef = useRef<"remote" | "local">("local");
  const snapshotRef = useRef(snapshot);
  const requestRef = useRef(0);
  const partRequestRef = useRef<Record<FetchKey, number>>({
    incomes: 0,
    fixedExpenses: 0,
    categories: 0,
    entries: 0,
  });

  snapshotRef.current = snapshot;

  const loadRemote = useCallback(async (initial: boolean) => {
    if (!userRef.current) return;
    const requestId = ++requestRef.current;
    if (initial) setLoading(true);
    setBudgetFetchMark("pending");

    try {
      const res = await fetch("/api/budget", { cache: "no-store" });
      if (!res.ok) throw new Error("budget");
      const data = await res.json();
      if (requestRef.current !== requestId) return;

      const role: AccountRole = data.access === "viewer" ? "viewer" : "owner";
      const remote = normalize(data);
      accessRef.current = role;
      setAccess(role);
      applyFetched(data.fetched);

      if (role === "viewer") {
        sourceRef.current = "remote";
        setSnapshot(remote);
        return;
      }

      const local = loadLocal();
      const merged = mergeRemote(remote, local, data.fetched);
      const fetched =
        data.fetched && typeof data.fetched === "object"
          ? (data.fetched as Record<string, unknown>)
          : null;
      const anyFailed = fetched != null && Object.values(fetched).some((value) => value === false);
      if (!anyFailed && isEffectivelyEmpty(remote) && !isEffectivelyEmpty(local)) {
        for (const item of local.incomes) await pushOp({ op: "save-income", ...item });
        for (const item of local.fixedExpenses) await pushOp({ op: "save-fixed", ...item });
          for (const category of local.categories) {
            await pushOp({
              op: "save-category",
              id: category.id,
              name: category.name,
              kind: category.kind,
              validFrom: category.validFrom,
              validTo: category.validTo,
            });
          }
          for (const entry of local.entries) await pushOp({ op: "save-entry", ...entry });
        if (requestRef.current !== requestId) return;

        sourceRef.current = "remote";
        saveLocal(local);
        setSnapshot(local);
        return;
      }

      sourceRef.current = "remote";
      saveLocal(merged);
      setSnapshot(merged);
    } catch {
      if (requestRef.current !== requestId) return;
      setBudgetFetchMark("error");
      if (initial) {
        sourceRef.current = "local";
        accessRef.current = "owner";
        setAccess("owner");
        setSnapshot(loadLocal());
      }
    } finally {
      if (requestRef.current === requestId && initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      sourceRef.current = "local";
      setAccess("owner");
      setSnapshot(loadLocal());
      setLoading(false);
      setBudgetFetchMark("pending");
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;
    void loadRemote(true);
  }, [user, loadRemote]);

  const refetch = useCallback(async (key: FetchKey) => {
    if (!userRef.current) return;
    const generation = requestRef.current;
    const requestId = ++partRequestRef.current[key];
    setFetchMark(key, "pending");

    try {
      const res = await fetch(`/api/budget?part=${key}`, { cache: "no-store" });
      if (!res.ok) throw new Error("budget");
      const data = await res.json();
      if (requestRef.current !== generation || partRequestRef.current[key] !== requestId) return;

      const fetched = data.fetched as Record<string, unknown> | undefined;
      if (fetched && fetched[key] === false) {
        setFetchMark(key, "error");
        return;
      }

      const piece = normalize(data)[key];
      setSnapshot((prev) => {
        const next = { ...prev, [key]: piece };
        if (accessRef.current !== "viewer") saveLocal(next);
        return next;
      });
      setFetchMark(key, "ok");
    } catch {
      if (requestRef.current !== generation || partRequestRef.current[key] !== requestId) return;
      setFetchMark(key, "error");
    }
  }, []);

  const commit = useCallback(
    (recipe: (prev: BudgetSnapshot) => BudgetSnapshot, op: Record<string, unknown> | null) => {
      if (accessRef.current === "viewer") return;
      setSnapshot((prev) => {
        const next = recipe(prev);
        saveLocal(next);
        return next;
      });
      if (op && sourceRef.current === "remote" && userRef.current) {
        void pushOp(op).catch(() => {
          sourceRef.current = "local";
        });
      }
    },
    []
  );

  const saveIncome = useCallback(
    (item: BudgetItem) => {
      commit(
        (prev) => ({
          ...prev,
          incomes: prev.incomes.some((income) => income.id === item.id)
            ? prev.incomes.map((income) => (income.id === item.id ? item : income))
            : [...prev.incomes, item],
        }),
        { op: "save-income", ...item }
      );
    },
    [commit]
  );

  const deleteIncome = useCallback(
    (id: string) => {
      commit(
        (prev) => ({ ...prev, incomes: prev.incomes.filter((income) => income.id !== id) }),
        { op: "delete-income", id }
      );
    },
    [commit]
  );

  const saveFixed = useCallback(
    (item: BudgetItem) => {
      commit(
        (prev) => ({
          ...prev,
          fixedExpenses: prev.fixedExpenses.some((expense) => expense.id === item.id)
            ? prev.fixedExpenses.map((expense) => (expense.id === item.id ? item : expense))
            : [...prev.fixedExpenses, item],
        }),
        { op: "save-fixed", ...item }
      );
    },
    [commit]
  );

  const deleteFixed = useCallback(
    (id: string) => {
      commit(
        (prev) => ({
          ...prev,
          fixedExpenses: prev.fixedExpenses.filter((expense) => expense.id !== id),
        }),
        { op: "delete-fixed", id }
      );
    },
    [commit]
  );

  const saveCategory = useCallback(
    (category: BudgetCategory) => {
      commit(
        (prev) => ({
          ...prev,
          categories: prev.categories.some((item) => item.id === category.id)
            ? prev.categories.map((item) => (item.id === category.id ? category : item))
            : [...prev.categories, category],
        }),
        {
          op: "save-category",
          id: category.id,
          name: category.name,
          kind: category.kind,
          validFrom: category.validFrom,
          validTo: category.validTo,
        }
      );
    },
    [commit]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const category = snapshotRef.current.categories.find((item) => item.id === id);
      if (!category) return;
      commit(
        (prev) => ({
          ...prev,
          categories: prev.categories.filter((item) => item.id !== id),
          entries: prev.entries.filter((entry) => entry.categoryId !== id),
        }),
        { op: "delete-category", id }
      );
    },
    [commit]
  );

  const saveEntry = useCallback(
    (entry: BudgetEntry) => {
      commit(
        (prev) => ({
          ...prev,
          entries: prev.entries.some((item) => item.id === entry.id)
            ? prev.entries.map((item) => (item.id === entry.id ? entry : item))
            : [...prev.entries, entry],
        }),
        { op: "save-entry", ...entry }
      );
    },
    [commit]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      commit(
        (prev) => ({ ...prev, entries: prev.entries.filter((entry) => entry.id !== id) }),
        { op: "delete-entry", id }
      );
    },
    [commit]
  );

  return {
    loading,
    isViewer: access === "viewer",
    incomes: snapshot.incomes,
    fixedExpenses: snapshot.fixedExpenses,
    categories: snapshot.categories,
    entries: snapshot.entries,
    saveIncome,
    deleteIncome,
    saveFixed,
    deleteFixed,
    saveCategory,
    deleteCategory,
    saveEntry,
    deleteEntry,
    refetch,
  };
}
