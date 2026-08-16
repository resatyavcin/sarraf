import type { User, SupabaseClient } from "@supabase/supabase-js";

export type AccountRole = "owner" | "viewer";

export interface AccountAccess {
  ownerId: string;
  role: AccountRole;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getAccountAccess(
  supabase: SupabaseClient,
  user: User
): Promise<AccountAccess> {
  const email = normalizeEmail(user.email ?? "");
  if (!email) {
    return { ownerId: user.id, role: "owner" };
  }

  const { data } = await supabase
    .from("viewers")
    .select("host_id")
    .eq("viewer_email", email)
    .maybeSingle();

  if (data?.host_id && data.host_id !== user.id) {
    return { ownerId: data.host_id as string, role: "viewer" };
  }

  return { ownerId: user.id, role: "owner" };
}
