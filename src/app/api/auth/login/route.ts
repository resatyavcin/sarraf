import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerSupabase,
  hasSupabaseConfig,
  redirectWithCookies,
  type CookieToSet,
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

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
