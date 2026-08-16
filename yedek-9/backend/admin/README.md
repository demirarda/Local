# LOCAL Admin Panel

Analytics dashboard ve moderasyon paneli. Sadece `.env` içinde `ADMIN_USER_IDS` veya `ADMIN_EMAILS` ile tanımlı kullanıcılar erişebilir.

## Erişim

1. Backend çalışırken tarayıcıda: **http://localhost:3000/admin**
2. Admin olarak tanımlı bir kullanıcının **email + şifre** ile giriş yapın.
3. `.env`: `ADMIN_EMAILS=admin@example.com` veya `ADMIN_USER_IDS=uuid1,uuid2`

## Veritabanı

- Migration 021: `reports.action_note` (bildirim işlem notu).
- **Migration 027:** RS geçmişi ve bildirim şablonları için çalıştırın: `npm run migrate` (backend dizininde). Bu, `rs_history` ve `report_templates` tablolarını ekler.

## Özellikler

- **Dashboard:** Toplam kullanıcı/ritüel, feedback, katılım, bekleyen bildirim (tıklanınca Bildirimler'e gider), askıdaki kullanıcı/ritüel, RS dağılımı, son 7/30/90 gün grafiği, son kayıt olan kullanıcılar, şehirlere göre ritüel.
- **Kullanıcılar:** Listeleme, arama, üniversite/RS min-max filtresi, sayfa başına 10/20/50, detay (RS, host doğrulama, bildirim sayısı, "Bildirimleri görüntüle" linki), **RS düzenleme**, **profil düzenleme (isim, şehir, üniversite)**, **RS geçmişi**, **şifre sıfırlama**, **anonimleştirme**, askıya alma / kaldırma (onay ile), CSV indir.
- **Ritüeller:** Listeleme, durum/şehir/tarih aralığı filtresi, sayfa başına 10/20/50, detay (katılımcı, host, bildirim sayısı, "Bildirimleri görüntüle" linki), **ritüel düzenleme (başlık, tarih, kapasite, durum)**, askıya alma / kaldırma (onay ile), CSV indir.
- **Bildirimler:** Tip ve durum filtresi, kullanıcı/ritüel hedef filtresi, detayda **şablon kullan** (işlem notu), "Kullanıcıyı askıya al" / "Ritüeli askıya al" tek tık, çözüldü/reddet (not ile), CSV indir.
- **Araçlar:** **Toplu RS güncelleme** (CSV: email veya user_id + rs_score), **duyuru e-postası** (tüm kullanıcılar veya seçili ID’lere).
- **Şablonlar:** Bildirim işlem notu şablonları (ekle, düzenle, sil); bildirim detayında "Şablon kullan" ile not alanına doldurma.
- **Feedback:** Son feedback listesi, ritüel ID ile filtre, sayfalama.
- **Doğrulama:** Host doğrula (user UUID), mekan doğrula (mekan adı + şehir); doğrulanmış host ve mekan listesi, doğrulama kaldırma (revoke).
- **Genel:** 401'de oturum sonlandı / login'e yönlendirme, işlem sonrası toast, CSV dışa aktarma.
