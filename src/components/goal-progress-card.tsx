"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { SavingEntry } from "@/lib/types";
import {
  computeGoalProgress,
  useSavingsGoal,
} from "@/hooks/use-savings-goal";
import { GoalDrawer } from "@/components/goal-drawer";

const fmt = (v: number) =>
  v.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function formatMonthYear(dateStr: string) {
  const [y, m] = dateStr.slice(0, 7).split("-").map(Number);
  return `${MONTH_SHORT[(m ?? 1) - 1]} ${y}`;
}

interface GoalProgressCardProps {
  user: User | null;
  entries: SavingEntry[];
  /** Portföy toplamı (TL) — eski yatırımlar dahil, birikimle alınanlar da burada */
  assetTotal: number;
}

export function GoalProgressCard({
  user,
  entries,
  assetTotal,
}: GoalProgressCardProps) {
  const { goal, setGoal, isViewer } = useSavingsGoal(user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const progress = useMemo(
    () => computeGoalProgress(goal, entries, assetTotal),
    [goal, entries, assetTotal]
  );

  if (!goal || !progress) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Hedef İlerleme</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toplam varlığına göre hedef ve tempo takibi
            </p>
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Hedef Belirle
            </button>
          )}
        </div>
        {!isViewer && (
          <GoalDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            initialGoal={null}
            onSave={(targetAmount, targetDate) => {
              setGoal(targetAmount, targetDate);
            }}
          />
        )}
      </>
    );
  }

  const isAhead = progress.state === "ahead" || progress.state === "onTrack";
  const theme = isAhead
    ? {
        solid: "bg-emerald-600",
        track: "bg-emerald-100 dark:bg-emerald-950/40",
        marker: "border-emerald-600",
        markerDot: "bg-emerald-600",
        label: "text-emerald-600",
        phrase: "önde",
        stripeBg:
          "repeating-linear-gradient(-45deg, rgb(5 150 105), rgb(5 150 105) 4px, rgb(167 243 208) 4px, rgb(167 243 208) 8px)",
      }
    : {
        solid: "bg-red-600",
        track: "bg-red-100 dark:bg-red-950/40",
        marker: "border-red-600",
        markerDot: "bg-red-600",
        label: "text-red-600",
        phrase: "geride",
        stripeBg:
          "repeating-linear-gradient(-45deg, rgb(220 38 38), rgb(220 38 38) 4px, rgb(254 202 202) 4px, rgb(254 202 202) 8px)",
      };

  const actualPct = progress.progressPct * 100;
  const expectedPct = progress.expectedPct * 100;
  const solidEnd = Math.min(actualPct, expectedPct);
  const stripeStart = solidEnd;
  const stripeEnd = Math.max(actualPct, expectedPct);
  const stripeWidth = Math.max(stripeEnd - stripeStart, 0);
  const markerLeft = actualPct;
  const targetLabel = formatMonthYear(progress.targetDate);
  const projectedLabel = progress.projectedDate
    ? formatMonthYear(progress.projectedDate)
    : null;

  return (
    <>
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Hedef İlerleme</p>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              Varlık {fmt(progress.currentTotal)} ₺ / Hedef{" "}
              {fmt(progress.targetAmount)} ₺
            </p>
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              Düzenle
            </button>
          )}
        </div>

        <div className="relative py-1">
          <div
            className={`relative h-3 w-full overflow-hidden rounded-full ${theme.track}`}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${theme.solid}`}
              style={{ width: `${solidEnd}%` }}
            />
            {stripeWidth > 0.3 && (
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${stripeStart}%`,
                  width: `${stripeWidth}%`,
                  background: theme.stripeBg,
                }}
              />
            )}
          </div>
          <div
            className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${Math.min(Math.max(markerLeft, 1.5), 98.5)}%` }}
          >
            <div
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white shadow-sm ${theme.marker}`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${theme.markerDot}`} />
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-snug text-foreground/90">
          {progress.state === "notStarted" ? (
            progress.currentTotal > 0 ? (
              <>
                Varlığın hedefe göre konumu gösteriliyor. Tempo için aylık
                birikim kaydı da ekleyebilirsin.
              </>
            ) : (
              <>
                Henüz varlık veya birikim yok. Portföy veya aylık tutar girerek
                takip etmeye başla.
              </>
            )
          ) : progress.state === "onTrack" || !projectedLabel ? (
            <>
              Hedefin{" "}
              <span className={`font-semibold ${theme.label}`}>
                {targetLabel}
              </span>
              ; mevcut tempoyla planlanan zamanda ulaşman bekleniyor.
            </>
          ) : isAhead ? (
            <>
              Hedefin{" "}
              <span className="font-medium text-muted-foreground">
                {targetLabel}
              </span>
              ; mevcut tempoyla{" "}
              <span className="font-semibold text-emerald-600">
                {projectedLabel}
              </span>
              {" "}
              civarında, yani{" "}
              <span className="font-semibold text-emerald-600">erken</span>{" "}
              ulaşman bekleniyor.
            </>
          ) : (
            <>
              Hedefin{" "}
              <span className="font-medium text-muted-foreground">
                {targetLabel}
              </span>
              ; mevcut tempoyla{" "}
              <span className="font-semibold text-red-600">
                {projectedLabel}
              </span>
              {" "}
              civarında, yani{" "}
              <span className="font-semibold text-red-600">geç</span>{" "}
              ulaşman bekleniyor.
            </>
          )}
        </p>
      </div>

      {!isViewer && (
        <GoalDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          initialGoal={goal}
          onSave={(targetAmount, targetDate) => {
            setGoal(targetAmount, targetDate);
          }}
        />
      )}
    </>
  );
}
