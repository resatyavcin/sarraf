"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ChevronRight, Pencil, PiggyBank, Plus } from "lucide-react";
import type { SavingEntry } from "@/lib/types";
import { SavingsDrawer } from "@/components/savings-drawer";

const SHORT_MONTHS = [
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

function monthParts(month: string) {
  const [yearText, monthText] = month.split("-");
  const monthIndex = (Number(monthText) || 1) - 1;
  return {
    name: SHORT_MONTHS[monthIndex] ?? month,
    year: yearText?.slice(2) ?? "",
    full: `${SHORT_MONTHS[monthIndex] ?? month} ${yearText ?? ""}`.trim(),
  };
}

function MonthTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const [name, year] = String(payload?.value ?? "").split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" className="fill-muted-foreground">
        <tspan x={0} dy={12} fontSize={11}>
          {name}
        </tspan>
        <tspan x={0} dy={12} fontSize={10}>
          {year}
        </tspan>
      </text>
    </g>
  );
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const fmt = (v: number) =>
  v.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const chartConfig = {
  amount: { label: "Birikim", color: "hsl(142 71% 40%)" },
} satisfies ChartConfig;

interface SavingsSectionProps {
  entries: SavingEntry[];
  totals: { sum: number; average: number };
  isViewer: boolean;
  onSave: (month: string, amount: number) => void | Promise<void>;
}

export function SavingsSection({ entries, totals, isViewer, onSave }: SavingsSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMonth, setEditMonth] = useState(currentMonthKey);

  const chartData = useMemo(() => {
    const current = currentMonthKey();
    return entries.map((e) => {
      const parts = monthParts(e.month);
      return {
        month: e.month,
        label: `${parts.name}|'${parts.year}`,
        full: parts.full,
        amount: e.amount,
        current: e.month === current,
      };
    });
  }, [entries]);

  const currentMonth = currentMonthKey();
  const currentAmount = entries.find((entry) => entry.month === currentMonth)?.amount ?? 0;
  const recordedMonths = entries.filter((entry) => entry.amount > 0).length;
  const recentEntries = [...entries].reverse();

  const rangeLabel =
    chartData.length > 0
      ? `${chartData[0].full} – ${chartData[chartData.length - 1].full}`
      : "";

  function openEdit(month: string) {
    if (isViewer) return;
    setEditMonth(month);
    setDrawerOpen(true);
  }

  return (
    <>
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <PiggyBank className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Aylık Birikim</h2>
            {rangeLabel && (
              <p className="truncate text-xs text-muted-foreground">{rangeLabel}</p>
            )}
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => openEdit(currentMonthKey())}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Bu ayı düzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-medium text-muted-foreground">{monthParts(currentMonth).full} birikimi</p>
          <p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{fmt(currentAmount)} ₺</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentAmount > 0 ? "Bu ay gerçekleşen toplam birikimin" : "Bu ay biriktirdiğin tutarı kaydet"}
          </p>
          {!isViewer && (
            <button
              type="button"
              onClick={() => openEdit(currentMonth)}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 text-sm font-medium text-background active:opacity-80"
            >
              {currentAmount > 0 ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {currentAmount > 0 ? "Bu ayın tutarını düzenle" : "Bu ayın birikimini gir"}
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Son 12 ay toplamı</p>
            <p className="mt-1 break-words text-xl font-semibold tracking-tight tabular-nums">{fmt(totals.sum)} ₺</p>
          </div>
          <div className="min-w-0 border-l pl-3">
            <p className="text-xs text-muted-foreground">Birikim yapılan ay ortalaması</p>
            <p className="mt-1 break-words text-xl font-semibold tracking-tight tabular-nums">{fmt(totals.average)} ₺</p>
            <p className="mt-1 text-xs text-muted-foreground">{recordedMonths} ay üzerinden</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium">Birikim geçmişi</h3>
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 0, bottom: 8 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                height={36}
                tick={<MonthTick />}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                fontSize={11}
                width={40}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="font-medium tabular-nums">
                        {fmt(Number(value) || 0)} ₺
                      </span>
                    )}
                    labelFormatter={(_, payload) => {
                      const full = payload?.[0]?.payload?.full as
                        | string
                        | undefined;
                      return full ?? "";
                    }}
                  />
                }
              />
              <Bar
                isAnimationActive={false}
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                cursor={isViewer ? "default" : "pointer"}
                onClick={(data) => {
                  if (isViewer) return;
                  const month = (data as { month?: string })?.month;
                  if (month) openEdit(month);
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={
                      entry.current
                        ? "hsl(142 72% 29%)"
                        : "var(--color-amount)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Aylık kayıtlar</h3>
            <span className="text-xs text-muted-foreground">Yeni aydan eskiye</span>
          </div>
          <div className="divide-y">
            {recentEntries.map((entry) => (
              <button
                key={entry.month}
                type="button"
                disabled={isViewer}
                onClick={() => openEdit(entry.month)}
                aria-label={`${monthParts(entry.month).full}: ${fmt(entry.amount)} lira${isViewer ? "" : ", düzenle"}`}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left enabled:hover:bg-muted/50 enabled:active:bg-muted disabled:cursor-default"
              >
                <span className="min-w-0 text-sm">
                  {monthParts(entry.month).full}
                  {entry.month === currentMonth && <span className="ml-2 text-xs text-muted-foreground">Bu ay</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-sm tabular-nums ${entry.amount > 0 ? "font-medium" : "text-muted-foreground"}`}>
                    {entry.amount > 0 ? `${fmt(entry.amount)} ₺` : "0 ₺"}
                  </span>
                  {!isViewer && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {!isViewer && (
        <SavingsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          initialMonth={editMonth}
          entries={entries}
          onSave={onSave}
        />
      )}
    </>
  );
}
