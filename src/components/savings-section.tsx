"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PiggyBank } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useSavings } from "@/hooks/use-savings";
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

function shortMonthLabel(month: string) {
  const m = Number(month.split("-")[1]) || 1;
  return SHORT_MONTHS[m - 1];
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
  user: User | null;
}

export function SavingsSection({ user }: SavingsSectionProps) {
  const { entries, setMonth, totals, isViewer } = useSavings(user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMonth, setEditMonth] = useState(currentMonthKey);

  const chartData = useMemo(
    () =>
      entries.map((e) => ({
        month: e.month,
        label: shortMonthLabel(e.month),
        amount: e.amount,
      })),
    [entries]
  );

  function openEdit(month: string) {
    if (isViewer) return;
    setEditMonth(month);
    setDrawerOpen(true);
  }

  return (
    <>
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
              <PiggyBank className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Aylık Birikim</h2>
              <p className="text-xs text-muted-foreground">
                Son 12 ay · maaştan kenara ayrılan nakit
              </p>
            </div>
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => openEdit(currentMonthKey())}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Bu Ayı Düzenle
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Toplam
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {fmt(totals.sum)} ₺
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Ortalama
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {fmt(totals.average)} ₺
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ChartContainer config={chartConfig} className="h-50 w-full">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
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
                      const month = payload?.[0]?.payload?.month as
                        | string
                        | undefined;
                      if (!month) return "";
                      const [y, m] = month.split("-").map(Number);
                      return `${SHORT_MONTHS[(m ?? 1) - 1]} ${y}`;
                    }}
                  />
                }
              />
              <Bar
                dataKey="amount"
                fill="var(--color-amount)"
                radius={[4, 4, 0, 0]}
                cursor={isViewer ? "default" : "pointer"}
                onClick={(data) => {
                  if (isViewer) return;
                  const month = (data as { month?: string })?.month;
                  if (month) openEdit(month);
                }}
              />
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
          onSave={(month, amount) => {
            setMonth(month, amount);
          }}
        />
      )}
    </>
  );
}
