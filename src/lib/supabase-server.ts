import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";

type CookieStore = Awaited<ReturnType<typeof import("next/headers").cookies>>;

export type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON);
}

export function createServerSupabase(
  cookieStore: CookieStore,
  onSet?: (cookies: CookieToSet[]) => void
) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON!;
  if (!url || !key) throw new Error("Supabase config missing");
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
        onSet?.(cookiesToSet);
      },
    },
  });
}

export function redirectWithCookies(
  url: string,
  cookiesToSet: CookieToSet[]
) {
  const response = NextResponse.redirect(url);
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export function expireAuthCookies(
  cookieStore: CookieStore,
  pending: CookieToSet[]
) {
  const seen = new Set(pending.map((c) => c.name));
  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith("sb-") || seen.has(cookie.name)) continue;
    pending.push({
      name: cookie.name,
      value: "",
      options: { path: "/", maxAge: 0, expires: new Date(0) },
    });
  }
}
