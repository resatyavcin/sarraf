import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(`${origin}?error=config`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(origin);
    }
  }

  return NextResponse.redirect(`${origin}?error=auth`);
}
