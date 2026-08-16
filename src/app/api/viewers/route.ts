import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess, normalizeEmail } from "@/lib/account-access";
import type { ViewerEntry } from "@/lib/types";

const NO_STORE = { "Cache-Control": "private, no-store" };
const GMAIL_RE = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i;

function isGmail(email: string): boolean {
  return GMAIL_RE.test(email);
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ viewers: [], access: "owner" }, { headers: NO_STORE });
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const access = await getAccountAccess(supabase, user);
  if (access.role === "viewer") {
    return NextResponse.json({ viewers: [], access: "viewer" }, { headers: NO_STORE });
  }

  const { data, error } = await supabase
    .from("viewers")
    .select("viewer_email, created_at")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  const viewers: ViewerEntry[] = (data ?? []).map((r) => ({
    email: String(r.viewer_email),
    createdAt: String(r.created_at),
  }));

  return NextResponse.json({ viewers, access: "owner" }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const access = await getAccountAccess(supabase, user);
  if (access.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email || !isGmail(email)) {
    return NextResponse.json(
      { error: "Geçerli bir Gmail adresi girin" },
      { status: 400, headers: NO_STORE }
    );
  }

  const selfEmail = normalizeEmail(user.email ?? "");
  if (selfEmail && email === selfEmail) {
    return NextResponse.json(
      { error: "Kendi adresinizi ekleyemezsiniz" },
      { status: 400, headers: NO_STORE }
    );
  }

  const { error } = await supabase.from("viewers").insert({
    host_id: user.id,
    viewer_email: email,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Bu adres zaten bir hesaba ekli" },
        { status: 409, headers: NO_STORE }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const access = await getAccountAccess(supabase, user);
  if (access.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: NO_STORE });
  }

  const { error } = await supabase
    .from("viewers")
    .delete()
    .eq("host_id", user.id)
    .eq("viewer_email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
