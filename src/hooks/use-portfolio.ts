"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Portfolio, AssetHolding, AssetKey, AccountRole } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const STORAGE_KEY = "altinim-portfolio";

const DEFAULT: Portfolio = {
  gold: { physical: 0, digital: 0 },
  usd: { physical: 0, digital: 0 },
  eur: { physical: 0, digital: 0 },
};

function loadLocal(): Portfolio {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw);
    return {
      gold: { physical: p.gold?.physical ?? 0, digital: p.gold?.digital ?? 0 },
      usd: { physical: p.usd?.physical ?? 0, digital: p.usd?.digital ?? 0 },
      eur: { physical: p.eur?.physical ?? 0, digital: p.eur?.digital ?? 0 },
    };
  } catch {
    return DEFAULT;
  }
}

function saveLocal(p: Portfolio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota exceeded */
  }
}

function parsePortfolio(data: Record<string, unknown>): Portfolio {
  return {
    gold: {
      physical: Number((data.gold as AssetHolding)?.physical) || 0,
      digital: Number((data.gold as AssetHolding)?.digital) || 0,
    },
    usd: {
      physical: Number((data.usd as AssetHolding)?.physical) || 0,
      digital: Number((data.usd as AssetHolding)?.digital) || 0,
    },
    eur: {
      physical: Number((data.eur as AssetHolding)?.physical) || 0,
      digital: Number((data.eur as AssetHolding)?.digital) || 0,
    },
  };
}

export function usePortfolio(user: User | null) {
  const [portfolio, setPortfolio] = useState<Portfolio>(loadLocal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const writingRef = useRef(false);
  const [access, setAccess] = useState<AccountRole>("owner");
  const userRef = useRef<User | null>(null);
  const accessRef = useRef<AccountRole>("owner");

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      setAccess("owner");
      setPortfolio(loadLocal());
      setLoading(false);
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store" });
        if (!res.ok) throw new Error("portfolio");
        const data = await res.json();
        const role: AccountRole = data.access === "viewer" ? "viewer" : "owner";
        const next = parsePortfolio(data);
        accessRef.current = role;
        setAccess(role);
        setPortfolio(next);
        if (role === "owner") saveLocal(next);
      } catch {
        const local = loadLocal();
        setPortfolio(local);
        setAccess("owner");
        accessRef.current = "owner";
        setError("Varlıklar sunucudan alınamadı. Yeniden yükleyip tekrar dene.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const portfolioRef = useRef(portfolio);
  portfolioRef.current = portfolio;

  const updateAsset = useCallback(
    async (key: AssetKey, holding: AssetHolding) => {
      if (accessRef.current === "viewer") throw new Error("Salt okunur hesap");
      if (writingRef.current) throw new Error("Kayıt sürüyor");
      if (Object.values(holding).some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error("Geçersiz miktar");
      }
      const next = { ...portfolioRef.current, [key]: holding };
      writingRef.current = true;
      try {
        if (userRef.current) {
          const response = await fetch("/api/portfolio", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
          if (!response.ok) throw new Error("Varlık kaydedilemedi");
        }
        portfolioRef.current = next;
        setPortfolio(next);
        saveLocal(next);
      } finally {
        writingRef.current = false;
      }
    },
    []
  );

  const adjustAsset = useCallback(
    (key: AssetKey, side: keyof AssetHolding, delta: number) => {
      const current = portfolioRef.current[key];
      return updateAsset(key, {
        ...current,
        [side]: Math.max(0, Math.round((current[side] + delta) * 100) / 100),
      });
    },
    [updateAsset]
  );

  return { portfolio, updateAsset, adjustAsset, access, loading, error, isViewer: access === "viewer" };
}
