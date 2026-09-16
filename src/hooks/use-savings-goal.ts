"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AccountRole, SavingEntry, SavingsGoal } from "@/lib/types";

const STORAGE_KEY = "sarraf-savings-goal";
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

export type GoalProgressState = "ahead" | "behind" | "onTrack" | "notStarted";

export interface GoalProgress {
  state: GoalProgressState;
  progressPct: number;
  expectedPct: number;
  scheduleDeltaPct: number;
  currentTotal: number;
  targetAmount: number;
  targetDate: string;
  /** Tempo ile tahmini varış (YYYY-MM-DD); bilinmiyorsa null */
  projectedDate: string | null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const whole = Math.floor(months);
  const frac = months - whole;
  d.setMonth(d.getMonth() + whole);
  d.setTime(d.getTime() + frac * MS_PER_MONTH);
  return d;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function loadLocal(): SavingsGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavingsGoal;
    const targetAmount = Number(parsed?.targetAmount);
    const targetDate =
      typeof parsed?.targetDate === "string" ? parsed.targetDate.slice(0, 10) : "";
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
    return { targetAmount, targetDate };
  } catch {
    return null;
  }
}

function saveLocal(goal: SavingsGoal | null) {
  try {
    if (!goal) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
  } catch {
    /* quota exceeded */
  }
}

/**
 * Konum = toplam varlık / hedef.
 * Tempo = aylık birikim ortalaması (varlık ÷ ay DEĞİL).
 * Kalan hedef / aylık tempo → planlanan kalan süreyle karşılaştırılır.
 */
export function computeGoalProgress(
  goal: SavingsGoal | null,
  entries: SavingEntry[],
  assetTotal: number,
  now = new Date()
): GoalProgress | null {
  if (!goal || goal.targetAmount <= 0) return null;

  const withData = entries.filter((e) => e.amount > 0);
  const firstEntry = withData[0];
  const progressPct = Math.min(
    Math.max(assetTotal / goal.targetAmount, 0),
    1
  );

  if (!firstEntry) {
    return {
      state: "notStarted",
      progressPct,
      expectedPct: 0,
      scheduleDeltaPct: 0,
      currentTotal: assetTotal,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      projectedDate: null,
    };
  }

  const [sy, sm] = firstEntry.month.split("-").map(Number);
  const start = new Date(sy, (sm ?? 1) - 1, 1);
  const target = new Date(goal.targetDate + "T00:00:00");
  const totalMs = target.getTime() - start.getTime();
  const elapsedMs = Math.min(
    Math.max(now.getTime() - start.getTime(), 0),
    Math.max(totalMs, 0)
  );
  const expectedPct =
    totalMs > 0 ? Math.min(elapsedMs / totalMs, 1) : progressPct >= 1 ? 1 : 0;

  const scheduledMonths = Math.max(totalMs / MS_PER_MONTH, 0.1);
  const monthsElapsed = Math.min(
    Math.max(elapsedMs / MS_PER_MONTH, 0),
    scheduledMonths
  );
  const monthsLeft = Math.max(scheduledMonths - monthsElapsed, 0.1);

  // Gerçek katkı temposu: dolu ayların ortalaması (örn. 100k+100k+100k → 100k)
  const savingsSum = withData.reduce((acc, e) => acc + e.amount, 0);
  const monthlyPace = savingsSum / withData.length;

  const remaining = Math.max(goal.targetAmount - assetTotal, 0);
  const monthsToGo =
    remaining <= 0
      ? 0
      : monthlyPace > 0
        ? remaining / monthlyPace
        : Infinity;

  const projectedDate =
    monthsToGo === Infinity
      ? null
      : toDateKey(addMonths(now, monthsToGo));

  // Pozitif = önde (kalan süre, gereken süreden fazla)
  const scheduleDeltaPct =
    monthsToGo === Infinity
      ? -100
      : Math.round(((monthsLeft - monthsToGo) / scheduledMonths) * 100);

  let state: GoalProgressState;
  if (remaining <= 0) {
    state = "ahead";
  } else if (Math.abs(scheduleDeltaPct) < 3) {
    state = "onTrack";
  } else if (scheduleDeltaPct >= 0) {
    state = "ahead";
  } else {
    state = "behind";
  }

  return {
    state,
    progressPct,
    expectedPct,
    scheduleDeltaPct,
    currentTotal: assetTotal,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate,
    projectedDate,
  };
}

export function useSavingsGoal(user: User | null) {
  const [goal, setGoalState] = useState<SavingsGoal | null>(loadLocal);
  const [access, setAccess] = useState<AccountRole>("owner");
  const [loading, setLoading] = useState(false);
  const userRef = useRef<User | null>(null);
  const accessRef = useRef<AccountRole>("owner");

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      setAccess("owner");
      setGoalState(loadLocal());
      setLoading(false);
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/savings/goal", { cache: "no-store" });
        const data = await res.json();
        const role: AccountRole =
          data.access === "viewer" ? "viewer" : "owner";
        const next =
          data.goal &&
          Number.isFinite(Number(data.goal.targetAmount)) &&
          typeof data.goal.targetDate === "string"
            ? ({
                targetAmount: Number(data.goal.targetAmount),
                targetDate: String(data.goal.targetDate).slice(0, 10),
              } satisfies SavingsGoal)
            : null;

        accessRef.current = role;
        setAccess(role);
        setGoalState(next);
        if (role === "owner") saveLocal(next);
      } catch {
        const local = loadLocal();
        setGoalState(local);
        setAccess("owner");
        accessRef.current = "owner";
        if (local) {
          try {
            await fetch("/api/savings/goal", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(local),
            });
          } catch {
            /* ignore */
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const setGoal = useCallback(
    async (targetAmount: number, targetDate: string) => {
      if (accessRef.current === "viewer") return;

      const next: SavingsGoal = {
        targetAmount: Math.max(0, Number(targetAmount) || 0),
        targetDate: targetDate.slice(0, 10),
      };
      if (next.targetAmount <= 0) return;

      setGoalState(next);
      saveLocal(next);

      if (userRef.current) {
        try {
          await fetch("/api/savings/goal", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  return {
    goal,
    setGoal,
    loading,
    access,
    isViewer: access === "viewer",
  };
}
