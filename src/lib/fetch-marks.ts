"use client";

import { useSyncExternalStore } from "react";

export const FETCH_KEYS = [
  "incomes",
  "fixedExpenses",
  "categories",
  "entries",
] as const;

export type FetchKey = (typeof FETCH_KEYS)[number];
export type FetchMark = "pending" | "ok" | "error";

const BUDGET_KEYS: FetchKey[] = [
  "incomes",
  "fixedExpenses",
  "categories",
  "entries",
];

export const FETCH_LABELS: Record<FetchKey, string> = {
  incomes: "Gelirler",
  fixedExpenses: "Sabit giderler",
  categories: "Kategoriler",
  entries: "Harcamalar",
};

function pendingMarks(): Record<FetchKey, FetchMark> {
  return {
    incomes: "pending",
    fixedExpenses: "pending",
    categories: "pending",
    entries: "pending",
  };
}

let marks = pendingMarks();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setFetchMark(key: FetchKey, state: FetchMark) {
  if (marks[key] === state) return;
  marks = { ...marks, [key]: state };
  emit();
}

export function setBudgetFetchMark(state: FetchMark) {
  const next = { ...marks };
  let changed = false;
  for (const key of BUDGET_KEYS) {
    if (next[key] !== state) {
      next[key] = state;
      changed = true;
    }
  }
  if (!changed) return;
  marks = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return marks;
}

export function useFetchMarks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
