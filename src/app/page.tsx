"use client";

import { useState, useMemo } from "react";
import { useMarketData } from "@/hooks/use-market-data";
import { useAuth } from "@/hooks/use-auth";
import { usePortfolio } from "@/hooks/use-portfolio";
import { PriceCard, GoldCard } from "@/components/price-card";
import { AssetDrawer } from "@/components/asset-drawer";
import { PriceChart } from "@/components/price-chart";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wifi, WifiOff, Clock, Wallet, LogOut } from "lucide-react";
import { AssetKey } from "@/lib/types";

const drawerConfig: Record<AssetKey, { title: string; unit: string; step: number }> = {
  gold: { title: "Gram Altın Varlığım", unit: "gr", step: 1 },
  usd: { title: "Dolar Varlığım", unit: "$", step: 100 },
  eur: { title: "Euro Varlığım", unit: "€", step: 100 },
};

export default function Home() {
  const { data, loading, error, lastFetch, refetch } = useMarketData();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { portfolio, updateAsset, resetPortfolio } = usePortfolio(user);
  const [activeDrawer, setActiveDrawer] = useState<AssetKey | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const CURRENCY_SPREAD = 0.008;

  const totalTL = useMemo(() => {
    if (!data) return 0;
    const goldVal =
      (portfolio.gold.physical + portfolio.gold.digital) * data.gold.gramBuy;
    const usdBuy = data.usd.price * (1 - CURRENCY_SPREAD / 2);
    const eurBuy = data.eur.price * (1 - CURRENCY_SPREAD / 2);
    const usdVal =
      (portfolio.usd.physical + portfolio.usd.digital) * usdBuy;
    const eurVal =
      (portfolio.eur.physical + portfolio.eur.digital) * eurBuy;
    return goldVal + usdVal + eurVal;
  }, [data, portfolio]);

  const drawerKey = activeDrawer ?? "gold";

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/icons/icon-192.png"
              alt="Sarraf"
              className="h-8 w-8 rounded-lg"
              width={32}
              height={32}
            />
            <h1 className="text-lg font-bold tracking-tight">Sarraf</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lastFetch.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {error ? (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                onClick={signOut}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Çıkış Yap"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-b bg-muted/30">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold tabular-nums">
                {totalTL > 0
                  ? `${totalTL.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ₺`
                  : "0,00 ₺"}
              </span>
              <span className="text-xs text-muted-foreground">toplam varlık</span>
            </div>
            <button
              onClick={() => setResetDialogOpen(true)}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Varlıklarımı Sıfırla
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading && !data ? (
          <LoadingSkeleton />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data ? (
          <div className="space-y-6">
            <GoldCard
              title="Gram Altın"
              gramBuy={data.gold.gramBuy}
              gramSell={data.gold.gramSell}
              change={data.gold.change}
              changePercent={data.gold.changePercent}
              holding={portfolio.gold}
              onEdit={() => setActiveDrawer("gold")}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <PriceCard
                title="Dolar"
                symbol={data.usd}
                variant="dollar"
                holding={portfolio.usd}
                onEdit={() => setActiveDrawer("usd")}
              />
              <PriceCard
                title="Euro"
                symbol={data.eur}
                variant="euro"
                holding={portfolio.eur}
                onEdit={() => setActiveDrawer("eur")}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <PriceChart
                title="Gram Altın"
                data={data.gold.timeSeries}
                color="#F59E0B"
              />
              <PriceChart
                title="USD/TRY"
                data={data.usd.timeSeries}
                color="#10B981"
              />
              <PriceChart
                title="EUR/TRY"
                data={data.eur.timeSeries}
                color="#6366F1"
              />
            </div>

            <p className="pb-4 text-center text-xs text-muted-foreground">
              Veriler Twelve Data API&apos;den alınmaktadır • 10 dakikada bir güncellenir
            </p>
          </div>
        ) : null}
      </main>

      <AssetDrawer
        open={activeDrawer !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null);
        }}
        title={drawerConfig[drawerKey].title}
        unit={drawerConfig[drawerKey].unit}
        step={drawerConfig[drawerKey].step}
        holding={portfolio[drawerKey]}
        onSave={(h) => {
          if (activeDrawer) updateAsset(activeDrawer, h);
        }}
      />

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Varlıklarımı Sıfırla</AlertDialogTitle>
            <AlertDialogDescription>
              Tüm varlıklar sıfırlansın mı? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetPortfolio();
                setResetDialogOpen(false);
              }}
            >
              Sıfırla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Bağlantı Hatası</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Tekrar Dene
      </button>
    </div>
  );
}
