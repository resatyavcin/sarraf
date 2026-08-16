import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerSupabase,
  hasSupabaseConfig,
  redirectWithCookies,
  type CookieToSet,
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(`${origin}?error=config`);
  }

  if (code) {
    const cookieStore = await cookies();
    const pending: CookieToSet[] = [];
    const supabase = createServerSupabase(cookieStore, (c) => pending.push(...c));
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectWithCookies(origin, pending);
    }
  }

  return NextResponse.redirect(`${origin}?error=auth`);
}
