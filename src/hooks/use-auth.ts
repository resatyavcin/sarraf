"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("Session request failed");
      const { user: u } = await res.json();
      setUser(u ?? null);
    } catch {
      setError("Oturum kontrolü tamamlanamadı. Bağlantını kontrol edip yeniden dene.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signInWithGoogle = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const signOut = useCallback(() => {
    window.location.href = "/api/auth/logout";
  }, []);

  return { user, loading, error, retry: fetchSession, signInWithGoogle, signOut };
}
