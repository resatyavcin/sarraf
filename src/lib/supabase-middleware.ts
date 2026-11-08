import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_MUTATIONS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/auth/callback",
];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // API handlers validate the user themselves and persist refreshed cookies.
  // Avoid an extra remote auth request before every API request.
  if (pathname.startsWith("/api/") || !request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) {
    return NextResponse.next();
  }
  if (AUTH_MUTATIONS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}
