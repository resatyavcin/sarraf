import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getAccountAccess(db: SupabaseClient, user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return { ownerId: user.id, role: "owner" as const };
  const { data, error } = await db.from("viewers").select("host_id").eq("viewer_email", email).maybeSingle();
  if (error) throw new Error("Paylaşım yetkileri kontrol edilemedi.");
  return data?.host_id && data.host_id !== user.id
    ? { ownerId: String(data.host_id), role: "viewer" as const }
    : { ownerId: user.id, role: "owner" as const };
}

export async function budgetContext(write = false) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Oturumun sona erdi. Lütfen yeniden giriş yap.");
  const access = await getAccountAccess(db, user);
  if (write && access.role !== "owner") throw new Error("Bu bütçe salt okunur.");
  return { db, userId: access.ownerId, user, access };
}
