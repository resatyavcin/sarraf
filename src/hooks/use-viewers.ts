"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ViewerEntry } from "@/lib/types";

export function useViewers(user: User | null, enabled: boolean) {
  const [viewers, setViewers] = useState<ViewerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !enabled) {
      setViewers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/viewers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Liste alınamadı");
        setViewers([]);
        return;
      }
      setViewers(Array.isArray(data.viewers) ? data.viewers : []);
    } catch {
      setError("Liste alınamadı");
      setViewers([]);
    } finally {
      setLoading(false);
    }
  }, [user, enabled]);

  useEffect(() => {
    if (!user || !enabled) {
      setViewers([]);
      return;
    }
    refresh();
  }, [user, enabled, refresh]);

  const addViewer = useCallback(
    async (email: string) => {
      setError(null);
      const res = await fetch("/api/viewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Eklenemedi");
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  const removeViewer = useCallback(
    async (email: string) => {
      setError(null);
      const res = await fetch("/api/viewers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Silinemedi");
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  return { viewers, loading, error, addViewer, removeViewer };
}
