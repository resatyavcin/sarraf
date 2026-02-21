"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarketData } from "@/lib/types";
import { getCachedData, isCacheStale, setCachedData } from "@/lib/cache";

const POLL_INTERVAL = 10 * 60 * 1000;

export function useMarketData() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (!isInitial && !isCacheStale()) return;

    try {
      if (isInitial) setLoading(true);
      setError(null);

      const res = await fetch("/api/market");
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const marketData: MarketData = await res.json();
      setData(marketData);
      setCachedData(marketData);
      setLastFetch(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Veri alınamadı";
      setError(message);

      if (!data) {
        const cached = getCachedData();
        if (cached) {
          setData(cached);
          setLastFetch(new Date(cached.timestamp));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    const cached = getCachedData();
    if (cached) {
      setData(cached);
      setLastFetch(new Date(cached.timestamp));
      setLoading(false);
    }

    if (isCacheStale() || !cached) {
      fetchData(true);
    }

    intervalRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, lastFetch, refetch: () => fetchData(false) };
}
