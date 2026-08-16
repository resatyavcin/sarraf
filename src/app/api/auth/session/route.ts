import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ user: null });
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return NextResponse.json(
    { user: user ?? null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
