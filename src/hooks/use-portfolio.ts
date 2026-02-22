"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Portfolio, AssetHolding, AssetKey } from "@/lib/types";
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

    (async () => {
      try {
        const res = await fetch("/api/portfolio");
        const data = await res.json();
        setPortfolio(data);
        saveLocal(data);
      } catch {
        const local = loadLocal();
        setPortfolio(local);
        if (!isEmpty(local)) {
          try {
            await fetch("/api/portfolio", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(local),
            });
          } catch {
            /* ignore */
          }
        }
      }
    })();
  }, [user]);

  const updateAsset = useCallback(
    async (key: AssetKey, holding: AssetHolding) => {
      const next = { ...portfolio, [key]: holding };
      setPortfolio(next);
      saveLocal(next);

      if (userRef.current) {
        try {
          await fetch("/api/portfolio", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
        } catch {
          /* ignore */
        }
      }
    },
    [portfolio]
  );

  const resetPortfolio = useCallback(async () => {
    setPortfolio(DEFAULT);
    saveLocal(DEFAULT);

    if (userRef.current) {
      try {
        await fetch("/api/portfolio", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT),
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { portfolio, updateAsset, resetPortfolio };
}
