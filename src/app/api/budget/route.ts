import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseConfig } from "@/lib/supabase-server";
import { getAccountAccess } from "@/lib/account-access";
import { isBudgetBank } from "@/lib/budget";
import type { AccountRole, BudgetCategory, BudgetEntry, BudgetItem, BudgetStatement } from "@/lib/types";

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

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        access: "owner" as AccountRole,
        incomes: [],
        fixedExpenses: [],
        categories: [],
        entries: [],
        statements: [],
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

  const [incomes, fixedExpenses, categories, entries, statements] = await Promise.all([
    supabase
      .from("budget_incomes")
      .select("id, name, amount, valid_from, valid_to")
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("budget_fixed_expenses")
      .select("id, name, amount, valid_from, valid_to")
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("budget_categories")
      .select("id, name, kind")
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("budget_entries")
      .select("id, month, category_id, label, amount")
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("budget_statements")
      .select("month, bank, amount")
      .eq("user_id", access.ownerId),
  ]);

  const error =
    incomes.error || fixedExpenses.error || categories.error || entries.error || statements.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  const incomeRows: BudgetItem[] = (incomes.data ?? []).map((row) => mapItem(row));
  const fixedRows: BudgetItem[] = (fixedExpenses.data ?? []).map((row) => mapItem(row));
  const categoryRows: BudgetCategory[] = (categories.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: row.kind === "statement" ? "statement" : "custom",
  }));
  const entryRows: BudgetEntry[] = (entries.data ?? []).map((row) => ({
    id: String(row.id),
    month: dbDateToMonth(String(row.month)),
    categoryId: String(row.category_id),
    label: String(row.label),
    amount: Number(row.amount) || 0,
  }));
  const statementRows: BudgetStatement[] = (statements.data ?? []).flatMap((row) => {
    if (!isBudgetBank(row.bank)) return [];
    return [
      {
        month: dbDateToMonth(String(row.month)),
        bank: row.bank,
        amount: Number(row.amount) || 0,
      },
    ];
  });

  return NextResponse.json(
    {
      access: access.role,
      incomes: incomeRows,
      fixedExpenses: fixedRows,
      categories: categoryRows,
      entries: entryRows,
      statements: statementRows,
    },
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
    if (!id || !name) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400, headers: NO_STORE });
    }
    const { error } = await supabase.from("budget_categories").upsert(
      { id, user_id: user.id, name, kind: "custom" },
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

    const { error } = await supabase.from("budget_entries").upsert(
      {
        id,
        user_id: user.id,
        month: monthToDbDate(month),
        category_id: categoryId,
        label,
        amount,
      },
      { onConflict: "id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true, categoryId }, { headers: NO_STORE });
  }

  if (op === "save-statement" || op === "delete-statement") {
    const month = cleanMonth(body.month);
    const bank = isBudgetBank(body.bank) ? body.bank : null;
    if (!month || !bank) {
      return NextResponse.json({ error: "Invalid statement" }, { status: 400, headers: NO_STORE });
    }
    if (op === "delete-statement") {
      const { error } = await supabase
        .from("budget_statements")
        .delete()
        .eq("user_id", user.id)
        .eq("month", monthToDbDate(month))
        .eq("bank", bank);
      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    const amount = cleanAmount(body.amount);
    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: "Invalid statement" }, { status: 400, headers: NO_STORE });
    }
    const { error } = await supabase.from("budget_statements").upsert(
      {
        user_id: user.id,
        month: monthToDbDate(month),
        bank,
        amount,
      },
      { onConflict: "user_id,month,bank" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400, headers: NO_STORE });
}
