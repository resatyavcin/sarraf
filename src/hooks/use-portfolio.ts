"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Portfolio, AssetHolding, AssetKey } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
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

function isEmpty(p: Portfolio) {
  return (
    p.gold.physical === 0 && p.gold.digital === 0 &&
    p.usd.physical === 0 && p.usd.digital === 0 &&
    p.eur.physical === 0 && p.eur.digital === 0
  );
}

function rowToPortfolio(row: Record<string, number>): Portfolio {
  return {
    gold: { physical: Number(row.gold_physical) || 0, digital: Number(row.gold_digital) || 0 },
    usd: { physical: Number(row.usd_physical) || 0, digital: Number(row.usd_digital) || 0 },
    eur: { physical: Number(row.eur_physical) || 0, digital: Number(row.eur_digital) || 0 },
  };
}

function portfolioToRow(p: Portfolio, userId: string) {
  return {
    user_id: userId,
    gold_physical: p.gold.physical,
    gold_digital: p.gold.digital,
    usd_physical: p.usd.physical,
    usd_digital: p.usd.digital,
    eur_physical: p.eur.physical,
    eur_digital: p.eur.digital,
    updated_at: new Date().toISOString(),
  };
}

export function usePortfolio(user: User | null) {
  const [portfolio, setPortfolio] = useState<Portfolio>(loadLocal);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      setPortfolio(loadLocal());
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;

    const supabase = getSupabase();

    (async () => {
      const { data } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const cloud = rowToPortfolio(data);
        setPortfolio(cloud);
        saveLocal(cloud);
      } else {
        const local = loadLocal();
        if (!isEmpty(local)) {
          await supabase
            .from("portfolios")
            .upsert(portfolioToRow(local, user.id));
          setPortfolio(local);
        }
      }
    })();
  }, [user]);

  const updateAsset = useCallback(
    async (key: AssetKey, holding: AssetHolding) => {
      setPortfolio((prev) => {
        const next = { ...prev, [key]: holding };
        saveLocal(next);

        if (userRef.current) {
          const supabase = getSupabase();
          supabase
            .from("portfolios")
            .upsert(portfolioToRow(next, userRef.current.id));
        }

        return next;
      });
    },
    []
  );

  return { portfolio, updateAsset };
}
