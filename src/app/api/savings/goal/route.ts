import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess } from "@/lib/account-access";
import type { AccountRole, SavingsGoal } from "@/lib/types";

const NO_STORE = { "Cache-Control": "private, no-store" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toGoal(
  row: { target_amount: number | string; target_date: string } | null
): SavingsGoal | null {
  if (!row) return null;
  const targetAmount = Number(row.target_amount);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
  const targetDate = String(row.target_date).slice(0, 10);
  if (!DATE_RE.test(targetDate)) return null;
  return { targetAmount, targetDate };
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { goal: null, access: "owner" as AccountRole },
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
      { goal: null, access: "owner" as AccountRole },
      { headers: NO_STORE }
    );
  }

  const access = await getAccountAccess(supabase, user);
  const { data } = await supabase
    .from("savings_goal")
    .select("target_amount, target_date")
    .eq("user_id", access.ownerId)
    .maybeSingle();

  return NextResponse.json(
    { goal: toGoal(data), access: access.role },
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
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  const access = await getAccountAccess(supabase, user);
  if (access.role === "viewer") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: NO_STORE }
    );
  }

  let body: { targetAmount?: number; targetDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const targetAmount = Number(body.targetAmount);
  const targetDate =
    typeof body.targetDate === "string" ? body.targetDate.slice(0, 10) : "";

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json(
      { error: "Invalid targetAmount" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (!DATE_RE.test(targetDate)) {
    return NextResponse.json(
      { error: "Invalid targetDate" },
      { status: 400, headers: NO_STORE }
    );
  }

  const { error } = await supabase.from("savings_goal").upsert(
    {
      user_id: user.id,
      target_amount: targetAmount,
      target_date: targetDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
