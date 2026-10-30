import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess } from "@/lib/account-access";
import type { AccountRole, BudgetItem } from "@/lib/types";

const NO_STORE = { "Cache-Control": "private, no-store" };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthToDbDate(month: string) {
  return `${month}-01`;
}

function dbDateToMonth(value: string) {
  return value.slice(0, 7);
}

function cleanName(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > max) return null;
  return name;
}

function cleanAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) return null;
  return Math.round(amount * 100) / 100;
}

function cleanId(value: unknown) {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function cleanMonth(value: unknown) {
  return typeof value === "string" && MONTH_RE.test(value) ? value : null;
}

function mapItem(row: {
  id: string;
  name: string;
  amount: number | string;
  valid_from: string;
  valid_to: string | null;
}): BudgetItem {
  return {
    id: String(row.id),
    name: String(row.name),
    amount: Number(row.amount) || 0,
    validFrom: dbDateToMonth(String(row.valid_from)),
    validTo: row.valid_to ? dbDateToMonth(String(row.valid_to)) : null,
  };
}

const PARTS = ["incomes", "fixedExpenses", "categories", "entries"] as const;
type BudgetPart = (typeof PARTS)[number];

function isBudgetPart(value: string | null): value is BudgetPart {
  return PARTS.some((part) => part === value);
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("part");
  if (requested && !isBudgetPart(requested)) {
    return NextResponse.json({ error: "Invalid part" }, { status: 400, headers: NO_STORE });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        access: "owner" as AccountRole,
        incomes: [],
        fixedExpenses: [],
        categories: [],
        entries: [],
      },
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

  const ownerId = access.ownerId;
  const wanted = (part: BudgetPart) => !requested || requested === part;
  const [incomes, fixedExpenses, categories, entries] = await Promise.all([
    wanted("incomes")
      ? supabase
          .from("budget_incomes")
          .select("id, name, amount, valid_from, valid_to")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: true })
      : null,
    wanted("fixedExpenses")
      ? supabase
          .from("budget_fixed_expenses")
          .select("id, name, amount, valid_from, valid_to")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: true })
      : null,
    wanted("categories")
      ? supabase
          .from("budget_categories")
          .select("id, name, kind, valid_from, valid_to")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: true })
      : null,
    wanted("entries")
      ? supabase
          .from("budget_entries")
          .select("id, month, category_id, label, amount, spent_on")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: true })
      : null,
  ]);

  const body: Record<string, unknown> = { access: access.role, fetched: {} };
  const fetched = body.fetched as Record<BudgetPart, boolean>;

  if (incomes) {
    fetched.incomes = !incomes.error;
    body.incomes = incomes.error ? [] : (incomes.data ?? []).map((row) => mapItem(row));
  }
  if (fixedExpenses) {
    fetched.fixedExpenses = !fixedExpenses.error;
    body.fixedExpenses = fixedExpenses.error
      ? []
      : (fixedExpenses.data ?? []).map((row) => mapItem(row));
  }
  if (categories) {
    fetched.categories = !categories.error;
    body.categories = categories.error
      ? []
      : (categories.data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          kind: row.kind === "statement" ? "statement" : "custom",
          validFrom: row.valid_from ? dbDateToMonth(String(row.valid_from)) : null,
          validTo: row.valid_to ? dbDateToMonth(String(row.valid_to)) : null,
        }));
  }
  if (entries) {
    fetched.entries = !entries.error;
    body.entries = entries.error
      ? []
      : (entries.data ?? []).map((row) => ({
          id: String(row.id),
          month: dbDateToMonth(String(row.month)),
          categoryId: String(row.category_id),
          label: String(row.label),
          amount: Number(row.amount) || 0,
          spentOn: row.spent_on ? String(row.spent_on).slice(0, 10) : null,
        }));
  }
  return NextResponse.json(body, { headers: NO_STORE });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  const op = typeof body.op === "string" ? body.op : "";
  const id = cleanId(body.id);

  if (
    (op === "delete-income" || op === "delete-fixed" || op === "delete-category" || op === "delete-entry") &&
    !id
  ) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: NO_STORE });
  }

  if (op === "delete-income" && id) {
    const { error } = await supabase.from("budget_incomes").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "delete-fixed" && id) {
    const { error } = await supabase
      .from("budget_fixed_expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "delete-entry" && id) {
    const { error } = await supabase.from("budget_entries").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "delete-category" && id) {
    const { data: category } = await supabase
      .from("budget_categories")
      .select("kind")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    const { error } = await supabase.from("budget_categories").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "save-income" || op === "save-fixed") {
    const name = cleanName(body.name, 60);
    const amount = cleanAmount(body.amount);
    const validFrom = cleanMonth(body.validFrom);
    const validTo = body.validTo == null || body.validTo === "" ? null : cleanMonth(body.validTo);
    if (!id || !name || amount === null || !validFrom || (body.validTo && !validTo)) {
      return NextResponse.json({ error: "Invalid item" }, { status: 400, headers: NO_STORE });
    }
    if (validTo && validTo < validFrom) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400, headers: NO_STORE });
    }
    const table = op === "save-income" ? "budget_incomes" : "budget_fixed_expenses";
    const { error } = await supabase.from(table).upsert(
      {
        id,
        user_id: user.id,
        name,
        amount,
        valid_from: monthToDbDate(validFrom),
        valid_to: validTo ? monthToDbDate(validTo) : null,
      },
      { onConflict: "id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "save-category") {
    const name = cleanName(body.name, 60);
    const kind = body.kind === "statement" ? "statement" : "custom";
    const validFrom = body.validFrom == null || body.validFrom === "" ? null : cleanMonth(body.validFrom);
    const validTo = body.validTo == null || body.validTo === "" ? null : cleanMonth(body.validTo);
    if (!id || !name || (kind === "statement" && !validFrom)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400, headers: NO_STORE });
    }
    if ((body.validFrom && !validFrom) || (body.validTo && !validTo)) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400, headers: NO_STORE });
    }
    if (validFrom && validTo && validTo < validFrom) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400, headers: NO_STORE });
    }
    const { error } = await supabase.from("budget_categories").upsert(
      {
        id,
        user_id: user.id,
        name,
        kind,
        valid_from: validFrom ? monthToDbDate(validFrom) : null,
        valid_to: validTo ? monthToDbDate(validTo) : null,
      },
      { onConflict: "id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (op === "save-entry") {
    const label = cleanName(body.label, 80);
    const amount = cleanAmount(body.amount);
    const month = cleanMonth(body.month);
    const categoryId = cleanId(body.categoryId);
    const spentOn =
      typeof body.spentOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.spentOn) ? body.spentOn : null;
    if (!id || !label || amount === null || !month) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400, headers: NO_STORE });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400, headers: NO_STORE });
    }

    const { data: category } = await supabase
      .from("budget_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400, headers: NO_STORE });
    }
    if (spentOn && !spentOn.startsWith(`${month}-`)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400, headers: NO_STORE });
    }

    const { error } = await supabase.from("budget_entries").upsert(
      {
        id,
        user_id: user.id,
        month: monthToDbDate(month),
        category_id: categoryId,
        label,
        amount,
        spent_on: spentOn,
      },
      { onConflict: "id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true, categoryId }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400, headers: NO_STORE });
}
