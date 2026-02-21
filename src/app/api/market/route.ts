import { NextResponse } from "next/server";
import { MarketData, GoldData, SymbolData, ChartPoint } from "@/lib/types";

const API_KEY = process.env.TWELVE_DATA_API_KEY || "";
const BASE_URL = "https://api.twelvedata.com";

const TROY_OUNCE_GRAMS = 31.1035;
const GOLD_SPREAD = 0.012;
const SERVER_CACHE_TTL = 10 * 60 * 1000;

const g = globalThis as unknown as {
  __marketCache?: { data: MarketData; ts: number };
};

function getServerCache(): MarketData | null {
  const c = g.__marketCache;
  if (!c) return null;
  if (Date.now() - c.ts > SERVER_CACHE_TTL) return null;
  return c.data;
}

function setServerCache(data: MarketData) {
  g.__marketCache = { data, ts: Date.now() };
}

interface QuoteData {
  close: number;
  previousClose: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
}

async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code && json.code !== 200) return null;
    return {
      close: parseFloat(json.close),
      previousClose: parseFloat(json.previous_close),
      change: parseFloat(json.change),
      percentChange: parseFloat(json.percent_change),
      high: parseFloat(json.high),
      low: parseFloat(json.low),
    };
  } catch {
    return null;
  }
}

async function fetchTimeSeries(symbol: string): Promise<ChartPoint[] | null> {
  try {
    const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1h&outputsize=720&apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status === "error") return null;
    const values = json.values || [];
    if (values.length === 0) return null;
    return values
      .map((v: { datetime: string; close: string }) => ({
        time: v.datetime,
        price: parseFloat(v.close),
      }))
      .reverse();
  } catch {
    return null;
  }
}

function lastTradingDayChange(
  series: ChartPoint[],
  decimals: number
): { change: number; changePercent: number } | null {
  if (series.length < 24) return null;

  const lastPrice = series[series.length - 1].price;
  const lastDate = series[series.length - 1].time.split(" ")[0];

  let prevClose: number | null = null;
  for (let i = series.length - 2; i >= 0; i--) {
    const date = series[i].time.split(" ")[0];
    if (date !== lastDate) {
      prevClose = series[i].price;
      break;
    }
  }

  if (prevClose === null || prevClose === 0) return null;

  const factor = Math.pow(10, decimals);
  const change = Math.round((lastPrice - prevClose) * factor) / factor;
  const changePercent =
    Math.round(((lastPrice - prevClose) / prevClose) * 10000) / 100;

  return { change, changePercent };
}

function buildSymbol(
  symbol: string,
  quote: QuoteData,
  timeSeries: ChartPoint[]
): SymbolData {
  return {
    symbol,
    price: quote.close,
    change: Math.round(quote.change * 10000) / 10000,
    changePercent: Math.round(quote.percentChange * 100) / 100,
    high: Math.round(quote.high * 10000) / 10000,
    low: Math.round(quote.low * 10000) / 10000,
    timeSeries,
    lastUpdated: timeSeries[timeSeries.length - 1]?.time ?? "",
  };
}

function buildGoldTRY(
  goldQuote: QuoteData,
  goldSeries: ChartPoint[],
  usdQuote: QuoteData,
  usdSeries: ChartPoint[]
): GoldData {
  const usdTryPrice = usdQuote.close;

  const gramTimeSeries: ChartPoint[] = goldSeries.map((p, i) => {
    const usdRate = usdSeries[i]?.price ?? usdTryPrice;
    const gramTry = (p.price / TROY_OUNCE_GRAMS) * usdRate;
    return { time: p.time, price: Math.round(gramTry * 100) / 100 };
  });

  const gramPrice = (goldQuote.close / TROY_OUNCE_GRAMS) * usdTryPrice;
  const prevGramPrice =
    (goldQuote.previousClose / TROY_OUNCE_GRAMS) * usdQuote.previousClose;

  const change = Math.round((gramPrice - prevGramPrice) * 100) / 100;
  const changePercent =
    prevGramPrice !== 0
      ? Math.round(((gramPrice - prevGramPrice) / prevGramPrice) * 10000) / 100
      : 0;

  const gramBuy = Math.round(gramPrice * (1 - GOLD_SPREAD / 2) * 100) / 100;
  const gramSell = Math.round(gramPrice * (1 + GOLD_SPREAD / 2) * 100) / 100;

  const last24h = gramTimeSeries.slice(-24);
  const gramPrices = last24h.map((p) => p.price);

  return {
    symbol: "XAU/TRY",
    price: Math.round(gramPrice * 100) / 100,
    change,
    changePercent,
    high: gramPrices.length ? Math.round(Math.max(...gramPrices) * 100) / 100 : 0,
    low: gramPrices.length ? Math.round(Math.min(...gramPrices) * 100) / 100 : 0,
    timeSeries: gramTimeSeries,
    lastUpdated: goldSeries[goldSeries.length - 1]?.time ?? "",
    gramBuy,
    gramSell,
  };
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "TWELVE_DATA_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const cached = getServerCache();
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  }

  try {
    const [goldQuote, usdQuote, eurQuote, goldSeries, usdSeries, eurSeries] =
      await Promise.all([
        fetchQuote("XAU/USD"),
        fetchQuote("USD/TRY"),
        fetchQuote("EUR/TRY"),
        fetchTimeSeries("XAU/USD"),
        fetchTimeSeries("USD/TRY"),
        fetchTimeSeries("EUR/TRY"),
      ]);

    if (!goldQuote || !usdQuote || !eurQuote || !goldSeries || !usdSeries || !eurSeries) {
      return NextResponse.json(
        { error: "Piyasa verisi alınamadı" },
        { status: 502 }
      );
    }

    const gold = buildGoldTRY(goldQuote, goldSeries, usdQuote, usdSeries);
    const usd = buildSymbol("USD/TRY", usdQuote, usdSeries);
    const eur = buildSymbol("EUR/TRY", eurQuote, eurSeries);

    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      if (usd.change === 0) {
        const fb = lastTradingDayChange(usdSeries, 4);
        if (fb) { usd.change = fb.change; usd.changePercent = fb.changePercent; }
      }
      if (eur.change === 0) {
        const fb = lastTradingDayChange(eurSeries, 4);
        if (fb) { eur.change = fb.change; eur.changePercent = fb.changePercent; }
      }
      if (gold.change === 0) {
        const fb = lastTradingDayChange(gold.timeSeries, 2);
        if (fb) { gold.change = fb.change; gold.changePercent = fb.changePercent; }
      }
    }

    const data: MarketData = { gold, usd, eur, timestamp: Date.now() };

    setServerCache(data);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
