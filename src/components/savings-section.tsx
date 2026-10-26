"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Pencil, PiggyBank } from "lucide-react";
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
    maximumFractionDigits: 0,
  });

const chartConfig = {
  amount: { label: "Birikim", color: "hsl(142 71% 40%)" },
} satisfies ChartConfig;

interface SavingsSectionProps {
  entries: SavingEntry[];
  totals: { sum: number; average: number };
  isViewer: boolean;
  onSave: (month: string, amount: number) => void;
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

        <div className="mt-5 grid grid-cols-2">
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">Toplam</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {fmt(totals.sum)} ₺
            </p>
          </div>
          <div className="border-l text-center">
            <p className="text-xs font-medium text-muted-foreground">Ortalama</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {fmt(totals.average)} ₺
            </p>
          </div>
        </div>

        <div className="mt-4">
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
