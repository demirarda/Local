# LOCAL — CHECK-IN SİSTEMİ (MÜHÜR MİMARİSİ) — TEK DOSYA
**Statü:** Check-in masası kararlarının tam dökümü (karar defteri ~45 madde; 4 ana kalbe işleme founder onayı bekliyor). Bu dosya ek olarak paylaşılabilir — algoritma ve gamification bağlarıyla birlikte tüm süreci ve varyasyonları içerir.
**İmza cümle:** *"Check-in'i kimse sana yapmaz — kendini mühürlersin. Masayı kimse senin için açmaz — ilk gelen açar."*

---

# 1. EVRENSEL OMURGA (her yer, her ölçek, istisnasız)

```
[CHECK-IN] tuşu (prelobby'de, max(create anı, start−15dk)'da aktifleşir)
 ① CANLI GPS — atlanamaz, her araçtan önce, izin o an istenir (sürekli takip yok)
    🟢 radius içi → ②'ye geç
    🔴 radius dışı (konum VAR, uzak) → kapı KAPALI: pusula + konum notu + "N kişi masada"
    ⚠️ konum yok/kirli (arıza T1 · mock/root/integrity-fail/imkansız-hız T2) →
       ② açılır AMA mühür PENDING_WITNESS'a düşer
 ② ANAHTAR — fiziksel temas kanıtı; KÜLTÜR HİYERARŞİSİ 🔒:
    ANA KÜLTÜR: 🗣 KOD SÖYLE ("kod ne?" anı) · 👀 KOD GÖSTER (mühürlü ekranda kalıcı
      "KOD: 517") · 📱 LOCAL-TAG (mühürlüden tek-seferlik 30sn tag — QR-göster/yaklaştır-it)
    KISAYOL: 🔵 TOTEM/MARKER DEĞDİR (NFC — venue masa totemi / zone marker'ı)
    Dijital YOLLAMA (mesaj/DM/uzak-AirDrop) YASAK — iletim yalnız fiziksel yan-yanalık.
 ③ MÜHÜR ✓ → GELENLER ŞERİDİ'ne düşer → AIS deneme anından işler → window'dasın
İLK GELEN AÇAR 🔒: GPS🟢 + kod doğmamış → "MASAYI SEN AÇIYORSUN" + konum notu →
  mühür = KODUN DOĞUMU = WINDOW'UN DOĞUMU = "Masa açıldı 🟢" anonsu (+ venue sinyali).
  Host imtiyazı/yükü YOK — geç kalan host normal kullanıcı gibi AIS yer, koddan girer.
  Race: backend tek kod, aynı-saniye tie-break HOST, sonra ilk-yazan; diğeri kod-ekranına.
  İlk-mühür denemesi PENDING'e düşerse: kod/window DOĞMAZ, masa açılmamış sayılır —
  sonraki 🟢 gelen açar, bekleyen pending'leri onun tanıklığı çözer.
KOD 🔒: 3 hane (100-999), ritüel-başına statik-tek-kullanımlık (dönen kod RED,
  kişisel kod RED), 500m çakışma koruması, 3 deneme; prelobby'de bile görünmez —
  yalnız mühürlü ekranlarda kalıcı.
```

# 2. ZAMAN ZİNCİRİ

```
CREATE (7 boyut: lokasyon·zaman·tanım·kapasite·window-kapanışı[3/6/12/24h ⭐ def.12]·
  defter/forum sorusu·visibility + [sadece-planlayanlar ⭐]) — MIN_DURATION 30dk 🔒 ·
  INSTANT = start ≤ +2h ⭐ · tek-masa kapasitesi KATEGORİ-ÖNERİSİNDEN (soft, aşılabilir) ⭐ ♻️v3 · mutlak 40 🔒 · üstü event_group
JOIN = SÖZ → PRELOBBY doğar (kadro + host tek-yönlü anonsu; konuşma kapalı)
KİLİT (start−%25, clamp 15dk-3h) = SÖZ KİLİDİ: ayrılış donar (late-cancel başlar,
  replacement aynen) + MASA KONUŞMASI AÇILIR + exact-pin iç katmana. JOIN AÇIK KALIR.
START−15: [CHECK-IN] belirir → İLK MÜHÜR: kod+window (ISINMA: şerit+konuşma+kamera
  RULOYA taslak; memory PAYLAŞIMI+quote+playlist kapalı) → START: TAM evre (paylaşım
  açılır; AIS çıpası start — erken mühür 1.00)
KAPI (start+%20, clamp 10-60dk) = check-in penceresi + ALIM KAPANIŞI → kapanınca:
  prelobby ölür · gelmeyen no-show + NÖTR KART ("katılamadın · kapı 21:24'te kapandı") ·
  window/şerit/memory ona asla açılmaz
WINDOW yaşar → süre biter → kapanış setine dek açık → FEEDBACK penceresi → ARŞİV
  (defter kapanır VEYA forum yaşar). PİN DEĞİŞMEZDİR 🔒 (host: iptal veya radius-içi not).
Kısa masada (Instant) prelobby+kapı TEK BİRLEŞİK EKRAN; evreler çakışırsa üst üste
  çöker — zamana değil duruma bağlılar.
```

# 3. PENDING_WITNESS (insan-tanıklığı katmanı)

```
TETİK: kod ✓ + (T1 GPS-arıza | T2 kirli-sinyal | T3 sınır-deseni ⭐ ops.)
AKIŞ: mühür beklemede → şeritte soluk görünür → masadaki MÜHÜRLÜLERE tek-tık kart
  ("X masada mı? ✓") → eşik: mühürlü ≤3 → 1 tanık · ≥4 → 2 tanık ⭐ (pending
  doğarken KİLİTLENİR — hedef oynamaz) → onay = mühür + AIS DENEME ANINDAN (tam adalet)
GRACE ⭐: deneme kapı-İÇİNDEYSE onay kapı+10dk'ya dek mühür basar (AIS yine deneme
  anından) — kısa masaların sigortası, uzunlarda matematiksel olarak uyur
ONAYSIZ + kapı kapandı: mühür yok AMA otomatik no-show İŞLEMEZ — "doğrulanamamış
  check-in" MOD dosyasına düşer, kararı İNSAN verir (raporlar MOD ekibinden geçer)
TANIK KİMDİR: masadaki HERHANGİ mühürlü — host dahil (mühürlü sıfatıyla), event'te
  yüzer/founder-host'lar dahil. VENUE PERSONELİ TANIK DEĞİL 🔒 (personelin main-mühür
  basması teknik açılıştır — masayı mekan değil MASA doğrular; güç ayrılığı).
  Tanıklık taahhüt değildir (K1'e girmez); yalancı-tanık deseni MOD sicili.
[SOLO MOD KALDIRILDI ♻️ 28 Tem — founder: LOCAL'in ruhuna aykırı; masa=min 3, kişisel-an kaydı platform yüzeyi değil.] CONF'la ilişki: pending KAPI bekçisidir (katılım gerçek mi),
  CONF TERAZİ bekçisi (veri kaç tanıklı) — ikisi art arda, biri diğerini gevşetmez.
```

# 4. LOKASYON VARYASYONLARI (omurga sabit — değişen ① çapası + ② seti)

| | CUSTOM | VENUE | ZONE | TARİFELİ/VAPUR | HAREKETLİ |
|---|---|---|---|---|---|
| ① çapa | host pini 30m | mekanın mühürlü pini 50m | marker 75-100m | iskele→gemi | açanın canlı konumu 15m |
| ② seti | 🗣👀📱 (kod dünyası) | +🔵 masa/kapı totemi | +🔵 marker | +🔵 iskele totemi | 🗣👀📱 |
| kapı | formül | formül | formül | min(formül, kalkış+5dk) ⭐ | formül |
| skor | kişi boruları | +P2V→Trust, RQ→Aura, Gece Raporu | +P2Z→zone-Aura | zone-Aura (hat bazlı) | lokasyon tipine göre |
| özel | ev: kimse giremezse kapıda düşer, katılımcı cezasız | panel canlı izler (sayı, isimsiz) | create herkese hep açık | rota=tek sefer | çapa ölürse sıradaki mühürlüye devrolur ⭐ |

**EVENT (sub/main):** join = event'e TEK SÖZ (K1'de 1) → MAIN mühür kapıda (AIS; ≥100 kişide kod YASAK — totem/personel noktaları, turnike ritmi) → SUB mühür masada (feedback o masaya; totem yoksa sub-KOD — köşenin ilk oturanı açar: fraktal ilk-gelen). Masa geçişi = söz değil (sub güncellenir, log tutulur). **FB hakları = mühür logu kesişmesi:** aynı sub'da zaman-kesişenler masadaş (süre = yalnız liste SIRASI, hak filtresi değil) → R1+(FL varsa Q1/Q2); yalnız main-komşusu → kişi-FB yok, tag/arkadaşlık yolu açık; RQ son-sub + "gece geneli" tek soru ⭐; P2V/chip main'den herkes.

**WALK-IN (venue):** origin=WALK_IN — slot hakkı yemez, TAVAN YOK 🔒 ♻️M1 (kabul edilen hiçbir masa hak yemez; fren fizik+mekan iradesi); %100 venue ritüelidir (Trust/Aura/rapor/Regular'a sayılır). Mekan kitle-yönetimi: slot koşulları → self-rez modu (ANINDA/ONAYLI ⭐) → istek kuyruğu [Kabul/Alternatif/Red] → kendi VEN-EVENT'i. Cevapsız-istek sayacı panelde ⭐.

**TOTEM (3-hal kapısı) 🔒:** okutan kişiye göre: sözü var → direkt kapı ekranı · kayıtlı-sözsüz → buradasın-modu profil (90dk bilet ⭐ — salt UX, hiçbir yetki; her aksiyon canlı GPS ister) · app'siz → web-vitrin hunisi. Launch: mekan başına min 1 totem (kasa/giriş) 🔒; masa totemleri Operatör+/event-set ⭐.

# 5. SÖZ EKONOMİSİ (K-seti)

```
K1 ÇAKIŞMA YASAĞI 🔒: kurulan+join'li taahhütler zaman-çakışamaz · event=tek söz ·
  masa geçişi ve tanıklık söz değildir · ardışık serbest
K2 JOIN_BUFFER_MIN: 0dk ⭐ (band 0-30 — geç-kalma cezası buffer işini organik yapar)
K3 DAILY_COMMIT_CAP: 4/gün ⭐ (band 3-6) — YALNIZ İLERİ-TARİHLİ taahhüt sayar 🔒;
  start'a ≤30dk join VE Instant-kurma MUAF ⭐ ("kapıdan girmek söz vermek değildir");
  event=1 · leave hak iadesi · Series günlük instance sayılır
K4 GİR-ÇIK: kilit-öncesi leave bedava 🔒 · aynı ritüele günde 1 join ⭐ · günlük
  leave MOD-eşiği 6 ⭐ (otomatik ceza yok, desen dosyası)
```

# 6. ALGORİTMA BAĞLARI (dokunulmayanlar + tek köprü)

```
DOKUNULMADI 🔒: AIS dilimleri+start-çıpası · kapı/kilit formülleri · late-cancel+
  replacement · IF · no-show merdiveni · CONF/DS/BC/MD/BR/CAP · GPS radius değerleri
TEK KÖPRÜ: AIS saati = ①'in DENENDİĞİ an (pending çözümü geç gelse bile) — adalet
  kuralı; onun dışında check-in yalnız mühür ÜRETİR, skorları formüller işler.
ÖLEN ESKİ PARÇALAR: [Kodu Aç] butonu · escrow/tohum-devri · host-önceliği penceresi ·
  birth-grace · arrival-AIS · pin-taşıma · dönen-kod · kişisel-kod · devral-valfi
```

# 7. GAMIFICATION BAĞLARI

```
REGULAR: aynı mekanda 4 check-in'li ritüel / 45g ⭐ (walk-in + VEN-EVENT mühürleri
  SAYILIR — müdavimlik masadan ölçülür) · sönüm 60g · zone'da Regular yok
BADGE: venue-badge koşulları mühür-bazlı sayar (geliş/kategori/slot/etkinlik)
MEMORY/MB: yalnız mühürlüler üretir; ısınma evresi çekimleri RULO'da taslak, damga
  gerçek anı yazar · AURA/TRUST gözlemleri yalnız mühürlü feedback'inden (tekrar-rater
  sönümlü) · GECE RAPORU/PAZAR PAYI mühür verisinden · ŞERİT=sosyal ödülün kendisi
  ("masayı X açtı" rozeti — Kuran/Açan rol dili: NS teşhir edilmez, P2H o ritüelde sorulmaz)
BURADAYIM BİLETİ 90dk ⭐: kozmetik mod — gamification hissi verse de yüzeyi yok
  (yetki sıfır). TTL bandı 30-90.
```

# 8. DÖRT CEPHE — potansiyel sorunlar, çözümler, izleme

```
C1 SÜRTÜNME BAHSİ (3-adım kapı dönüşüm düşürür mü?)
  Belirti: görüntüleme→join yüksek, join→mühür düşük · İzleme: funnel oranları +
  kapı-ekranı terk noktası · Çözüm merdiveni: (1) UI hızlandırma (tek-jest totem,
  numpad otofokus) (2) radius ⭐ gevşetme 30→50m (3) konum-notu/şerit görünürlüğünü
  artır (gelme kaygısını düşürür) — ASLA gevşetilmeyecek: ① zorunluluğu, kod-relay.
C2 ŞEHİR-GPS GERÇEĞİ (beton kanyonda pending patlaması)
  Belirti: pending/mühür oranı >%10-15 · İzleme: bölge-bazlı pending haritası +
  T1/T2 kırılımı · Çözüm: bina-yoğun venue'larda radius ⭐ + venue-pini kalibresi
  (mühürlü pin kapı önüne) + Android konum-izni onboarding eğitimi + eşik ⭐'ları.
C3 SOSYAL PÜRÜZ ("kod ne?" çekingenlik eşiği)
  Belirti: masada bekleyip mühürlenmeyenler, tek-kişilik terk · İzleme: mühürsüz-
  oturma raporu (venue gözlemi) + prova saha notları · Çözüm: 👀+📱 araçlarının UI'da
  eşit görünürlüğü + açılış anonsuna kültür-copy ("kodu sormak selam vermektir") +
  founder-host'ların modelleme davranışı. Pivot'ta en çok İZLENECEK cephe.
C4 FALLBACK-KOD SUISTIMALI (kalan tek gaming yüzeyi: canlı-telefon relay'i)
  Belirti: gps_distance_m sınır-deseni + hep-aynı-tanık + sık-T2 kombinasyonları ·
  İzleme: MOD korelasyon dosyaları · Çözüm: desen→L-merdiveni (insan kararı),
  yalancı-tanık sicili, T3 eşiği ⭐ açılabilir. Sıfırlanamaz — fiyatlı tutulur.
+C5 OPERASYONEL: totem kayıp/kırık → marker-arızalı modu (② kod'la yaşar, zone/venue
  ölmez) + white-glove yedek seti + panelde "totem talebi".
```

# 9. PİVOT RİTÜELLERİNDE DİKKAT LİSTESİ (saha kontrol kartı)

```
□ Kapı-ekranı süresi: [CHECK-IN]→mühür kaç saniye? (hedef <20sn; >45sn = C1 alarmı)
□ "Kod ne?" anı: kim soruyor, tereddüt var mı, 👀/📱 kaç kez kullanıldı? (C3)
□ İlk-mühür töreni: açan kişi ne hissetti — onur mu yük mü? (copy kalibresi)
□ Konum notu yazılıyor mu, işe yarıyor mu? ("masayı bul" başarısı)
□ Pending sıklığı + çözülme süresi + tanık tereddütü (C2 + eşik ⭐ kalibresi)
□ Şerit etkisi: prelobby'dekiler "masa yaşıyor" push'uyla hızlandı mı?
□ Geç kalan davranışı: 0.85 dilimi + nötr kart nasıl karşılandı? (ceza-hissi ölçümü)
□ Venue tarafı: personel toteme sahip çıktı mı, rez-hazırlık refleksi doğdu mu?
□ Walk-in doğumu: sokaktan masa gerçekleşti mi, kaç dakikada? (rez-kültürü nabzı)
□ Kapı sonrası gelenler: kaç kişi kapıya çarptı, tepkisi ne? (kapı ⭐ kalibresi)
□ Kod kültürü: kod dijital yollandı mı (ihlal gözlemi), masada nasıl söylendi?
□ Telefon-ölü vakası: kaç kez yaşandı, masa nasıl çözdü? (dürüst sınırın maliyeti)
```

# 10. DÜNYADA YERİ (dürüst hüküm)
Foursquare = GPS+şeref (mock'la öldü) · Meetup = host-swipe, 24h açık · BeReal = zaman tetikli, mekansız · bilet-QR = devredilebilir. **Kimlik + canlı-GPS + fiziksel-temas + insan-tanıklığı + davranışsal-bedel beşlisi tek kapıda: yok.** Hata sınıflarımız bilinir ve ⭐-kalibre sınıfındadır; mimari-çökertici açık kalmamıştır (tam-gün sim + 30dk stres + metro/vapur/ev/trol testleri geçildi).
