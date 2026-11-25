# Sarraf

Bağımsız kişisel bütçe uygulaması.

`pnpm install`, `pnpm dev` (3000), `pnpm check`, `pnpm build`.

## Google ile giriş

1. `.env.example` dosyasını `.env` olarak kopyala. `SUPABASE_URL` alanına proje URL’sini, `SUPABASE_PUBLIC_KEY` alanına anon veya publishable key değerini yaz (Project Settings → API). Service role veya secret key kullanma.
2. Google Cloud Console’da Web application türünde OAuth istemcisi oluştur. Authorized JavaScript origins alanına `http://localhost:3000` ve yayındaki uygulama adresini ekle. Authorized redirect URIs alanına Supabase’in gösterdiği `https://<project-ref>.supabase.co/auth/v1/callback` adresini ekle.
3. Supabase → Authentication → Sign In / Providers → Google bölümünde Google Client ID ve Client Secret bilgilerini gir, Google sağlayıcısını etkinleştir. Yalnızca Google ile giriş için Email ve diğer giriş sağlayıcılarını kapat.
4. Supabase → Authentication → URL Configuration: Site URL alanına uygulama adresini yaz. Redirect URLs listesine `http://localhost:3000/auth/callback` ve yayındaki uygulamanın `/auth/callback` adresini ekle. Google uygulaması test modundaysa kullanıcıları test kullanıcısı listesine ekle.
5. Geliştirme sunucusunu yeniden başlat. `/` oturum açılmadan `/login` ekranına yönlenir. Google ile giriş sonrasında bütçe açılır; başlıktaki çıkış düğmesi oturumu kapatır.

Bağlantı bilgileri olmadan giriş ekranı açılır, giriş düğmesi devre dışı kalır. Google yönlendirmesinin tamamını doğrulamak için gerçek Supabase ve Google OAuth ayarları gerekir.

Kurulum kaynakları: [Supabase Google girişi](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Next.js sunucu oturumları](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

## Bütçe kayıtları

Bütçe kayıtları doğrudan mevcut Supabase tablolarından okunur ve aynı tablolara kaydedilir. Yeni tablo, sütun veya SQL güncellemesi gerekmez.

- İşlem giderleri: `budget_entries` (`label`, `amount`, `month`, `spent_on`, `category_id`).
- Kategoriler: `budget_categories`.
- Gelirler: `budget_incomes`.
- Sabit giderler: `budget_fixed_expenses`.
- Aylık birikim: `savings` (`month`, `amount`, `updated_at`).

Her sorgu doğrulanmış oturumun `user_id` değeriyle sınırlandırılır. Mevcut RLS politikaları korunur. Veri erişimi `src/data/budget-server.ts` içinde mevcut Supabase tablosuna göre uygulanır.

Mevcut tablo sınırları forma uygulanır: gider açıklaması 80, gelir/sabit işlem adı 60 karakter. Gelir ve sabit giderlerde kategori alanı olmadığı için bu formlarda kategori otomatik belirlenir. Gider kaydında kategori zorunludur. “Kategorisiz” seçeneği yoktur. Sabit gelir/giderler kategori listesine eklenmez; tek seferlik gelirler “Gelir” kategorisinde gösterilir. Bu otomatik eşleştirme mevcut tablolardaki kayıt türünden türetilir; yeni sütun gerekmez. Otomatik kategoriler değiştirilemez. Tek seferlik gelirler aynı başlangıç/bitiş günüyle gelir tablosuna kaydedilir. Başlangıç ve bitişi aynı olan eski gelirler de aynı ayda tek işlem olarak gösterilir; toplam tutar değişmez. Gelir/gider türü düzenleme sırasında sabittir.

Sunucu onayı gelene kadar kaydetme/silme tamamlanmış sayılmaz. Hata durumunda form açık kalır. Tarayıcıdaki eski kayıtlar otomatik olarak buluta yüklenmez veya silinmez; aktif ekranda yerel depolama kullanılmaz. Sayfayı yenilemek başka cihazdan kaydedilen verileri getirir.

Doğrulama: `pnpm check`, `pnpm exec next build --webpack`. Oturum gerektiren canlı okuma/yazma işlemleri gerçek Google hesabıyla kontrol edilmelidir; otomatik testler gerçek kullanıcı kayıtlarını değiştirmez.

## Gider hızlı seçimleri

`supabase/migrations/202611250001_expense_quick_actions.sql` dosyası bu yeni özellik için istenen ayrı `budget_quick_actions` tablosunu oluşturur. SQL Editor’da bir kez çalıştırılmalıdır; mevcut bütçe tablolarının yapısı değişmez. Kullanıcı ve kategori bazında RLS uygulanır. Her kullanıcı kendi kategorisine Acıbadem veya MedicalPark gibi seçimleri formdan ekler.

Tüm hızlı seçimler sayfa açılırken bütçeyle paralel olarak yüklenir ve ekranda bellekte tutulur. Normal gider formunda kategori seçince seçenekler ek istek olmadan yerel listeden süzülür. Ekleme/kaldırma bellekteki listeyi de günceller. Bir düğmeye dokunmak yalnızca açıklama alanını doldurur; işlem kaydetmez. Açıklama yazıldıktan sonra “Açıklamayı hızlı seçim olarak kaydet” ile yeni seçenek eklenir; yanındaki çarpı yalnızca kısayolu kaldırır. Mevcut gider kayıtları etkilenmez. Yeni tablo henüz oluşturulmadıysa normal gider kaydı çalışmaya devam eder.

## Profil ve salt okunur paylaşım

Google profilindeki ad, e-posta ve avatar hesap düğmesinde gösterilir. Hesap çekmecesinden mevcut `viewers` tablosuna e-posta eklenir veya erişim kaldırılır. E-posta gönderilmez; kişi eklenen e-postayla giriş yaptığında mevcut paylaşım ilişkisi üzerinden ev sahibinin bütçesini okur. Referans projedeki gibi bir görüntüleyici e-postası tek ev sahibine bağlıdır (`viewers.viewer_email` benzersiz). Paylaşımı olmayan yeni hesaplar kendi bütçesini görür.

Görüntüleyicide yazma arayüzleri gizlenir; işlem, kategori, birikim, hızlı seçim ve paylaşım sunucu işlemleri ayrıca rolü doğrulayarak yazmayı reddeder. Mevcut `viewers` ve bütçe RLS politikaları kullanılır. Gerçek paylaşım yetkisi değişikliği, kullanıcının hesap ekranında Ekle/Kaldır düğmesine basmasıyla gerçekleşir.

## Eski ekstre tablosunu kaldırma

`supabase/migrations/20261125100308_retire_budget_statements.sql` dosyasını bir bütün olarak SQL Editor’da çalıştır. Sıfırdan büyük `budget_statements` kayıtlarını gerçek `Kart Ekstresi` kategorisindeki `budget_entries` kayıtlarına taşır. Bankalar işlem adı olur. Önceden aktarılmış bir banka/ay kaydı varsa tutar aynı olduğunda onu kullanır; farklı tutar veya birden fazla aday varsa işlem hata verir ve tüm değişiklikleri geri alır. Doğrulama tamamlandıktan sonra kaynak tablo aynı işlem içinde kaldırılır; bağımlı nesneler otomatik silinmez. Mevcut uygulama `budget_statements` tablosunu okumaz veya yazmaz. Public API anahtarıyla bu tablo kaldırma işlemi çalıştırılamaz.

Eski ekstre geçişi, daha önce aktarılmış işlemleri yeniden eklemeden Kart Ekstresi kategorisine bağlar ve doğrulamadan sonra kaynak tabloyu kaldırır.

Ekstre dönem gösterimi: `spent_on` alanı boş eski Kart Ekstresi kayıtları, veritabanındaki açılış ayından sonraki ayda gösterilir (Ekim → Kasım). Kaynak `month` ve `spent_on` değiştirilmez. Listede kesin gün yerine dönem adı yazılır. Sadece tutarı düzenlemek de bu özgün tarihleri korur; tarih açıkça değiştirilirse seçilen tarih kaydedilir. Silme ay kontrolü aynı gösterim eşleştirmesini kullanır.

Bütçe dönemleri ayın 25’inde başlar, sonraki ayın 24’ünde kapanır ve bitiş ayıyla adlandırılır. 25 Ekim–24 Kasım işlemleri Kasım bütçesinde görünür. Bu kural normal gider, kart ekstresi ve tek seferlik gelirlere gösterimde uygulanır; Supabase’deki gerçek işlem tarihi değişmez. Ay seçici, ilk açılan dönem, son kayıtlı dönem, kayıt sonrası yönlendirme ve silme kontrolleri aynı eşleştirmeyi kullanır. Sabit kayıtlar ve aylık birikim zaten dönem ayına bağlıdır.

Birikim hedefi ve gerçekleşen birikim ayrıdır. `savings` gerçek aylık birikimleri tutar; karttaki tutar ve geçmiş ay ortalaması buradan gelir. `budget_savings_targets` aylık bütçe hedeflerini tutar; harcanabilir kalan hesabından yalnızca bu hedef düşülür. `savings_goal` genel uzun vadeli hedef tablosu değiştirilmez. Mevcut gerçek birikimler hedef olarak kopyalanmaz.
