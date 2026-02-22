import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (hasSupabaseConfig()) {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(origin);
}
