import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess } from "@/lib/account-access";
import type { Portfolio } from "@/lib/types";

const DEFAULT: Portfolio = {
  gold: { physical: 0, digital: 0 },
  usd: { physical: 0, digital: 0 },
  eur: { physical: 0, digital: 0 },
};

const NO_STORE = { "Cache-Control": "private, no-store" };

function rowToPortfolio(row: Record<string, unknown>): Portfolio {
  return {
    gold: {
      physical: Number(row.gold_physical) || 0,
      digital: Number(row.gold_digital) || 0,
    },
    usd: {
      physical: Number(row.usd_physical) || 0,
      digital: Number(row.usd_digital) || 0,
    },
    eur: {
      physical: Number(row.eur_physical) || 0,
      digital: Number(row.eur_digital) || 0,
    },
  };
}

function portfolioToRow(p: Portfolio, userId: string) {
  return {
    user_id: userId,
    gold_physical: p.gold.physical,
    gold_digital: p.gold.digital,
    usd_physical: p.usd.physical,
    usd_digital: p.usd.digital,
    eur_physical: p.eur.physical,
    eur_digital: p.eur.digital,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { ...DEFAULT, access: "owner" as const },
      { status: 503, headers: NO_STORE }
    );
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

  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", access.ownerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Portfolio read failed" }, { status: 500, headers: NO_STORE });
  }

  if (!data) {
    return NextResponse.json(
      { ...DEFAULT, access: access.role },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ...rowToPortfolio(data), access: access.role },
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

  let body: Portfolio;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid portfolio" }, { status: 400, headers: NO_STORE });
  }
  for (const key of ["gold", "usd", "eur"] as const) {
    for (const side of ["physical", "digital"] as const) {
      const value = body[key]?.[side];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400, headers: NO_STORE });
      }
      body[key][side] = Math.round(value * 100) / 100;
    }
  }

  const { error } = await supabase.from("portfolios").upsert(
    portfolioToRow(body, user.id), { onConflict: "user_id" }
  );
  if (error) {
    return NextResponse.json({ error: "Portfolio save failed" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
