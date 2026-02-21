"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartPoint, ChartPeriod } from "@/lib/types";

interface PriceChartProps {
  title: string;
  data: ChartPoint[];
  color: string;
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "1d": "Günlük",
  "7d": "7 Gün",
  "30d": "30 Gün",
};

function filterByPeriod(data: ChartPoint[], period: ChartPeriod): ChartPoint[] {
  const hoursMap: Record<ChartPeriod, number> = {
    "1d": 24,
    "7d": 168,
    "30d": 720,
  };
  const count = hoursMap[period];
  return data.slice(-count);
}

const formatTime = (datetime: string, period: ChartPeriod) => {
  try {
    const date = new Date(datetime.replace(" ", "T"));
    if (isNaN(date.getTime())) return datetime;
    if (period === "1d") {
      return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch {
    return datetime;
  }
};

const fmtPrice = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v) || 0;
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function PriceChart({ title, data, color }: PriceChartProps) {
  const gradientId = `fill-${title.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [period, setPeriod] = useState<ChartPeriod>("1d");

  const filteredData = useMemo(() => filterByPeriod(data ?? [], period), [data, period]);

  const chartConfig = {
    price: { label: title, color },
  } satisfies ChartConfig;

  const prices = filteredData.map((d) => d.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 1;
  const padding = (max - min) * 0.1 || 1;

  if (!filteredData.length) {
    return (
      <Card>
        <CardContent className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          Grafik verisi bulunamadı
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-0">
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="50%" stopColor={color} stopOpacity={0.08} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => formatTime(v, period)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              fontSize={11}
            />
            <YAxis
              domain={[min - padding, max + padding]}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={11}
              tickFormatter={(v: number) => fmtPrice(v)}
              width={70}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => {
                    try {
                      const date = new Date((label as string).replace(" ", "T"));
                      if (isNaN(date.getTime())) return String(label);
                      return date.toLocaleString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    } catch {
                      return String(label);
                    }
                  }}
                  formatter={(value) => [`${fmtPrice(value)} ₺`, title]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
