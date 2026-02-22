"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const { user: u } = await res.json();
      setUser(u ?? null);
    } catch {
      setUser(null);
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

  return { user, loading, signInWithGoogle, signOut };
}
