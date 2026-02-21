import { CachedMarketData, MarketData } from "./types";

const CACHE_KEY = "altinim-market-data";
const CACHE_VERSION = 2;
const CACHE_DURATION = 10 * 60 * 1000;

interface VersionedCache extends CachedMarketData {
  version: number;
}

export function getCachedData(): MarketData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached: VersionedCache = JSON.parse(raw);

    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION * 3) return null;

    if (!cached.data?.gold?.gramBuy || !cached.data?.usd?.price) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cached.data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function setCachedData(data: MarketData): void {
  if (typeof window === "undefined") return;

  try {
    const cached: VersionedCache = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // quota exceeded or private browsing
  }
}

export function isCacheStale(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;

    const cached: VersionedCache = JSON.parse(raw);
    if (cached.version !== CACHE_VERSION) return true;

    return Date.now() - cached.timestamp > CACHE_DURATION;
  } catch {
    return true;
  }
}
