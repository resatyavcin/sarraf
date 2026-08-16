import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess } from "@/lib/account-access";
import type { AccountRole, SavingEntry } from "@/lib/types";

const MONTH_RE = /^\d{4}-\d{2}$/;
const NO_STORE = { "Cache-Control": "private, no-store" };

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthToDbDate(month: string): string {
  return `${month}-01`;
}

function dbDateToMonth(value: string): string {
  return value.slice(0, 7);
}

function last12MonthKeys(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

function fillLast12(rows: { month: string; amount: number }[]): SavingEntry[] {
  const map = new Map(rows.map((r) => [r.month, r.amount]));
  return last12MonthKeys().map((month) => ({
    month,
    amount: map.get(month) ?? 0,
  }));
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { entries: fillLast12([]), access: "owner" as AccountRole },
      { headers: NO_STORE }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { entries: fillLast12([]), access: "owner" as AccountRole },
      { headers: NO_STORE }
    );
  }

  const access = await getAccountAccess(supabase, user);
  const start = last12MonthKeys()[0];
  const { data } = await supabase
    .from("savings")
    .select("month, amount")
    .eq("user_id", access.ownerId)
    .gte("month", monthToDbDate(start))
    .order("month", { ascending: true });

  const rows = (data ?? []).map((r) => ({
    month: dbDateToMonth(String(r.month)),
    amount: Number(r.amount) || 0,
  }));

  return NextResponse.json(
    { entries: fillLast12(rows), access: access.role },
    { headers: NO_STORE }
  );
}

export async function PUT(request: Request) {
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

  let body: { month?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  const month = typeof body.month === "string" ? body.month : "";
  const amount = Number(body.amount);

  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400, headers: NO_STORE });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400, headers: NO_STORE });
  }

  const { error } = await supabase.from("savings").upsert(
    {
      user_id: user.id,
      month: monthToDbDate(month),
      amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
