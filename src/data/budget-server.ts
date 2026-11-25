"use server";

import { budgetContext as context } from "@/lib/budget-access";
import { entryFromRow, fixedFromRow, amountToCents, type EntryRow, type FixedRow } from "@/lib/budget-mapping";
import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetPeriodForDate, isValidMonth } from "@/lib/budget";
import { validCategory, validEntry } from "@/lib/budget-validation";
import { groupCardStatements, isCardStatementCategory } from "@/lib/budget-categories";
import type { BudgetCategory, BudgetEntry, BudgetPreferences } from "@/types/budget";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY_COLUMNS = "id,label,amount,month,spent_on,created_at,category_id";
const FIXED_COLUMNS = "id,name,amount,valid_from,valid_to,created_at";


async function readRows<T>(db: SupabaseClient, table: string, columns: string, userId: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select(columns).eq("user_id", userId).order(table === "budget_savings_targets" ? "month" : "id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data as unknown as T[]);
    if (data.length < 500) break;
  }
  return rows;
}

export async function loadBudget(): Promise<{ entries: BudgetEntry[]; preferences: BudgetPreferences; error: string }> {
  try {
    const { db, userId } = await context();
    const [rows, categories, savingsRows, incomes, fixed, targetRows] = await Promise.all([
      readRows<EntryRow>(db, "budget_entries", ENTRY_COLUMNS, userId),
      readRows<BudgetCategory>(db, "budget_categories", "id,name,created_at", userId),
      readRows<{ month: string; amount: number | string }>(db, "savings", "id,month,amount", userId),
      readRows<FixedRow>(db, "budget_incomes", FIXED_COLUMNS, userId),
      readRows<FixedRow>(db, "budget_fixed_expenses", FIXED_COLUMNS, userId),
      readRows<{ month: string; amount: number | string }>(db, "budget_savings_targets", "month,amount", userId),
    ]);
    if (!categories.every(validCategory)) throw new Error("Geçersiz kategori kaydı.");
    const savings: Record<string, number> = {};
    for (const row of savingsRows) {
      const month = row.month.slice(0, 7);
      if (!isValidMonth(month)) throw new Error("Geçersiz birikim kaydı.");
      savings[month] = amountToCents(row.amount);
    }
    const savingsTargets: Record<string, number> = {};
    for (const row of targetRows) {
      const month = row.month.slice(0, 7);
      if (!isValidMonth(month)) throw new Error("Geçersiz hedef dönemi.");
      savingsTargets[month] = amountToCents(row.amount);
    }
    const automatic = systemCategories(categories);
    const incomeCategory = automatic[0].id;
    const statementIds = new Set(categories.filter(category => isCardStatementCategory(category.name)).map(category => category.id));
    const entries = [
      ...rows.filter(row => amountToCents(row.amount) > 0).map(row => entryFromRow(row, statementIds.has(row.category_id ?? ""))),
      ...incomes.filter(row => amountToCents(row.amount) > 0).map(row => fixedFromRow(row, "income", row.valid_from === row.valid_to ? incomeCategory : undefined)),
      ...fixed.filter(row => amountToCents(row.amount) > 0).map(row => fixedFromRow(row, "expense")),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const grouped = groupCardStatements(categories, entries);
    return { entries: grouped.entries, preferences: { categories: [...grouped.categories.filter(category => category.name.trim().toLocaleLowerCase("tr-TR") !== "sabit" && !automatic.some(item => item.id === category.id)), ...automatic], savings, savingsTargets }, error: "" };
  } catch {
    return { entries: [], preferences: { categories: [], savings: {} }, error: "Bütçe verileri yüklenemedi. Bağlantını kontrol edip tekrar dene." };
  }
}

function systemCategories(categories: BudgetCategory[]) {
  return [
    { ...(categories.find(category => category.name === "Gelir") ?? { id: "__income__", name: "Gelir" }), automatic: true },
  ];
}

export async function saveEntry(entry: BudgetEntry): Promise<{ entry?: BudgetEntry; category?: BudgetCategory; error?: string }> {
  if (!validEntry(entry)) return { error: "İşlem bilgilerini kontrol et." };
  const source = /^(income|expense):(.+)$/.exec(entry.id);
  const rawId = source?.[2] ?? entry.id;
  if (!UUID.test(rawId)) return { error: "Geçersiz işlem kimliği." };
  const fixed = Boolean(source || entry.recurrence || entry.kind === "income");
  if (entry.description.length > (fixed ? 60 : 80)) return { error: `Açıklama en fazla ${fixed ? 60 : 80} karakter olmalı.` };
  if (source && source[1] !== entry.kind) return { error: "Mevcut işlemin türü değiştirilemez." };
  if (!fixed && !entry.categoryId) return { error: "Kategori seçmelisin." };
  if (entry.recurrence?.excludedMonths.length) return { error: "Bu kayıtta ay atlama desteklenmiyor." };
  try {
    const { db, userId } = await context(true);
    if (fixed) {
      const existingCategories = await readRows<BudgetCategory>(db, "budget_categories", "id,name", userId);
      const automatic = systemCategories(existingCategories);
      const table = entry.kind === "income" ? "budget_incomes" : "budget_fixed_expenses";
      const payload = { user_id: userId, id: rawId, name: entry.description.trim(), amount: entry.amountCents / 100,
        valid_from: entry.date, valid_to: entry.recurrence ? (entry.recurrence.endMonth ? `${entry.recurrence.endMonth}-01` : null) : entry.date };
      const { data, error } = await db.from(table).upsert(payload, { onConflict: "id" }).select(FIXED_COLUMNS).single();
      if (error) throw error;
      const category = entry.kind === "income" && data.valid_from === data.valid_to ? automatic[0] : undefined;
      return { entry: fixedFromRow(data, entry.kind, category?.id), category };
    }
    // A regular expense cannot be moved to another source table by editing it.
    if (source) return { error: "Geçersiz işlem." };
    const categoryResult = await db.from("budget_categories").select("id,name").eq("id", entry.categoryId!).eq("user_id", userId).single();
    if (categoryResult.error || !categoryResult.data) return { error: "Kategori bulunamadı." };
    const category: BudgetCategory = categoryResult.data;
    if (category.name.toLocaleLowerCase("tr-TR") === "kategorisiz") return { error: "Geçerli bir kategori seçmelisin." };
    const statementCategories = isCardStatementCategory(category.name) ? await readRows<BudgetCategory>(db, "budget_categories", "id,name", userId) : null;
    let storedMonth = `${entry.date.slice(0, 7)}-01`;
    let storedDate: string | null = entry.date;
    if (statementCategories) {
      const previous = await db.from("budget_entries").select(ENTRY_COLUMNS).eq("id", rawId).eq("user_id", userId).maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data && !previous.data.spent_on && entryFromRow(previous.data, true).date === entry.date) {
        storedMonth = previous.data.month;
        storedDate = null;
      }
    }
    const { data, error } = await db.from("budget_entries").upsert({
      user_id: userId, id: rawId, label: entry.description.trim(), amount: entry.amountCents / 100,
      month: storedMonth, spent_on: storedDate, category_id: category.id,
    }, { onConflict: "id" }).select(ENTRY_COLUMNS).single();
    if (error) throw error;
    if (statementCategories) {
      const grouped = groupCardStatements(statementCategories, [entryFromRow(data, true)]);
      return { entry: grouped.entries[0], category: grouped.categories.find(item => item.id === grouped.entries[0].categoryId) };
    }
    return { entry: entryFromRow(data), category };
  } catch { return { error: "İşlem kaydedilemedi. Lütfen tekrar dene." }; }
}

export async function deleteEntries(ids: string[], month: string): Promise<{ deletedIds?: string[]; error?: string }> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || !isValidMonth(month)) return { error: "Silinecek işlemleri kontrol et." };
  const normal = ids.filter(id => UUID.test(id));
  const incomes = ids.filter(id => id.startsWith("income:") && UUID.test(id.slice(7)));
  if (normal.length + incomes.length !== ids.length) return { error: "Silinecek işlemleri kontrol et." };
  const deletedIds: string[] = [];
  try {
    const { db, userId } = await context(true);
    if (normal.length) {
      const [originals, categories] = await Promise.all([
        db.from("budget_entries").select(ENTRY_COLUMNS).eq("user_id", userId).in("id", normal),
        readRows<BudgetCategory>(db, "budget_categories", "id,name", userId),
      ]);
      if (originals.error) throw originals.error;
      const statementIds = new Set(categories.filter(category => isCardStatementCategory(category.name)).map(category => category.id));
      const groups = new Map<string, EntryRow[]>();
      for (const row of originals.data as EntryRow[]) {
        if (budgetPeriodForDate(entryFromRow(row, statementIds.has(row.category_id ?? "")).date) !== month) continue;
        const key = `${row.month}|${row.spent_on ?? ""}|${row.category_id ?? ""}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      for (const rows of groups.values()) {
        let deletion = db.from("budget_entries").delete().eq("user_id", userId).in("id", rows.map(row => row.id)).eq("month", rows[0].month);
        deletion = rows[0].category_id ? deletion.eq("category_id", rows[0].category_id) : deletion.is("category_id", null);
        deletion = rows[0].spent_on ? deletion.eq("spent_on", rows[0].spent_on) : deletion.is("spent_on", null);
        const { data, error } = await deletion.select("id");
        if (error) throw error;
        deletedIds.push(...(data ?? []).map(row => row.id));
      }
    }
    if (incomes.length) {
      const { data, error } = await db.from("budget_incomes").select("id,valid_from,valid_to").eq("user_id", userId).in("id", incomes.map(id => id.slice(7)));
      if (error) throw error;
      const dates = new Set(data.filter(row => row.valid_from === row.valid_to && budgetPeriodForDate(row.valid_from) === month).map(row => row.valid_from as string));
      for (const date of dates) {
        // Repeat both date conditions at deletion time, protecting a row that
        // another device changed to a recurring income after the initial read.
        const deleted = await db.from("budget_incomes").delete().eq("user_id", userId)
          .in("id", incomes.map(id => id.slice(7))).eq("valid_from", date).eq("valid_to", date).select("id");
        if (deleted.error) throw deleted.error;
        deletedIds.push(...deleted.data.map(row => `income:${row.id}`));
      }
    }
    return { deletedIds };
  } catch { return { deletedIds, error: deletedIds.length ? "Bazı işlemler silinemedi. Kalanları tekrar deneyebilirsin." : "İşlemler silinemedi. Lütfen tekrar dene." }; }
}

export async function saveCategory(category: BudgetCategory): Promise<{ error?: string }> {
  if (!validCategory(category) || !UUID.test(category.id) || ["sabit", "gelir", "kategorisiz"].includes(category.name.trim().toLocaleLowerCase("tr-TR"))) return { error: "Kategori adını kontrol et." };
  if (isCardStatementCategory(category.name) && category.name.trim().toLocaleLowerCase("tr-TR") !== "kart ekstresi") return { error: "Kategori olarak Kart Ekstresi kullan. Banka adını işlem açıklamasına yaz." };
  try {
    const { db, userId } = await context(true);
    const existing = await db.from("budget_categories").select("name").eq("id", category.id).eq("user_id", userId).limit(1);
    if (existing.error) throw existing.error;
    if (existing.data.some(row => ["Sabit", "Gelir"].includes(row.name) || isCardStatementCategory(row.name))) return { error: "Bu ortak kategori değiştirilemez." };
    const { error } = await db.from("budget_categories").upsert({ user_id: userId, id: category.id, name: category.name.trim() }, { onConflict: "id" });
    if (error) throw error;
    return {};
  } catch { return { error: "Kategori kaydedilemedi. Lütfen tekrar dene." }; }
}

export async function saveSavings(month: string, cents: number): Promise<{ error?: string }> {
  if (!isValidMonth(month) || !Number.isSafeInteger(cents) || cents < 0) return { error: "Birikim tutarını kontrol et." };
  try {
    const { db, userId } = await context(true);
    const { error } = await db.from("savings").upsert({ user_id: userId, month: `${month}-01`, amount: cents / 100, updated_at: new Date().toISOString() }, { onConflict: "user_id,month" });
    if (error) throw error;
    return {};
  } catch { return { error: "Birikim kaydedilemedi. Lütfen tekrar dene." }; }
}


export async function saveSavingsTarget(month: string, cents: number): Promise<{ error?: string }> {
  if (!isValidMonth(month) || !Number.isSafeInteger(cents) || cents < 0) return { error: "Hedef tutarını kontrol et." };
  try {
    const { db, userId } = await context(true);
    const { error } = await db.from("budget_savings_targets").upsert({ user_id: userId, month: `${month}-01`, amount: cents / 100, updated_at: new Date().toISOString() }, { onConflict: "user_id,month" });
    if (error) throw error;
    return {};
  } catch { return { error: "Birikim hedefi kaydedilemedi." }; }
}
