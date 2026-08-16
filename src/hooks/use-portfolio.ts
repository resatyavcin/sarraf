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

function isEmpty(p: Portfolio) {
  return (
    p.gold.physical === 0 &&
    p.gold.digital === 0 &&
    p.usd.physical === 0 &&
    p.usd.digital === 0 &&
    p.eur.physical === 0 &&
    p.eur.digital === 0
  );
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
  const [access, setAccess] = useState<AccountRole>("owner");
  const userRef = useRef<User | null>(null);
  const accessRef = useRef<AccountRole>("owner");

  useEffect(() => {
    if (!user) {
      userRef.current = null;
      accessRef.current = "owner";
      setAccess("owner");
      setPortfolio(loadLocal());
      return;
    }

    if (userRef.current?.id === user.id) return;
    userRef.current = user;

    (async () => {
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store" });
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
      if (accessRef.current === "viewer") return;

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

  return { portfolio, updateAsset, access, isViewer: access === "viewer" };
}
