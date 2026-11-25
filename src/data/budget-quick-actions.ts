"use server";

import { budgetContext as context } from "@/lib/budget-access";

export type QuickAction = { id: string; label: string; categoryId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export async function getQuickActions(): Promise<{ items: QuickAction[]; error?: string }> {
  try {
    const { db, userId, access } = await context();
    if (access.role === "viewer") return { items: [] };
    const items: QuickAction[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("budget_quick_actions").select("id,label,category_id").eq("user_id", userId).order("label").order("id").range(offset, offset + 499);
      if (error) throw error;
      items.push(...data.map(row => ({ id: row.id, label: row.label, categoryId: row.category_id })));
      if (data.length < 500) break;
    }
    return { items };
  } catch { return { items: [], error: "Hızlı seçimler şu an yüklenemiyor." }; }
}

export async function addQuickAction(categoryId: string, label: string): Promise<{ item?: QuickAction; error?: string }> {
  if (!uuid.test(categoryId) || typeof label !== "string" || !label.trim() || label.trim().length > 80) return { error: "Kategori ve açıklamayı kontrol et." };
  try {
    const { db, userId } = await context(true);
    const category = await db.from("budget_categories").select("id").eq("user_id", userId).eq("id", categoryId).single();
    if (category.error || !category.data) return { error: "Kategori bulunamadı." };
    const { data, error } = await db.from("budget_quick_actions").insert({ user_id: userId, category_id: categoryId, label: label.trim() }).select("id,label,category_id").single();
    if (error) return { error: error.code === "23505" ? "Bu hızlı seçim zaten var." : "Hızlı seçim kaydedilemedi." };
    return { item: { id: data.id, label: data.label, categoryId: data.category_id } };
  } catch { return { error: "Hızlı seçim kaydedilemedi." }; }
}

export async function removeQuickAction(id: string): Promise<{ error?: string }> {
  if (!uuid.test(id)) return { error: "Geçersiz hızlı seçim." };
  try {
    const { db, userId } = await context(true);
    const { error } = await db.from("budget_quick_actions").delete().eq("user_id", userId).eq("id", id);
    if (error) throw error;
    return {};
  } catch { return { error: "Hızlı seçim kaldırılamadı." }; }
}
