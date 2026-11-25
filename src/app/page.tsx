import { BudgetView } from "@/components/budget/budget-view";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getQuickActions } from "@/data/budget-quick-actions";
import { getAccountAccess } from "@/lib/budget-access";
import { loadBudget } from "@/data/budget-server";

export default async function Page() {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await getAccountAccess(supabase, user);
  const metadata = user.user_metadata;
  const name = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : user.email?.split("@")[0] ?? "Hesabım";
  const picture = metadata.avatar_url ?? metadata.picture;
  const avatar = typeof picture === "string" && picture.startsWith("https://") ? picture : null;
  const profile = { name, email: user.email ?? "", avatar, role: access.role };
  const [initial, quickActions] = await Promise.all([loadBudget(), getQuickActions()]);
  return <BudgetView key={`${user.id}:${access.ownerId}`} profile={profile} initial={initial} quickActions={quickActions} />;
}
