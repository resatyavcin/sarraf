"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { UserPlus, X, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useViewers } from "@/hooks/use-viewers";

interface ViewersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ViewersPanel({ open, onOpenChange, user }: ViewersPanelProps) {
  const { viewers, loading, error, addViewer, removeViewer } = useViewers(
    user,
    open
  );
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    const ok = await addViewer(email.trim());
    if (ok) setEmail("");
    setBusy(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300">
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Görüntüleyici ekle
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 transition-colors hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Gmail adresini ekle. Mail gönderilmez; o kişi kendi hesabıyla giriş
            yapınca senin varlıklarını salt okunur görür.
          </p>

          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@gmail.com"
              className="h-11 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Ekle
            </button>
          </form>

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}

          <div className="mt-5 space-y-2">
            {loading && viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Yükleniyor…</p>
            ) : viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz görüntüleyici yok
              </p>
            ) : (
              viewers.map((v) => (
                <div
                  key={v.email}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                >
                  <span className="truncate text-sm">{v.email}</span>
                  <button
                    type="button"
                    onClick={() => removeViewer(v.email)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Kaldır"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <Dialog.Description className="sr-only">
            Gmail ile görüntüleyici ekle veya kaldır
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
