"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastOptions = { description?: string; duration?: number };
type ToastMessage = ToastOptions & { id: number; title: string; kind: ToastKind };
type ToastApi = Record<ToastKind, (title: string, options?: ToastOptions) => void>;

const ToastContext = createContext<ToastApi | null>(null);
const icons = { success: CircleCheck, error: CircleAlert, info: Info };
const iconStyles = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  error: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const dismiss = useCallback((id: number) => {
    setMessages(current => current.filter(message => message.id !== id));
  }, []);
  const toast = useMemo<ToastApi>(() => {
    const show = (kind: ToastKind, title: string, options?: ToastOptions) => {
      const message = { ...options, id: ++sequence.current, title, kind };
      setMessages(current => [...current.slice(-2), message]);
    };
    return {
      success: (title, options) => show("success", title, options),
      error: (title, options) => show("error", title, options),
      info: (title, options) => show("info", title, options),
    };
  }, []);

  return <ToastContext.Provider value={toast}>
    <ToastPrimitive.Provider swipeDirection="right" label="Bildirim">
      {children}
      {messages.map(message => {
        const Icon = icons[message.kind];
        return <ToastPrimitive.Root
          key={message.id}
          defaultOpen
          duration={message.duration ?? (message.kind === "error" ? 6000 : 4000)}
          type={message.kind === "error" ? "foreground" : "background"}
          onOpenChange={open => { if (!open) dismiss(message.id); }}
          className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-2 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:translate-x-[calc(100%+2rem)] data-[swipe=end]:transition-transform motion-reduce:animate-none motion-reduce:transition-none"
        >
          <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconStyles[message.kind])}><Icon className="size-5" /></span>
          <div className="min-w-0 flex-1 py-1.5">
            <ToastPrimitive.Title className="text-sm font-medium leading-5 [overflow-wrap:anywhere]">{message.title}</ToastPrimitive.Title>
            {message.description && <ToastPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{message.description}</ToastPrimitive.Description>}
          </div>
          <ToastPrimitive.Close aria-label="Bildirimi kapat" className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></ToastPrimitive.Close>
        </ToastPrimitive.Root>;
      })}
      <ToastPrimitive.Viewport aria-label="Bildirimler ({hotkey})" className="pointer-events-none fixed inset-x-4 top-4 z-[100] mx-auto flex max-h-[calc(100dvh-2rem)] w-auto max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  </ToastContext.Provider>;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast, ToastProvider içinde kullanılmalı.");
  return toast;
}
