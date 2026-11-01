"use client";

import { useState, useEffect } from "react";
import { useMarketData } from "@/hooks/use-market-data";
import { useAuth } from "@/hooks/use-auth";
import { usePortfolio } from "@/hooks/use-portfolio";
import { GoldAddSheet } from "@/components/gold-add-sheet";
import { SavingsSection } from "@/components/savings-section";
import { BudgetSection } from "@/components/budget-section";
import { SwipeDeck } from "@/components/swipe-deck";
import { useSavings } from "@/hooks/use-savings";
import { ViewersPanel } from "@/components/viewers-panel";
import { useGoldLedger, type GoldLedgerEntry, type GoldSide } from "@/hooks/use-gold-ledger";
import { AssetsSection } from "@/components/assets-section";
import { portfolioValue } from "@/lib/portfolio";
import { Wifi, WifiOff, Clock, WalletMinimal, LogOut, UserPlus, Eye } from "lucide-react";
import { LoadingStatus } from "@/components/loading-status";

const PAGES = ["Bütçe", "Birikim", "Varlık"] as const;

export default function Home() {
  const { data, loading, error, lastFetch, refetch } = useMarketData();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { portfolio, updateAsset, adjustAsset, isViewer, loading: portfolioLoading, error: portfolioError } = usePortfolio(user);
  const {
    entries: savingsEntries,
    setMonth: setSavingsMonth,
    totals: savingsTotals,
    isViewer: savingsViewer,
  } = useSavings(user);
  const readOnly = isViewer || savingsViewer;
  const { entries, push, drop } = useGoldLedger();
  const [addSide, setAddSide] = useState<GoldSide | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [page, setPage] = useState(0);

  const totalTL = portfolioValue(portfolio, data);

  // Supabase bazen code'u / yerine /auth/callback'e gönderir; /?code= gelirse callback'e yönlendir
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && window.location.pathname === "/") {
      window.location.replace(`/auth/callback?${params.toString()}`);
    }
  }, []);

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <img
          src="/icons/icon-192.png"
          alt="Sarraf"
          className="h-12 w-12 rounded-xl"
          width={48}
          height={48}
        />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Sarraf</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Varlıklarınızı görmek için giriş yapın
        </p>
        <button
          onClick={signInWithGoogle}
          className="mt-8 flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <GoogleIcon />
          Google ile Giriş Yap
        </button>
      </div>
    );
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="app-chrome sticky top-0 z-50 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/icons/icon-192.png"
              alt="Sarraf"
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
              width={32}
              height={32}
            />
            <h1 className="truncate text-base font-semibold tracking-tight">Sarraf</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {lastFetch && (
              <span className="mr-1 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lastFetch.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span className="flex h-8 w-8 items-center justify-center">
              {error ? (
                <WifiOff className="h-4 w-4 text-red-500" />
              ) : (
                <Wifi className="h-4 w-4 text-emerald-500" />
              )}
            </span>
            {user && !readOnly && (
              <button
                onClick={() => setViewersOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Görüntüleyici ekle"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                width={32}
                height={32}
                className="ml-1 h-8 w-8 max-h-8 max-w-8 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            {user ? (
              <button
                onClick={signOut}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Çıkış Yap"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="border-t border-b bg-muted/30">
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2">
            <WalletMinimal className="h-4 w-4 text-foreground" />
            <span className="text-sm font-semibold tabular-nums">
              {totalTL !== null
                ? `${totalTL.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ₺`
                : "—"}
            </span>
            <span className="text-xs text-muted-foreground">Toplam Varlık</span>
          </div>
        </div>
        {readOnly && (
          <div className="border-b bg-amber-500/10">
            <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>Salt okunur — paylaşılan hesabı görüntülüyorsunuz</span>
            </div>
          </div>
        )}
        <div className="border-b">
          <div className="relative mx-auto max-w-4xl">
            <div className="grid grid-cols-3">
              {PAGES.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPage(index)}
                  className={`py-2.5 text-center text-sm ${
                    index === page ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-foreground transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
              style={{ transform: `translateX(${page * 100}%)` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SwipeDeck index={page} onIndexChange={setPage}>
          <BudgetSection user={user} readOnly={readOnly} />
          <div className="space-y-6">
            <SavingsSection
              entries={savingsEntries}
              totals={savingsTotals}
              isViewer={readOnly}
              onSave={setSavingsMonth}
            />
          </div>
          <AssetsSection
            portfolio={portfolio}
            market={data}
            readOnly={readOnly || portfolioError !== null}
            loading={portfolioLoading || loading}
            error={portfolioError ?? (error ? (data ? "Güncel fiyatlar alınamadı. Son alınan fiyatlar gösteriliyor." : "Güncel fiyatlar alınamadı. Fiyatları yenileyerek tekrar dene.") : null)}
            onRetry={refetch}
            onUpdate={updateAsset}
            onGoldAdd={setAddSide}
          />
        </SwipeDeck>
      </main>

      {!readOnly && (
        <GoldAddSheet
          side={addSide}
          total={addSide ? portfolio.gold[addSide] : 0}
          entries={entries.filter((e) => e.side === addSide)}
          onOpenChange={(open) => {
            if (!open) setAddSide(null);
          }}
          onAdd={async (side, grams) => {
            await adjustAsset("gold", side, grams);
            push(side, grams);
          }}
          onUndo={async (entry: GoldLedgerEntry) => {
            await adjustAsset("gold", entry.side, -entry.grams);
            drop(entry.id);
          }}
        />
      )}

      {!readOnly && user && (
        <ViewersPanel
          open={viewersOpen}
          onOpenChange={setViewersOpen}
          user={user}
        />
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function PageLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background pt-[env(safe-area-inset-top)]">
      <img
        src="/icons/icon-192.png"
        alt="Sarraf"
        className="h-12 w-12 rounded-xl"
        width={48}
        height={48}
      />
      <LoadingStatus />
    </div>
  );
}
