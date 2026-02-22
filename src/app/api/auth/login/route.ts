import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}?error=config`);
  }

  const origin = new URL(request.url).origin;
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}?error=auth`);
  }

  return NextResponse.redirect(data.url);
}
