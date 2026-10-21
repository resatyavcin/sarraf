import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerSupabase,
  hasSupabaseConfig,
  publicOrigin,
  redirectWithCookies,
  type CookieToSet,
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  const origin = publicOrigin(request);
  if (hostname === "127.0.0.1" || hostname === "::1") {
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(`${origin}${requestUrl.pathname}${requestUrl.search}`);
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(`${origin}?error=config`);
  }

  const cookieStore = await cookies();
  const pending: CookieToSet[] = [];
  const supabase = createServerSupabase(cookieStore, (c) => pending.push(...c));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}?error=auth`);
  }

  return redirectWithCookies(data.url, pending);
}
