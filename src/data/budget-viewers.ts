"use server";

import { budgetContext } from "@/lib/budget-access";
import type { BudgetViewer } from "@/types/account";

const normalize = (email: string) => email.trim().toLowerCase();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export async function getBudgetViewers(): Promise<{ items: BudgetViewer[]; error?: string }> {
  try {
    const { db, userId } = await budgetContext(true);
    const { data, error } = await db.from("viewers").select("viewer_email,created_at").eq("host_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return { items: data.map(row => ({ email: row.viewer_email, createdAt: row.created_at })) };
  } catch { return { items: [], error: "Görüntüleyiciler yüklenemedi." }; }
}

export async function addBudgetViewer(email: string): Promise<{ error?: string }> {
  if (typeof email !== "string" || !validEmail(normalize(email))) return { error: "Geçerli bir e-posta adresi gir." };
  try {
    const { db, userId, user } = await budgetContext(true);
    const address = normalize(email);
    if (address === normalize(user.email ?? "")) return { error: "Kendi adresini ekleyemezsin." };
    const { error } = await db.from("viewers").insert({ host_id: userId, viewer_email: address });
    if (error) return { error: error.code === "23505" ? "Bu adres zaten bir bütçeye bağlı." : "Görüntüleyici eklenemedi." };
    return {};
  } catch { return { error: "Görüntüleyici eklenemedi." }; }
}

export async function removeBudgetViewer(email: string): Promise<{ error?: string }> {
  if (typeof email !== "string" || !validEmail(normalize(email))) return { error: "Geçersiz e-posta adresi." };
  try {
    const { db, userId } = await budgetContext(true);
    const { error } = await db.from("viewers").delete().eq("host_id", userId).eq("viewer_email", normalize(email));
    if (error) throw error;
    return {};
  } catch { return { error: "Görüntüleyici kaldırılamadı." }; }
}
