"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleSignIn({ config, failed }: { config: { url: string; key: string } | null; failed: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(failed ? "Google ile giriş tamamlanamadı. Lütfen tekrar dene." : "");

  async function signIn() {
    if (!config || pending) return;
    setError("");
    setPending(true);
    try {
      const supabase = createBrowserClient(config.url, config.key);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch {
      setError("Google ile bağlantı kurulamadı. Lütfen tekrar dene.");
      setPending(false);
    }
  }

  return <div className="space-y-4">
    <Button onClick={signIn} disabled={!config || pending} variant="outline" className="h-13 w-full gap-3 rounded-xl bg-background text-sm font-medium shadow-sm" aria-busy={pending}>
      {pending ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>}
      {pending ? "Google’a yönlendiriliyorsun…" : "Google ile devam et"}
    </Button>
    {!config && <p role="status" className="text-sm leading-6 text-muted-foreground">Giriş şu anda kullanılamıyor. Lütfen daha sonra tekrar dene.</p>}
    {error && <p role="alert" className="text-sm leading-6 text-destructive">{error}</p>}
  </div>;
}
