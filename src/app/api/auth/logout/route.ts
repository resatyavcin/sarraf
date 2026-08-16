import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerSupabase,
  expireAuthCookies,
  hasSupabaseConfig,
  redirectWithCookies,
  type CookieToSet,
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pending: CookieToSet[] = [];
  const cookieStore = await cookies();

  if (hasSupabaseConfig()) {
    const supabase = createServerSupabase(cookieStore, (c) => pending.push(...c));
    await supabase.auth.signOut();
  }

  expireAuthCookies(cookieStore, pending);
  return redirectWithCookies(origin, pending);
}
