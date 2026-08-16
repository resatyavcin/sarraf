import { NextResponse } from "next/server";
import { MarketData, GoldData, SymbolData } from "@/lib/types";

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
}

async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code && json.code !== 200) return null;
    return { close: parseFloat(json.close) };
  } catch {
    return null;
  }
}

function buildSymbol(symbol: string, quote: QuoteData): SymbolData {
  return {
    symbol,
    price: quote.close,
  };
}

function buildGoldTRY(goldQuote: QuoteData, usdQuote: QuoteData): GoldData {
  const gramPrice = (goldQuote.close / TROY_OUNCE_GRAMS) * usdQuote.close;
  const gramBuy = Math.round(gramPrice * (1 - GOLD_SPREAD / 2) * 100) / 100;
  const gramSell = Math.round(gramPrice * (1 + GOLD_SPREAD / 2) * 100) / 100;

  return {
    symbol: "XAU/TRY",
    price: Math.round(gramPrice * 100) / 100,
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
    const [goldQuote, usdQuote, eurQuote] = await Promise.all([
      fetchQuote("XAU/USD"),
      fetchQuote("USD/TRY"),
      fetchQuote("EUR/TRY"),
    ]);

    if (!goldQuote || !usdQuote || !eurQuote) {
      return NextResponse.json(
        { error: "Piyasa verisi alınamadı" },
        { status: 502 }
      );
    }

    const data: MarketData = {
      gold: buildGoldTRY(goldQuote, usdQuote),
      usd: buildSymbol("USD/TRY", usdQuote),
      eur: buildSymbol("EUR/TRY", eurQuote),
      timestamp: Date.now(),
    };

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
