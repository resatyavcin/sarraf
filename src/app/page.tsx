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
import { Wifi, WifiOff, Clock, WalletMinimal, LogOut, UserPlus, Eye, ArrowUpRight, ShieldCheck, Layers, PiggyBank, ChartNoAxesCombined } from "lucide-react";
import { LoadingStatus } from "@/components/loading-status";

const PAGE_ICONS = [ChartNoAxesCombined, PiggyBank, Layers];
const PAGE_DESCRIPTIONS = ["Gelirini planla, harcamalarını dengede tut.", "Küçük adımlar, büyük hedefler.", "Altın ve dövizlerin, tek bir yerde."];

const PAGES = ["Bütçe", "Birikim", "Varlık"] as const;

export default function Home() {
  const { data, loading, error, lastFetch, refetch } = useMarketData();
  const { user, loading: authLoading, error: authError, retry: retryAuth, signInWithGoogle, signOut } = useAuth();
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

  if (authError) {
    return <div className="login-shell"><div role="alert" className="max-w-sm space-y-5 text-center"><h1 className="text-xl font-bold">Bağlantı beklenenden uzun sürdü</h1><p className="text-sm text-muted-foreground">{authError}</p><button type="button" onClick={() => void retryAuth()} className="login-cta">Yeniden dene</button></div></div>;
  }

  if (!authLoading && !user) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-cover"><WalletMinimal size={42} strokeWidth={1.4} /><span>SARRAF / KİŞİSEL FİNANS</span></div>
          <img src="/icons/icon-192.png" alt="Sarraf" className="login-avatar" width={72} height={72} />
          <div className="login-body">
            <div className="eyebrow">PARANIN BUGÜNÜ, HAYALLERİNİN YARINI</div>
            <h1>Her şeyin hesabı,<br />tek bir yerde.</h1>
            <p>Bütçeni yönet, birikimini büyüt, varlıklarını takip et. Sarraf ile finansal hayatına biraz daha netlik kat.</p>
            <div className="login-features">{PAGES.map((label, index) => { const Icon = PAGE_ICONS[index]; return <span key={label}><Icon size={16} />{label}</span>; })}</div>
            <button onClick={signInWithGoogle} className="login-cta"><GoogleIcon />Google ile devam et<ArrowUpRight size={18} /></button>
            <div className="login-note"><ShieldCheck size={15} />Sana özel, güvenli bir alan.</div>
          </div>
        </div>
        <p className="login-footer">Sarraf <span>Finansal hayatına iyi bak.</span></p>
      </div>
    );
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="sarraf-app min-h-dvh bg-background">
      <header className="app-chrome sticky top-0 z-50 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-18 max-w-4xl items-center justify-between gap-2 px-4">
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
        {readOnly && (
          <div className="border-b bg-amber-500/10">
            <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>Salt okunur — paylaşılan hesabı görüntülüyorsunuz</span>
            </div>
          </div>
        )}
        <nav className="section-nav" aria-label="Finans bölümleri">
          {PAGES.map((label, index) => { const Icon = PAGE_ICONS[index]; return (
            <button key={label} type="button" aria-current={index === page ? "page" : undefined} onClick={() => setPage(index)}><Icon size={18} />{label}</button>
          ); })}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="dashboard-intro">
          <div><p className="eyebrow">FİNANSAL HAYATINA İYİ BAK</p><h2>{PAGES[page]}<span>.</span></h2><p className="intro-description">{PAGE_DESCRIPTIONS[page]}</p></div>
          <div className="portfolio-summary"><span><WalletMinimal size={15} />Toplam varlık</span><strong>{totalTL !== null ? `${totalTL.toLocaleString("tr-TR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ₺` : "—"}</strong><small>Güncel alış fiyatlarıyla</small></div>
        </div>
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
        <footer className="dashboard-footer"><span>Sarraf</span><span>Bugünü planla. Yarına biriktir.</span></footer>
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
