# Altınım Kaç Para 🪙

Altın, Dolar ve Euro kurlarını canlı takip edebileceğiniz PWA uygulaması.

## Özellikler

- **Canlı Fiyatlar**: Ons altın (XAU/USD), USD/TRY, EUR/TRY
- **Gram Altın Hesaplama**: Otomatik gram altın TRY fiyatı
- **Grafikler**: shadcn/ui chart ile son 24 saat grafikleri
- **10dk Polling**: Veriler 10 dakikada bir otomatik güncellenir
- **PWA Desteği**: Offline cache, ana ekrana eklenebilir
- **Responsive**: Mobil ve masaüstü uyumlu

## Kurulum

```bash
npm install
cp .env.example .env.local
# .env.local dosyasına Twelve Data API key'inizi ekleyin
npm run dev
```

## API Key

[Twelve Data](https://twelvedata.com/) adresinden ücretsiz API key alabilirsiniz.

Free plan: 8 API call/dakika, 800 API call/gün.

## Teknolojiler

- Next.js 16 (App Router)
- shadcn/ui + Recharts
- Tailwind CSS
- Twelve Data API
- Service Worker (PWA)
