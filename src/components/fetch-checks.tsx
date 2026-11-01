"use client";

import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FETCH_KEYS, FETCH_LABELS, useFetchMarks, type FetchKey, type FetchMark } from "@/lib/fetch-marks";
import { cn } from "@/lib/utils";

function Mark({ state }: { state: FetchMark }) {
  if (state === "ok") {
    return <Check className="h-3 w-3 text-emerald-600" aria-hidden />;
  }
  if (state === "error") {
    return <X className="h-3 w-3 text-red-500" aria-hidden />;
  }
  return <Spinner className="size-3 text-muted-foreground" aria-hidden />;
}

export function FetchChecks({ onRefetch }: { onRefetch: (key: FetchKey) => void }) {
  const marks = useFetchMarks();

  const failed = FETCH_KEYS.filter((key) => marks[key] === "error").length;
  const pending = FETCH_KEYS.some((key) => marks[key] === "pending");

  return (
    <details key={failed > 0 ? "error" : "normal"} open={failed > 0 ? true : undefined} className="mt-3 text-xs text-muted-foreground">
      <summary className={cn("min-h-11 cursor-pointer py-3", failed > 0 && "text-red-600")}>
        {failed > 0 ? `${failed} veri grubu yüklenemedi · Yeniden dene` : pending ? "Bütçe verileri yükleniyor…" : "Veriler yüklendi · Yenileme seçenekleri"}
      </summary>
      <div className="flex gap-1.5 overflow-x-auto">
        {FETCH_KEYS.map((key) => {
          const state = marks[key];
          const label =
            state === "ok"
              ? `${FETCH_LABELS[key]} geldi, yeniden yükle`
              : state === "error"
                ? `${FETCH_LABELS[key]} gelmedi, yeniden yükle`
                : `${FETCH_LABELS[key]} yükleniyor`;
          return (
            <button
              key={key}
              type="button"
              disabled={state === "pending"}
              onClick={() => onRefetch(key)}
              aria-label={label}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-default",
                state === "ok" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                state === "error" && "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20",
                state === "pending" && "text-muted-foreground"
              )}
            >
              <Mark state={state} />
              {FETCH_LABELS[key]}
              {state === "ok" ? <span className="sr-only">OK</span> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
