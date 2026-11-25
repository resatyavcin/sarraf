"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { addBudgetViewer, getBudgetViewers, removeBudgetViewer } from "@/data/budget-viewers";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/booking-link/panel-sheet";
import { DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AccountProfile, BudgetViewer } from "@/types/account";

export function AccountMenu({ profile }: { profile: AccountProfile }) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [viewers, setViewers] = useState<BudgetViewer[] | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const toast = useToast();
  useEffect(() => {
    if (!open || profile.role !== "owner") return;
    let cancelled = false;
    getBudgetViewers().then(result => { if (!cancelled) { setViewers(result.items); setError(result.error ?? ""); } }).catch(() => { if (!cancelled) setError("Görüntüleyiciler yüklenemedi."); });
    return () => { cancelled = true; };
  }, [open, profile.role]);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const result = await addBudgetViewer(email);
      if (result.error) { toast.error(result.error); return; }
      setViewers(current => [{ email: email.trim().toLowerCase(), createdAt: new Date().toISOString() }, ...(current ?? [])]);
      setEmail(""); toast.success("Görüntüleyici eklendi");
    } catch { toast.error("Görüntüleyici eklenemedi."); }
    finally { busy.current = false; setPending(false); }
  }
  async function remove(address: string) {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const result = await removeBudgetViewer(address);
      if (result.error) { toast.error(result.error); return; }
      setViewers(current => current?.filter(viewer => viewer.email !== address) ?? []);
      toast.success("Görüntüleme erişimi kaldırıldı");
    } catch { toast.error("Erişim kaldırılamadı."); }
    finally { busy.current = false; setPending(false); }
  }
  return <Sheet open={open} onOpenChange={value => { if (!busy.current) setOpen(value); }}>
    <DrawerTrigger asChild><button type="button" aria-label="Hesabım ve paylaşım" className="flex min-w-0 items-center gap-2.5 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
        {profile.avatar && !avatarFailed ? <Image src={profile.avatar} alt="" width={40} height={40} unoptimized onError={() => setAvatarFailed(true)} /> : profile.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
      </span><span className="block min-w-0"><span className="block max-w-32 truncate sm:max-w-40 text-sm font-medium">{profile.name}</span><span className="block max-w-32 truncate sm:max-w-40 text-xs text-muted-foreground">{profile.email}</span></span>
    </button></DrawerTrigger>
    <SheetContent>
      <SheetHeader><SheetTitle>Hesabım</SheetTitle><SheetDescription>Profil bilgilerin ve bütçe paylaşımın.</SheetDescription></SheetHeader>
      <div className="mb-6 rounded-2xl border p-4"><p className="break-words font-semibold">{profile.name}</p><p className="mt-1 break-all text-sm text-muted-foreground">{profile.email}</p><p className="mt-3 text-xs text-primary">{profile.role === "viewer" ? "Salt okunur · Paylaşılan bütçe" : "Bütçe sahibi"}</p></div>
      {profile.role === "owner" ? <section className="space-y-4">
        <div><h3 className="text-sm font-semibold">Bütçemi görüntüleyebilenler</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Eklediğin kişi bu e-posta adresiyle Google girişi yaptığında bütçeni görür. Kayıt ekleyemez, değiştiremez veya silemez.</p></div>
        <form onSubmit={add} className="flex items-center gap-2"><input type="email" required aria-label="Görüntüleyicinin e-posta adresi" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={pending} placeholder="E-posta adresi" className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Button type="submit" disabled={pending || viewers === null || !email.trim() || Boolean(error)} className="h-12 rounded-xl"><Plus className="size-4" aria-hidden />Ekle</Button></form>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : viewers === null ? <p role="status" className="text-sm text-muted-foreground">Yükleniyor…</p> : viewers.length ? <ul className="divide-y">{viewers.map(viewer => <li key={viewer.email} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{viewer.email}</p><p className="mt-1 text-xs text-muted-foreground">Salt okunur</p></div><Button type="button" variant="ghost" size="icon" disabled={pending} className="rounded-full text-destructive" aria-label={`${viewer.email} erişimini kaldır`} onClick={() => remove(viewer.email)}><Trash2 className="size-4" aria-hidden /></Button></li>)}</ul> : <p className="py-3 text-sm text-muted-foreground">Henüz kimseyle paylaşmadın.</p>}
      </section> : <p className="text-sm leading-6 text-muted-foreground">Bu bütçede yalnızca görüntüleme yetkin var. Paylaşım izinlerini bütçe sahibi yönetir.</p>}
      <form action={signOut} className="mt-8 border-t pt-5"><Button type="submit" variant="outline" className="w-full rounded-full"><LogOut className="size-4" aria-hidden />Çıkış yap</Button></form>
    </SheetContent>
  </Sheet>;
}
