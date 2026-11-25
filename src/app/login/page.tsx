import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const config = getSupabaseConfig();
  if (config) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  }
  const { error } = await searchParams;
  return <main className="flex min-h-dvh flex-col bg-background">
    <header className="mx-auto w-full max-w-6xl px-6 py-7 sm:px-10"><span className="text-xl font-semibold tracking-tight">Sarraf</span></header>
    <div className="mx-auto flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-10">
      <section className="mx-auto w-full max-w-sm py-8 text-center">
        <p className="mb-3 text-sm font-medium text-primary">Her şey bir girişle başlar</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sarraf’a hoş geldin</h1>
        <p className="mt-4 mb-9 text-sm leading-7 text-muted-foreground">Bütçeni yönetmeye başlamak için Google hesabınla giriş yap.</p>
        <GoogleSignIn config={config} failed={Boolean(error)} />
      </section>
    </div>
    <footer className="px-6 py-6 text-center text-xs text-muted-foreground">Sarraf · Kişisel bütçen, daha anlaşılır.</footer>
  </main>;
}
