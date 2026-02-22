import { createServerClient } from "@supabase/ssr";

type CookieStore = Awaited<ReturnType<typeof import("next/headers").cookies>>;

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON);
}

export function createServerSupabase(cookieStore: CookieStore) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON!;
  if (!url || !key) throw new Error("Supabase config missing");
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
