"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isBudgetBank } from "@/lib/budget";
import type {
  AccountRole,
  BudgetCategory,
  BudgetEntry,
  BudgetItem,
  BudgetSnapshot,
  BudgetStatement,
} from "@/lib/types";

const STORAGE_KEY = "sarraf-budget";

function emptySnapshot(): BudgetSnapshot {
  return { incomes: [], fixedExpenses: [], categories: [], entries: [], statements: [] };
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
    snapshot.statements.length === 0 &&
    snapshot.categories.every((category) => category.kind === "statement")
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
  const row = value as { id?: unknown; name?: unknown; kind?: unknown };
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  if (row.kind !== "custom" && row.kind !== "statement") return null;
  return { id: row.id, name: row.name, kind: row.kind };
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

function asStatement(value: unknown): BudgetStatement | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { month?: unknown; bank?: unknown; amount?: unknown };
  const month = asMonth(row.month);
  if (!month || !isBudgetBank(row.bank)) return null;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { month, bank: row.bank, amount: Math.max(0, amount) };
}

function normalize(value: unknown): BudgetSnapshot {
  const row = (value ?? {}) as {
    incomes?: unknown;
    fixedExpenses?: unknown;
    categories?: unknown;
    entries?: unknown;
    statements?: unknown;
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
    statements: Array.isArray(row.statements)
      ? row.statements.flatMap((item) => {
          const statement = asStatement(item);
          return statement ? [statement] : [];
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

  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      sourceRef.current = "local";
      setAccess("owner");
      setSnapshot(loadLocal());
      setLoading(false);
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;

    const requestId = ++requestRef.current;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/budget", { cache: "no-store" });
        if (!res.ok) throw new Error("budget");
        const data = await res.json();
        if (requestRef.current !== requestId) return;

        const role: AccountRole = data.access === "viewer" ? "viewer" : "owner";
        const remote = normalize(data);
        accessRef.current = role;
        setAccess(role);

        if (role === "viewer") {
          sourceRef.current = "remote";
          setSnapshot(remote);
          return;
        }

        const local = loadLocal();
        if (isEffectivelyEmpty(remote) && !isEffectivelyEmpty(local)) {
          for (const item of local.incomes) await pushOp({ op: "save-income", ...item });
          for (const item of local.fixedExpenses) await pushOp({ op: "save-fixed", ...item });
          for (const category of local.categories) {
            await pushOp({ op: "save-category", id: category.id, name: category.name });
          }
          for (const entry of local.entries) await pushOp({ op: "save-entry", ...entry });
          for (const statement of local.statements) {
            await pushOp({ op: "save-statement", ...statement });
          }
          if (requestRef.current !== requestId) return;

          sourceRef.current = "remote";
          saveLocal(local);
          setSnapshot(local);
          return;
        }

        sourceRef.current = "remote";
        saveLocal(remote);
        setSnapshot(remote);
      } catch {
        if (requestRef.current !== requestId) return;
        sourceRef.current = "local";
        accessRef.current = "owner";
        setAccess("owner");
        setSnapshot(loadLocal());
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    })();
  }, [user]);

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
        { op: "save-category", id: category.id, name: category.name }
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

  const saveStatement = useCallback(
    (statement: BudgetStatement) => {
      commit(
        (prev) => {
          const rest = prev.statements.filter(
            (item) => !(item.month === statement.month && item.bank === statement.bank)
          );
          return {
            ...prev,
            statements: statement.amount > 0 ? [...rest, statement] : rest,
          };
        },
        statement.amount > 0
          ? { op: "save-statement", ...statement }
          : { op: "delete-statement", month: statement.month, bank: statement.bank }
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
    statements: snapshot.statements,
    saveIncome,
    deleteIncome,
    saveFixed,
    deleteFixed,
    saveCategory,
    deleteCategory,
    saveEntry,
    deleteEntry,
    saveStatement,
  };
}
