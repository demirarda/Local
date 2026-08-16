# §0 — ARDA/CURSOR BAŞLANGIÇ PROTOKOLÜ (1 Ağu — okumadan kod yazma)
Bu beş dosya LOCAL'in TEK ürün kaynağıdır. OTORİTE SIRASI: ① 1 Ağu founder/Defter-Kapanışı kararları ② bu doküman (implementasyon) ③ Master Parametre (aktif sayılar) ④ Sistem Anayasası (değişmez ilkeler) ⑤ Sosyal Ürün Temelleri + Yıldız Listesi (UX/privacy + kalibre). İLK TURDA KOD YAZMA — önce mevcut repoyu bu beş dosyayla karşılaştır ve çıkar: mevcut/eksik/çelişkili yapı · Launch–F1.5–F2–post-v1 ayrımı · gerekli schema migration'ları · servis+ekran bazlı build sırası · her bölümün acceptance testleri (Sim_Final_GoldenVectors = birim-test çekirdeği). KURALLAR: açık değerleri TAHMİN ETME — config stub bırak · F1.5/F2 flag'lerini launch'a SOKMA · aktif witness=LEGACY_2_TIER (3-kademe config kapalı) · her biten dikey parçada migration+test+rollback notu üret · SİL emirleri build'den ÖNCE koşar.

# LOCAL — CURSOR BUILD DOKÜMANI v3.0 (1 AĞUSTOS TEMİZ BUILD)

> **⚡ GÜN İÇİ GÜNCELLEME (12 Tem, checkpoint sonrası) — değişen yerler, hızlı tarama:**
> 1. **§2 KOD:** kişiye-özel kod RED + masa-QR-check-in RED (sorduğun gaming case'in kararı — tek kod + relay aynen) · YENİ: check-in eventine `gps_distance_m` logu + `checkin.EDGE_PATTERN_M` sınır-deseni eşiği (MOD sinyali) · "DÖRT YEDİ İKİ" yazı-okunuş satırı KALDIRILDI (sadece dev punto rakam)
> 2. **§2 NABIZ 3 MOD:** prelobby=doluluk / live=`pulse.LIVE_MIX` / arşiv=RQ · ayrı Ghost özelliği ve `users.ghost_mode` yoktur
> 3. **§8 FOLLOW:** ritüel-açtı sinyali PUSH ETMEZ — push yalnız zil opt-in VEYA `follow.RARE_HOST_D` (60g) istisnası · Pulse-scope follower'a da görünür
> 4. **§8 GECE RAPORU v2:** gün-sonu digest oldu — push: kapanış+30dk (`venue.NIGHT_REPORT_OFFSET_MIN`); içerik: GÜNÜN AURASI + ritüel satırları + kitle aggregate · **SLOT `audience_tag`** enum (🎓/🌍 — koşul değil davet etiketi)
> 5. **§11 ZONE-EVENT:** `rituals.event_group_id` — LAUNCH'TA LAZIM (stub değil): şemsiye kart + masa listesi + drop-in (Emirgan modeli)
> 6. **§18:** CONF n=1 nötr karışımı %75 → **%60** (founder kararı — n=1 delta çarpanı ×0.25→×0.40)
> Referans mockup'lar: `LOCAL_Create_Ritual_Ekrani.jsx` + `LOCAL_Venue_Panel.jsx`

**Kime:** implementasyonu yapan mühendis/AI · **PAKET KENDİ KENDİNE YETERLİDİR 🔒:** otorite yalnız bu klasördeki dosyalardır (§0 sırası). PAKETTE OLMAYAN HİÇBİR ESKİ DOKÜMAN/KURAL GEÇERLİ DEĞİLDİR — "v1.0" veya başka bir geçmiş sürüme referansla kural TÜRETİLMEZ; mevcut bir repo ile çelişki görülürse KOD DEĞİL BU PAKET KAZANIR ve fark soru-listesine yazılır. (Eski "v1.0'da olup burada anılmayan her şey geçerli" cümlesi 3 Ağu'da KALDIRILDI — kör-referans tehlikesi.)
**İşaretler:** ⭐ = config parametresi (kalibre edilebilir — hepsi `localConfig.js`'e, HARDCODE YASAK) · 🔓 AÇIK = founder/Aras oturumu bekliyor (altyapıyı kur, değeri/metni config-stub bırak) · 🏗 = yeni yapı · ♻️ = mevcut kodda değişiklik

---

# §0 — DELTA ÖZETİ (ne değişiyor, tek bakış)

| # | Alan | Aksiyon | Dokunulacak (senin raporundan) |
|---|---|---|---|
| 1 | Kimlik kapısı | 🏗 YENİ: NFC-KYC + doğrula-at | auth screens, `OnboardingUniversity*` yanına kimlik hattı |
| 2 | Keyword | ♻️ DEĞİŞTİ: 3 haneli KOD + emanet anahtar | `checkinService`, `revealCheckinKeyword` |
| 3 | Görsel kaynak | 🏗 YENİ: in-app kamera + Rulo + retro yayın | `memories` API, yeni kamera modülü |
| 4 | No-peer path | ♻️ Sabitler 0.35 / 7.5; Solo yüzey/scope yok | `rsEngine.js`, `localConfig.rs.no_peer` |
| 5 | Moderasyon | 🏗 YENİ: MOD-ENGINE (L0-L4) — mevcut `safety` API'nin üstüne | `safety`, yeni `modEngine` servisi |
| 6 | Regular | ♻️ AÇ: `regular.PARKED:false` + tam spec | yeni `regularService` |
| 7 | Recurring | ♻️ stub → tam ürün | `recurringRitualStub` → servis |
| 8 | Venue ekonomi | ♻️ Paketler yeniden adlandı + yeni ürünler (Gece Raporu, Pazar Payı) | `checkout-stub`, `venueSlotService`, İtibar sekmesi |
| 9 | Gölge-venue | ♻️ DÜZELTME: memory migrasyonu İPTAL — a+c modeli | `shadowVenueService` |
| 10 | Badge | ♻️ 5 kategori → 6 AİLE taksonomisi | `CATEGORIES`, `CATALOG` |
| 11 | Chip sistemi | 🏗 YENİ: feedback altı neden-chip'leri (route kolonlu) | `feedback` API + string tablosu |
| 12 | Zone/SPARK/marker | 🏗 YENİ stub'lar (flag kapalı) | yeni `zoneService` iskeleti |
| 13 | Arama/keşif | 🏗 sekmeli arama + kategori sıralama formülü | yeni `searchService` |
| 14 | Profil | ♻️ üni-etiket default AÇIK · hosted toggle · 4-sekme arşiv | passport ekranları |
| 15 | Nabız/butonlar | 🏗 halka gösterimi + ▲▼/Söz/Yankı satırı | ritüel kartı, memory kartı |
| 16 | Temizlik | 🧹 `RS_V31_VS_AKTIF...md` sil · HTML prototipleri `/design-refs`e taşı | repo |

---

# §1 — KİMLİK KAPISI 🏗 (auth v2)

**Kural: LOCAL'de doğrulanmamış hesap YOKTUR. İki şerit, tek kapı:**
```
ŞERİT A — ÜNİVERSİTELİ: üni-mail + doğrulama (mevcut OnboardingUniversity hattın ✅ kalıyor)
   → profile 🎓 üni-etiketi yazılır: default AÇIK ⭐ (kullanıcı kapatabilir),
     tıklanınca üni-profiline gider. Üni listede yoksa → "founder'ı ol" başvuru akışı (mevcut).
ŞERİT B — HERKES: resmi kimlik doğrulaması, KYC SaaS üzerinden (sağlayıcı: 🔓 AÇIK —
   Aras teklif topluyor; Techsign/İHS bandı). AKIŞ (kilit):
   canlı kamera + kart-kilidi çerçeve (GALERİ/UPLOAD KAPALI — görsel kaynak kuralının
   kimlik hali) → NFC çip okuma (ana yol) → 2-3 sn PASİF liveness + çip-fotoğrafı yüz
   eşleşmesi → sonuç. Çipsiz kart / NFC'siz telefon fallback: kart-üstü foto + selfie eşleşme.
   Desteklenen belgeler: TCKK · PASAPORT · AB kimlik kartı (öğrenci-olmayan yabancılar).
   Hedef: ≤60 sn ⭐, ömürde bir kez.
DOĞRULA-VE-AT: ham kimlik/biyometri BİZDE ASLA SAKLANMAZ. Bizde kalan:
   users.verified:true · users.age_ok:true(18+) · identity_hash (tek yönlü, tekrar-kayıt
   engeli — ayrı tablo, PII'siz). KYC sağlayıcı DPA'sı hukuk pakedinde (Aras).
ŞERİT B kullanıcısında üni-etiket ALANI YOK — boş da render edilmez.
DAVET: kapı-anahtarı DEĞİL — sadece paylaşım/onboarding hızlandırıcı link (davet
   kotası/Faz-B mekaniği İPTAL, kodda varsa kaldır).
Bekleme ekranı = kültür sahnesi: doğrulama dönerken onboarding kültür satırları döner
   (string tablosu: culture_id_1..n — metinler 🔓 AÇIK, kelime kilidi).
Ban gerçek: L4 banı identity_hash'i kara listeye yazar → aynı kimlikle re-register imkansız.
```

# §2 — KEYWORD v2 ♻️ (FOUNDER FİNAL KARARI: 3 HANELİ KOD)

**GPS ÇAPA KURALI ♻️:** radius merkezi = ritüel açılırken girilen exact location; kaynak tipe göre: Custom = host pini · Venue = mekanın DOĞRULANMIŞ pini (host oynatamaz) · Zone = marker koordinatı/centroid · Hareketli = start point + yürüyen 15m. Radius değerleri değişmedi ✅.
**CHECK-IN EKRANI ERKEN AÇILIŞ 🏗:** start − 15dk ⭐ (`CHECKIN_EARLY_OPEN_MIN`) ♻️30Tem: check-in PENCERESİ start−15'te AÇILIR — ilk temiz-GPS'li gelen masayı açar, KOD start−15'ten itibaren DOĞABİLİR (warm-up window: şerit+konuşma+kamera-ruloya; public paylaşım start'ta). Kural: kod check-in penceresi açılmadan üretilemez; pencere start−15'te açılır. AIS referansı her durumda resmî start (erken gelen tam-zamanında sayılır).
**PRELOBBY GÖRÜNÜRLÜK ♻️ (WaitingRoom + ritüel kartı):** dış katman: host + doluluk sayısı + nabız + tanım + KİLİT-ANI sayacı — katılımcı listesi RENDER EDİLMEZ; tek istisna FL-arkadaş sinyali ("2 arkadaşın katılıyor", friend_joining ✅ mevcut). İç katman (join sonrası): tam liste + konuşma + grace-sonrası exact-detay (mevcut ✅).
**PRIVACY:** `users.ghost_mode` alanı/endpoint/UI yazmayın; varsa migrate edip silin. Online/presence/last-seen göstergesi de yoktur.
**NABIZ MODLARI 🏗 (tek Ring bileşeni, 3 mod):** PRELOBBY = doluluk oranı · LIVE = canlılık karması ⭐ (check-in oranı + memory tempo — formül `pulse.LIVE_MIX` config) · ARCHIVE = RQ ortalaması. Renk bantları ortak ⭐.
**RİTÜEL DETAY SAYFASI ♻️:** dış katman alanları: tanım+kategori+tip rozeti (INSTANT/PLANNED/SERIES + spark_born etiketi) · zaman+kilit sayacı · yer kartı (venue-mini/zone/custom-bölge) · host bloğu (isim+🎓+hosted-sayı+highlight badges — P2H skoru ASLA render edilmez) · doluluk+nabız · koşul etiketi · FL sinyali · join CTA. **SERIES şeridi:** seri adı + hafta sayacı + geçmiş instance'ların arşiv linkleri (memory görünürlüğü scope'a tabi — ALL herkese, PULSE arkadaşa). Arşiv detayı: RQ-nabız + memories duvarı + retro ek-memory'ler + open-forum şeridi.

Kelime-havuz modeli İPTAL (Aras Görev 4/7 düştü). Final:
```
ÜRETİM ♻️ FİNAL — firstSeal MODELİ (seedCheckin/tohum ÖLDÜ): kod, İLK GELENİN mühürüyle doğar (kim olursa — host imtiyazı yok). firstSeal endpoint: advisory-lock (tek kod; aynı-transaction host tie-break, sonra ilk-yazan; kaybeden kod-ekranına düşer) → kod üret (3 hane 100-999) + window doğur (WARMUP evresi) + ritual_opened eventi (push+prelobby kartı+venue sinyali) + open_note alanı ⭐. İlk-mühür denemesi PENDING ise kod/window DOĞMAZ (masa açılmamış — sonraki 🟢 açar).
CHECK-IN AKIŞI 🏗: ① canlı GPS (integrity sinyalleri: mock-flag/Play Integrity/App Attest/imkansız-hız → location_suspect) → 🟢 geç · 🔴 blok · ⚠️/suspect → ② açık ama checkin.status=PENDING_WITNESS → ② dört araç: kod-numpad · ekran-göster (mühürlü ekranda kod kalıcı render) · LOCAL-TAG (mühürlüden tek-kullanım 30sn token — QR-göster/yaklaştır-it; server-side üretim, tek redeem) · NFC totem/marker değdir (=② sayılır; her değdirme öncesi ① koşar) → ③ mühür + arrivals-şeridi (tek durum: MÜHÜRLÜ).
PENDING_WITNESS 🏗: witness_threshold pending-anında kilitlenir (mühürlü ≤3→1, ≥4→2 ⭐) · şerit-onay endpoint'i (tanık=herhangi mühürlü; venue personeli HARİÇ) · PENDING_GRACE_MIN:10 ⭐ (deneme kapı-içiyse onay kapı+10dk'ya dek mühür basar) · AIS=deneme timestamp'i · onaysız+kapı: mühür yok, otomatik no-show YOK → mod_case üret.
   Kimse seçemez/değiştiremez — host dahil. Kod check-in penceresinden (start−15) önce üretilemez; start−15'ten itibaren doğabilir. AIS resmî start'a bağlıdır.
ÇAKIŞMA KORUMASI (zorunlu): kod atanırken AKTİF + yakın (yarıçap ⭐ 500m) ritüellerin
   kodlarıyla çakışma kontrolü — kampüs/yoğun bölgede iki masa aynı kodu ALAMAZ.
   (uniqueness scope: zaman-penceresi × coğrafya; global uniqueness gerekmez)
GÖSTERİM: kod host/katılımcı ekranında DEV PUNTO — yazı-okunuş satırı YOK (kaldırıldı).
   Katılımcı girişi: 3 haneli numpad, 3 deneme ⭐ sonra 30sn bekleme ⭐.
GAMING SAVUNMASI (kararlar): kişiye-özel kod RED · masa-QR check-in RED (QR yalnız
   /ritual/:id linki) · YENİ 🏗: check-in eventine gps_distance_m alanı LOGLA —
   "sürekli radius-sınırı + sıfır memory" deseni modEngine korelasyon sinyali ⭐
   (`checkin.EDGE_PATTERN_M` eşiği config).
AÇILIŞ SAHİPLERİ ♻️: normal=ilk gelen (kim olursa) · VEN-EVENT=personel (teknik açılış — tanık YETKİSİ YOK) · event sub=köşenin ilk oturanı · tarifeli-zone kapısı gate_override: min(formül, kalkış+5dk) ⭐ · hareketli çapa devri: açan offline→sıradaki mühürlü cihaz ⭐. EVENT: rituals.event_group_id + sub-mühür logu {sub_id, in_ts, out_ts} → FB masadaşlığı=zaman-kesişme sorgusu · sub-kodlar event-scope unique. WALK-IN ♻️M1: rituals.origin enum {SLOT_PLANNED, WALK_IN, VEN_EVENT} 🔒 — TAVAN YOK (walk-in sayaç/limit kodu SİL) · self-rez ♻️M2: her mekanda bedava; slot/saat işaretleme alanı + mode default INSTANT ⚡ (APPROVAL opt-in) + ince-ayar alanları PAKET-flag'li ⭐ (saat-aralığı kuralı, zon-filtresi, kitle-koşulu) · INSTANT tanımı: start≤create+2h ⭐ · capacity ♻️v3: kategori-önerisi soft (host aşabilir, uyarı) · mutlak 40 🔒 · K-seti configleri: JOIN_BUFFER_MIN:0 ⭐ · DAILY_COMMIT_CAP:4 ⭐ · LATE_JOIN_EXEMPT_MIN:30 ⭐ · SAME_RITUAL_JOIN_PER_DAY:1 ⭐ · DAILY_LEAVE_MOD_SIGNAL:6 ⭐ · buradasın-bileti TTL:90dk ⭐ (cihaz-persist, logout'ta ölür, yetkisiz).
   ritual_opened eventi → (1) registered'lara push "masa açıldı" + host'un konum notu (seed check-in ekranında opsiyonel tek-satır alan ⭐ open_note) (2) prelobby'ye açılış kartı (3) venue panel Bugün sekmesine canlı sinyal.
   JOIN KURALI ♻️: kilit yalnız AYRILIŞI kilitler — join KAPI KAPANANA DEK açık (kapasite içi); kilit-sonrası join'de grace YOK (anında söz) + exact-pin anında açılır. rituals.planners_only boolean ⭐ (default false) — true ise alım kilitte kapanır (eski davranış).
   GPS-FAIL AKIŞI 🏗: kod ✓ + GPS ✗/kirli → checkin.status=PENDING_WITNESS (yukarıdaki blok — tanık=herhangi mühürlü, eşik+grace configleri); gps_distance_m her durumda loglanır.
   KAPI UI KURALI: kullanıcıya asla %/formül gösterme — mutlak saat + sayaç.
   MASAYI-BUL SATIRI: check-in ekranına "Teras · Host: [avatar] · şu an N kişi masada" satırı.
   KONUŞMA KİLİDİ ♻️: prelobby chat kilit anında açılır (öncesi kapalı); host_broadcast tek yönlü her zaman.
YAYILIM: FİZİKSEL RELAY aynen — kod app'te SADECE check-in yapmışlara görünür; geç gelen
   masadakinden ağızdan alır. GPS + register + kod = üçlü kilit değişmedi.
İSTİSNASIZ: no-peer path dahil her ritüelde kod vardır (no-peer = rater'sız, ıssız değil).
   Host'a host-no-show işler; hosting kimliği değişmez. Radius'ta kimse yoksa: kapı
   sonunda ritüel düşer, katılımcı cezasız, host no-show.
CUSTOM/SABİT KOD YOK — hiçbir hesap tipi için (VIP istisnası = tek-kuyruk ihlali).
ARIZA ♻️30Tem: host-manuel-onay KODU SİL (AIS_MANUAL kaldır) — tek yol PENDING_WITNESS; host'a özel mühürleme yetkisi/endpoint'i YOK.
```

# §3 — GÖRSEL KAYNAK KURALI 🏗 (memory v2)

```
DOĞUM: görüntü YALNIZ window içinden, IN-APP KAMERA ile doğar. Window'da galeri/upload
   butonu HİÇ RENDER EDİLMEZ. Filtre YOK (flaş/gece modu gibi çekim gereklilikleri serbest).
DAMGA: her çekime immutable meta: {ritual_id, ts, geo}. UI'da kart üstünde görünür
   ("NBA GOAT · Çardak · 12 Tem"). Damga hiçbir akışta silinmez/düzenlenmez.
AKIŞ: çek → önizleme → [Paylaş] / [Ruloya kaydet] / [Sil]
PAYLAŞIM EKRANI — "DARDAN GENELE": [MASA=Window] → [+ÇEVRE=Your Pulse] → [+ŞEHİR=LW]. memories.audience enum: WINDOW|CIRCLE|CITY 🔒 (legacy PULSE/ALL scope'ları CIRCLE/CITY'ye migrate) · default=WINDOW 🔒 · CIRCLE'da etkileşim aktif 🔒 · ECHO kapsam-yükseltemez 🔒 (CIRCLE-memory echo'su CIRCLE'da kalır; render+API guard).
   Scope enum `WINDOW|PULSE|ALL` olur. Eski `SOLO` scope migrate edilip silinir; Solo route/UI yoktur.
RULO (taslaklar) 🏗: kaydedilen çekimler kullanıcının RULO'suna düşer (yalnız sahibine
   görünür). TASLAK ASLA SİLİNMEZ/EXPIRE OLMAZ. Veri: memories tablosunda status:draft.
RETRO YAYIN: taslak istenen zaman yayınlanır — HER ZAMAN orijinal damgayla (büyük çekim
   damgası + küçük yayın tarihi). Retro yayın:
   · PULSE'A DÜŞMEZ (Pulse feed sorgusu: yalnız captured_at son 24h ⭐)
   · arşive + passport duvarına + İLGİLİ RİTÜELİN FORMUNA "ek memory" olarak bağlanır
     (ritüel arşivi sessizce zenginleşir; bildirim üretmez)
TASLAK TİPLERİ: yalnız foto/video. Quote/playlist taslağı YOK (anlık üretilir).
VİDEO: aynı kural — in-app, max süre ⭐ 45sn (band 30-60), filtresiz.
PROFİL ARŞİV — 4 SEKME ♻️: QUOTE · BADGE · MEMORIES (yayınlanan) · RULO (çekimler+taslak,
   yalnız sahibi). Memories DUVARINA yükleme akışı YOKTUR — duvar otomatik toplamdır.
AVATAR: galeriden serbest (kimlik, iz değil). Canlı-avatar: parked flag.
YORUMLAR (Söz): TEXT-ONLY — foto/GIF/galeri eklentisi forum+yorumlarda YOK.
MÜZİK: link-out v1 (metadata+kapak+deep-link; ses bizden akmaz). Kapak API'den, üzerine
   oynama yok, platform attribution ibaresi (string tablosu). YouTube fallback: yalnız
   link-out, 3. sıra. v1.5: SDK window-içi çalma → flag MUSIC_SDK_ENABLED:false 🏗 stub.
```

# §4 — NO-PEER PATH ♻️ (ürün dilinde “Solo Ritualist”)

```
localConfig.rs.no_peer:
   NO_PEER_DAMPENER: 0.50 → 0.35 ⭐
   NO_PEER_CEILING: 7.5 ⭐ — peer-feedback'i hiç olmayan kullanıcı RS 7.5'i GEÇEMEZ:
     tavandayken no-peer pozitif deltası 0'a clamp; NEGATİF delta normal işler.
     Kullanıcının İLK gerçek peer-feedback'i (FL1/FL2 rater) işlendiği an tavan kalkar (kalıcı).
   CF_SELF_NO_PEER_W: 0.50
   NO_PEER_ENGAGEMENT: pozitif delta için R1 VEYA memory şartı.
rsEngine: ceiling kontrolü clamp aşamasına (BR sonrası) eklenir. score_events log'una
   ceiling_applied:true alanı (kalibrasyon görünürlüğü için).
```

# §5 — MOD-ENGINE 🏗 (moderasyon çekirdeği — mevcut safety API'nin üstüne)

```
RAPOR YÜZEYLERİ (11): kişi profili · arkadaş/FL3 · memory (görüldüğü HER yerden aynı akış —
   Pulse/arşiv/passport/venue-arşivi tek nesne) · quote(=memory tipi) · ritüel (join'siz de) ·
   SPARK kartı · prelobby mesajı · forum içeriği · Share-2-Person nesnesi · venue profili ·
   zone profili (moderasyon+OPS çift kuyruk) · venue-badge/etkinlik.
WINDOW PANELİ (4 yapısal buton — DEĞİŞMEZ):
   [Bildir] · [Bildir ve ayrıl] · [Konumumu bir arkadaşımla paylaş] · [Yardım seçenekleri]
   → Bildir'e basınca KATEGORİ katmanı açılır (metinler string tablosu 🔓 AÇIK; Aras aday
   seti: "Kendimi rahat hissetmiyorum / Birinin davranışı sınırı aştı / Ritüel tanımlandığı
   gibi değil / Başka bir şey"). Panel açmak iz bırakmaz. Bildir-ve-ayrıl: FB veremez, alır.
   Konum paylaş: FL1-3 seçimi, canlı 1h default ⭐, max ritüel süresi. Yardım: native arama
   (kullanımı otomatik cezasız-çıkış işler).
RAPOR PAKETİ (otomatik, insan görmeden hazırlanır):
   korelasyon puanı = f(aynı ritüelden 2. bağımsız rapor + sessiz-çıkış eşzamanlılığı +
   toplu erken ayrılış + hedef sicili + raporcu-güvenilirlik çarpanı − koordinasyon şüphesi)
   + [tanım yanılttı] chip yoğunluğu (bait sinyali — chip'ten korelasyona tek satır)
   + HOST-WITNESS: window-içi raporda host'a sessiz mikro-anket ("Ritüelinde sorun yaşandı
   mı?" 3 seçenek) — host raporlanan tarafsa SORULMAZ; venue ritüelinde venue de tanık verebilir.
   + AI ön-önerisi: {seviye, güven, tek-cümle gerekçe} — L3+ ASLA otomatik işlemez.
L-MERDİVENİ (karar tablosu):
   L0 içerik aksiyonu (memory kaldır/profil düzelt) — kişiye ceza yok, sicile not; tek moderatör
   L1 nötr resmi uyarı + sicil sayacı — tek moderatör, paket eşiği ⭐ geçerse
   L2a 72h ⭐ ritüel açamama · L2b (30g'de tekrar) 7g ⭐ açamama + 30g ⭐ Free-location yasağı
   L3 RS cezası −0.15 baz, −0.30 tavan ⭐ + 30g ⭐ tam askı — İKİ bağımsız moderatör + founder
   L4 kalıcı ban + identity_hash kara-liste (+yasal bildirim gerekirse) — extreme vakalar
      (çocuk istismarı/cinsel saldırı) L3'e uğramaz, DOĞRUDAN L4
DEMİR KURALLAR: ham rapor RS'e ASLA dokunmaz (MOD-BYPASS = RS'e tek yol) · TEK kuyruk
   (hesap büyüklüğü/venue/brand ayrıcalığı yok) · itiraz her kademede, kararı-VERMEYEN göz ·
   askıda badge kazanımı durur, kazanılmış silinmez · kasıtlı asılsız raporcu L1-L2 ·
   seviye atlama mümkün (tek ağır vaka → direkt L3/L4, çift onayla).
PUBLIC GÖRSEL OTOMATİK TARAMA: Pulse/Local World'e akan her görsel yayın ANINDA güvenlik
   taramasından geçer (nudity/CSAM sağlayıcısı 🔓 AÇIK) — rapor beklemez.
MODERATÖR PANELİ (admin): kuyruk + paket görünümü + tek-tık L0/L1 + four-eyes L2 +
   çift-bağımsız L3-L4 + itiraz yönlendirme. SLA saatleri ⭐: güvenlik 2h · içerik 12h · genel 48h.
```

# §6 — REGULAR ♻️ (PARKED:false → tam ürün)

```
KAZANIM ♻️: aynı mekanda son 45 gün ⭐ (regular.WINDOW_D:45) içinde 4 ⭐ (regular.N:4) check-in'li ritüel → otomatik. SÖNÜM: son katılımdan 60g ⭐ (regular.DECAY_D:60) sonra sessiz düşüş.
GÖRÜNÜRLÜK: PRIVATE — başkası göremez (konum-deseni koruması). Kullanıcı kendi listesini
   görür; MEKAN kendi regular listesini görür (+ "X regular oldu" venue-notif).
   İsteğe bağlı passport vitrini: default KAPALI ⭐ toggle.
   Bağlamsal istisna: regular-only slot katılımcıları masada birbirini doğal bilir.
İŞLEV: regular-only slot (slot görünürlük enum'una 3. değer: PUBLIC/VENUE_ONLY/REGULAR_ONLY)
   · mekan iç-halka araçları (§8). DS-Regular ağırlığı KALDIRILDI ♻️ — ds config'ten Regular:0.30 satırını SİL (kişi-ağırlığı yalnız FL; gerekçe: mekan-tekrarı zaten VD/CtxD'de, çifte sayım olmaz).
GERİ SAYIM: mekan profilinde kullanıcıya "3/4" mikro-göstergesi ⭐ (yalnız kendine).
Kalıcı prestij AYRI: VENUE-badge — eşik MEKAN-TANIMLI (evrensel merdiven YOK; koşul tipleri geliş/kategori/slot/etkinlik, admin onay, max 5 — §9 ✅ zaten böyle).
```

# §7 — SERIES ♻️ (eski adı "recurring" — stub → ürün)

**İSİM KARARI (founder):** Ritüel zaman tipleri finali → **INSTANT (TR: Anlık) · PLANNED (TR: Planlı — eski "Fixed") · SERIES (TR: Seri — eski "recurring", teknik kokan ad UI'da hiç görünmez).** SPARK bir TİP DEĞİLDİR — zone'da tanışmadan doğan INSTANT ritüelin doğum etiketidir; kartta "⚡ SPARK'tan doğdu" rozeti taşır, tip enum'una girmez (enum: INSTANT/PLANNED/SERIES).
Instance-spawn mantığın kalır; tamamlanacaklar: seri sahipliği (host değişimi/devir) · instance başına bağımsız kayıt+kod+window+feedback (her instance ayrı ritüel = venue n_eff'ine ayrı yazar ✅ mantığı) · seri kartı ("Perşembe kahvesi · 7. hafta") · seri-takip zili · host seri iptali (gelecek instance'lar düşer, geçmiş arşiv kalır).

# §8 — VENUE EKONOMİ ♻️ (paket mimarisi v2)

```
PAKETLER (yeniden adlandır — "Venue PRO/Şehir Ortağı" SİL):
   FREE: profil+arşiv+skorlar+öneri kutusu(al/red)+temel tavsiye + 1 slot/ay ⭐ (devretmez)
      + slot sonrası TEK SEFERLİK mini-rapor (o gecenin kırılımı — tadımlık)
   OPERATÖR ₺7.900/ay ⭐ (bant 6.9-9.9K / €199): 3 eşzamanlı slot ⭐ (ritüel sayısı sınırsız —
      slot=concurrent kap) + recurring + Instant + alternatif-öner + regular araçları +
      venue-badge(5) + GECE RAPORU + AYLIK NABIZ + chip trendleri
   HAKİM ₺19.900/ay ⭐ (bant 16.9-24.9K / €499): Operatör'ün hepsi + 5 slot ⭐ + PAZAR PAYI +
      BÖLGE RADARI + ANONİM BENCHMARK + AI AYLIK TAVSİYE + ayda 1 Takeover DAHİL +
      brand-slot önceliği (ticari eşleşme kanalı — kullanıcı-yüzü sıralamayla İLGİSİZ) +
      öne-çıkan etkinlik kartı
   KOMPAKT BANT — KARAR 3 Ağu 🔒: KAPALI başlar (config-hazır ⭐: compact.SEAT_LE40_MULT:0.7, enabled:false) — shrinkage+MIN_DISPLAY küçük mekanı zaten koruyor; aktivasyon yalnız pivot verisiyle
      (yapıyı çarpan-hazır kur: package_price = base × size_multiplier)
ADD-ON: ek slot paketi ~₺2K/ay ⭐ · LOCAL TAKEOVER (24h "mekan sadece LOCAL'e": slot limiti
   kalkar + keşif işareti + zil-bildirimi; fiyat formülü 🔓 AÇIK — Aras önerisi paket-%'si ×
   gün-tipi) · etkinlik vitrin kartı ⭐
YENİ ÜRÜNLER 🏗:
   GECE RAPORU v2: GÜN-SONU DIGEST — push zamanı: mekanın kapanış saati + 30dk ⭐
      (`venue.NIGHT_REPORT_OFFSET_MIN`, kapanış saati profilden). İçerik: GÜNÜN AURASI
      (o günün RQ ortalaması, tek halka) + gün içi ritüel satırları (nabız/doluluk/memory
      sayısı/chip) + 🟢🟡🔴 toplam + top-chip & dikkat-chip + check-in toplamı +
      yeni-vs-dönen oranı + regular hareketi + kitle aggregate (%üni/%intl — kimliksiz).
      Ritüel biter bitmez mini sinyal ("raporda seni bekliyor"); digest gece tek push.
      Panel sekmesi: GECE (VenueManagerScreen "Bugün" yanına — mockup: LOCAL_Venue_Panel.jsx)
   AYLIK NABIZ: gün×saat ısı haritası · ölü-gün doluluk deltası · regular büyümesi · dağılım
   PAZAR PAYI (Hakim): "bölgede bu ay N kahve ritüeli — X'i sende (%Y)" (bölge=anonim aggregate)
   KİLİTLİ TEASER 🔓 AÇIK: Operatör İtibar sekmesinde Pazar Payı panelini bulanık+kilitli görür
MONETİZASYON TETİĞİ: fee'ler 0 kalır (Faz 0-1 free ✅) — mekan-başına satış tetiği:
   kendi sayıları eşiği ⭐ (N ritüel + X check-in + ölü-gün Δ%) geçince satış akışı açılır.
ÖNERİ KUTUSU (5 karar kilitli): davranış-özeti gösterilir, RS SAYISI ASLA · [Alternatif Öner]
   tek tur · ritüel-24h kala otomatik expire+bildirim · cevapsız sayaç mekana içsel ·
   spam kapısı: aynı mekana 1 bekleyen istek + günlük toplam 5 ⭐
GÖLGE-VENUE DÜZELTMESİ ♻️: shadowVenueService'teki OTOMATİK MEMORY BAĞLAMA İPTAL —
   (a) bölge verisi İÇSEL kalır + kayıt anında mekana gösterilir (satış ekranı) ·
   (c) opsiyonel "civarda N ritüel yaşandı" SAYI rozeti ⭐. Geçmiş memory'ler mekan
   arşivine TAŞINMAZ (rızasız yeniden-bağlamlama). Skor zaten sıfırdan ✅.
ONBOARDING ♻️: masa-grid editörü OPSİYONEL (zorunlu olan: zon adı + zon kapasitesi —
   slot konumu zon-düzeyinde çalışır; grid white-glove/sonra) · foto min 5 · Maps linki
   zorunlu · tek ops. web/sosyal link · taahhüt checkbox+tam metin · VIES/belge kontrolü ·
   içeriden-GPS fiziksel onay (hepsi mevcut yapında ✅, grid'i gevşet).
SLOT KİTLE ETİKETİ 🏗: slot'a opsiyonel audience_tag enum (UNI_FRIENDLY 🎓 / INTERNATIONAL 🌍
   / yok) — KOŞUL DEĞİL (join'i kısıtlamaz), keşifte hedef kitleye işaretli gösterim.
   Koşullu slotlar ayrı mekanizma (min-RS/badge/regular-only/üni — mevcut plan ✅).
   Gece Raporu + Aylık Nabız'a aggregate kitle satırı: üni-etiketli % + international %
   (kimliksiz toplam — VEN-5 uyumlu).
FOLLOW DEĞER SPEC'İ ♻️ (şu an follows tablosu var, değeri netleşti):
   Pulse-scope (PULSE) memory'ler friend + FOLLOWER'a görünür (feed sorgusuna follower
   ekle) · takip edilen host ritüel açınca SİNYAL yüzeyde (feed) — PUSH YOK; push yalnız
   kişi-zili 🔔 opt-in VEYA RARE-HOST istisnası: takip edilen 60g+ ⭐ (`follow.RARE_HOST_D`)
   ritüel açmamışken açarsa tek push · follow onaysız · follower remove/block ·
   feedback/FL/iç-katman follow'a ASLA açılmaz.
NOMINATION TRIAGE 🏗: kullanıcı önerileri (3 giriş: harita uzun-bas · Free-ritüel sonrası
   tek-tık · boş-arama) → havuz + koordinat-kümeleme → ops paneline kart (pitch listesi).
```

# §9 — BADGE ♻️ (6-AİLE migrasyonu)

```
CATEGORIES 5'li → 6 AİLE: SPECIAL ✦ · MASTERY ⬡ · BEHAVIORAL ● · VENUE 🛡 · ZONE 📍 · MILESTONE ▦
   mapping: content→MASTERY · location+region→ZONE · behavior→BEHAVIORAL ·
   special(founder/brand dahil)→SPECIAL · venue-created→VENUE
TIER dili: I/II/III → Novice / Regular / Master (görsel metal aynı, etiket değişir)
VENUE-BADGE kuralları: kalkan şablonu sabit · logo işlenir metni mekan yazamaz · max 5 ·
   admin onay · koşul tipleri: geliş/kategori/slot/etkinlik ✓ — harcama ✗ öznel ✗ ·
   sistem verir, mekan elle dağıtamaz.
Moderasyon kesişimi: askıda kazanım durur, kazanılmış silinmez (modEngine hook).
Negatif rozetler: skor verisinden DOĞMAZ, hiçbir skoru etkilemez, kapı koşulu olamaz.
Chip→badge köprüsü 🔓 AÇIK (ortak oturumu): tekrarlayan chip desenleri badge sinyali.
LLM pipeline: flag kapalı kalır ✅ (launch: insan onayı modu).
```

# §10 — CHIP SİSTEMİ 🏗 (feedback altı neden-etiketleri)

```
MEKANİK: her 🟢🟡🔴 cevabının altında opsiyonel chip satırı — TEK SEÇİM ⭐ (çoklu-seçime
   geçiş config) · chip sırası kullanıcı-başına RASTGELE (pozisyon yanlılığı önlemi) ·
   atlamak serbest.
SETLER FİNAL: RQ her renkte tam 3; P2V her renkte tam 5 (Anayasa E2.8 seed'leri). P2Z ayrı kısa set; P2P/P2H chip'i yok.
ROUTE KOLONU: her chip tanımında route: host_private | venue_itibar | ops (TEKLİ enum — Aura katkısı chip-TİPİNDEN türetilir, route'a 'aura' değeri EKLENMEZ)
   ([marker bulunamadı]→ops = zone bakım telemetrisi)
GÖRÜNÜRLÜK: top-chip ritüelde en az 3 farklı cevap, venue'da en az 10 cevap olmadan public değildir. Kişi geçmişi kişi puanı değil ritüel özeti gösterir.
İZLEME: 🟡-chip kullanım oranı kalibrasyon metriği (admin dashboard).
```

# §11 — ZONE / SPARK / MARKER 🏗 (flag'li stub'lar — post-v1 ama iskele şimdi)

**ZONE-EVENT 🏗 (bu LAUNCH'TA lazım, stub değil):** rituals.event_group_id (nullable) — aynı grup ritüelleri keşifte TEK ŞEMSİYE KARTTA toplanır ("LOCAL @ Emirgan · 8 masa · 22/32") → içinde masa listesi. Her masa = normal ritüel (ayrı kod — 500m çakışma koruması zaten ayırır · ayrı feedback · zone-Aura'ya ayrı gözlem). Masalar Instant-mantıklı (drop-in: alımlar kapı sonuna dek); dolu masa kartı diğer masaları önerir. Masa-QR deep-link: /ritual/:id (mevcut yapı yeter). Admin: event-group oluşturma ops-portal'a küçük ekran.

```
zoneService iskeleti: zones tablosu {id, name, geo, marker_type(TREE/L/DJ/STONE), radius ⭐}
ZONE PROFİLİ: canlı ritüeller + arşiv + Aura (Trust YOK) + forum + dağılım (hakimiyet)
ZONE-KEY: marker QR/NFC → zone profili deep-link
SPARK (flag SPARK_ENABLED:false): zone içinde QR-tanışma → beraber instant ritüel;
   min 3 korunur ("2 kişi başlattı" kartı, 3 dolmazsa ritüel doğmaz, ekleşme kalır)
Zone badge sinyali: ritüel 3p / marker okutma 1p ⭐ (badge motoruna event)
Zone raporları: moderasyon + OPS çift kuyruk (marker hasarı → ops)
```

# §12 — ARAMA & KEŞİF 🏗 (searchService)

**WEB-VİTRİN 🏗 (✓ onaylı — WEB_SHOWCASE_ENABLED:false ile inşa, prova sonrası açılır):**
```
Salt-okunur SSR/statik katman: /w/forum/:id · /w/venue/:slug · /w/zone/:slug ·
  /w/brand/:slug · /w/pulse (LW-scope taze akış) · /w/ritual/:id (yalnız LW-izli künye)
Kapsam sorgusu: SADECE scope=ALL(Local World) içerik + venue/zone/brand public profil.
  Kişi profili route'u YOK. Etkileşim endpoint'i YOK — tek CTA app-store linki.
İSİM KURALI: users.web_named boolean DEFAULT FALSE (opt-in) — false ise vitrine
  rumuz render ("bir LOCAL üyesi · <bölge>"); app içi isimler etkilenmez.
OG-kart üretimi (damga+imza) + venue sayfalarına SEO meta.
rituals.window_visibility enum: TRANSPARENT | CLOSED (DEFAULT ⭐ CLOSED) — create
  akışına 7. adım/toggle. CLOSED: window akışı (söz/thought) yalnız katılımcılara;
  TRANSPARENT: detay sayfasında şehre okunur. Katılımcı listesi HİÇBİR durumda
  dış-katmana/web'e serialize edilmez (API-level guard yaz — UI kuralı değil).
```

**BRAND ENTITY 🏗 (§11.5 sayılır — onaylı, rehber: LOCAL_Kurum_Brand_Rehberi.md):**
```
Tablolar: brands {id, name, logo, category, one_liner} · brand_members {brand_id,
  user_id, role, verified} · rituals.brand_id (nullable — imza şeridi)
Kurallar: brand ritüel AÇAMAZ — brand_member kişi açar, brand_id imzalar · RQ hem
  host'a hem brand-Aura'ya işler · brand profili: Aura + dağılım + yaşandığı-yerler
  (venue-linkli, harmansız) + Series şeridi + arşiv (gizlenemez) — TRUST YOK, slot
  YOK, feed YOK · kendi binası = custom location; çoklu-masa = event_group_id
  (mevcut yapı — yeni altyapı SIFIR) · keşif: Brand arama filtresi + brand kartı ·
  imza keşif sıralamasını ETKİLEMEZ · launch: brand oluşturma admin-only (pilot
  programı — self-serve yok).
```

```
SEKMELER: Tümü · Ritüeller (girebileceğin önce) · Slotlar · Mekanlar · Zone'lar · Kişiler
   (akıllı sıra: friends→followers→FL-ağı→herkes) · Memories (canlı 24h + kalıcı arşiv) ·
   Kategori · Konum
İKİ KATMAN SIRALAMA: nesnel taban (satın alınamaz) + kişisel üst (interests/ritual-type/grafik)
KATEGORİ-ARAMA FORMÜLÜ: skor = kategori_payı × kategori_RQ_ort × conf(instance)
   — conf: <3 instance "tentative", sıralamada öne GEÇEMEZ
KARAKTER KARTI (venue): Trust+etiket + Aura+etiket + her skorun altında en-çok-oy-almış
   1-3 chip (🟢+🔴 aynı anda olabilir) + dağılım ilk dilimler + "+diğer" satırı.
   Hacim sayısı kartta YOK (profil detayında) ⭐.
ZİNCİR: şube=ayrı profil/skor; zincir sayfası liste + aralık ("6.8–8.4"), harman YOK.
BRAND: yalnız kendi Aura'sı (Trust yok) + yaşandığı yerler listesi (her mekan kendi
   skoruna linkli, ortalama YOK) + arşiv aynı gizlenemezlik.
```

# §13 — BİLDİRİM EKLERİ ♻️

**ŞEHİR MİMARİSİ 🏗 (§12.5 — Milano hazırlığı, gün-1 kurulur):** `cities {id, name, status: ACTIVE|COMING}` · her rituals/venues/zones/memories satırına city_id (konumdan denormalize) · `users.active_city` (GPS-default + manuel gezgin-modu değişimi). SCOPE KURALLARI: harita/keşif/city-akışı/slot sorguları = active_city filtreli · arkadaş/takip Pulse'ı = city filtresi YOK · web-vitrin + forum-arşiv okuma = city filtresi YOK · şehirler-arası Planned join SERBEST (engel koyma). COMING şehirde app: founder-ol + vitrin + notify-me ekranı (talep logu).
**WINDOW-SONRASI AYARI UI ♻️:** "Efemerit" kelimesi TÜM yüzeylerden silinir — create adım 5 soru formatı: "Masa bitince tartışma devam etsin mi?" [Hayır — izler kalır, defter kapanır] / [Evet — forum açık kalır]. Enum kodda AYNEN kalır (refactor yok), yalnız string değişir.

```
ZİL 🔔: venue/zone/kişi profillerinde bildirim-aç (follow'un üstünde anlık tetik) —
   "slot açıldı/ritüel açtı" erken haber. follows tablosuna bell:boolean.
3-KATMAN MODELİ: SİNYAL (her event loglanır) → YÜZEY (nerede görünür) → PUSH (yalnız:
   seni doğrudan ilgilendiriyorsa VEYA zil açıksa). Push default listesi launch öncesi
   founder temizliği 🔓 AÇIK — tüm event'leri kur, default'ları config'e.
YENİ EVENT'LER: memory-etkileşim (Söz/▲-eşikli/Echo — ▼ ASLA PUSH EDİLMEZ,
   ▲ ve ▼ sayıları public, oy kimlikleri anonim) · "vitrine seçildin" · badge yaklaşımı ("2 ritüel
   kaldı" — yalnız sahibine) · regular kazanımı (mekana) · venue oturma-geçişi · zone
   canlılık/SPARK/founder-fırsatı · Gece Raporu push'u (venue) · retro yayın BİLDİRİM ÜRETMEZ.
```

# §14 — PROFİL / PASSPORT ♻️

```
YAPI: isim + (🎓 üni-etiketi: yalnız Şerit-A, default AÇIK ⭐, üni-profiline link) →
   BIO-QUOTE (1, quote arşivinden) → BADGES (3 highlight) → SOCIAL BAR: Friends
   (iç sekmeler: FL1/FL2/FL3 · Venue · Brand · non-FL) · Followers · Following ·
   RITUALS: N (+ "M hosted" toggle, default KAPALI ⭐) → MEMORIES duvarı.
HOST SEKMESİ YOK (herkes host). Yaş/demografi alanı YOK. RS default private (sahibi
   isterse açar ✅). DS tamamen private ✅.
RS-KOŞUL KURALI ♻️: kullanıcı ritüellerinde min-RS koşulu YOK (create-ritual koşul
   enum'undan çıkar) — koşullar: badge · kategori · üni ("sadece üniversitem"/"sadece
   üniversiteliler" — Şerit-B kullanıcıları katılamaz) · kapasite. VENUE SLOTLARINDA
   min-RS + badge + regular-only koşulları VAR — eşleştirme SESSİZ: koşulsuz kullanıcı
   sayı görmez, uygun olmayan slot görünürlükten doğal filtrelenir.
ÜNİ-PROFİLİ: her confirmed üni = topluluk profili; yönetici (founder, devredilebilir):
   vitrin + görünürlük seviyesi (kapalı/dış-üni/herkes) + resmi etkinlik açar —
   öğrenci ritüellerine yetkisi YOK (silme/onay/moderasyon yapamaz).
```

# §15 — NABIZ & BUTON SATIRI 🏗 (UI bileşenleri)

```
NABIZ HALKASI (ritüel kartı): doluluk = RQ yüzdesi (sürekli) · 3 renk bandı ⭐ (~%40/-%70
   eşikleri) · yanında "%85 · 4 kişi" · KELİME YOK. RQ hesabı: 🟢1.0/🟡0.5/🔴0.0
   ritüel-içi ortalama. Bubble halkasıyla aynı gramer, renk kodlaması bağımsız (design).
MEMORY BUTON SATIRI: ▲ 24 · ▼ · [Söz 8] · [Yankı 3]
   ▼ çalışır ama SAYISI RENDER EDİLMEZ · KELİME KARARI (founder): TR = SÖZ + YANKI (kesin) ·
   EN = COMMENT + ECHO ("Say" elendi — buton olarak eğreti) · çekim arşivi = RULO (TR/EN "Roll")
YANKI mekaniği: 24h Pulse'ta yaşar, söner; arşive/passport'a GİRMEZ (PASSPORT-PURE ✅);
   orijinal nesnede sayaç kalıcı; "X yankıladı" sinyali sahibine.
RİTÜEL-İÇİ memory sıralaması: etkileşim karması ⭐ (upvote+söz+yankı) — en canlı önce.
```

# §16 — STRING TABLOSU & i18n ♻️

```
Tüm UI metinleri key'li tablo: {key, EN, TR, route?} — kod placeholder kullanır ✅ (mevcut
   pratiğin doğru). KAVRAM KELİMELERİ ÇEVRİLMEZ: Ritual, Window, Pulse, Local World, Aura,
   Trust, Regular, Takeover — her dilde aynı. **RITUAL İSMİ KESİNLEŞTİ (founder):** kavram
   kelimesi RITUAL kalır (değişmez, çevrilmez); "masa" = SOKAK KELİMESİ — pazarlama/copy/
   boş-ekran katmanında yaşar ("Bu akşam masan var mı?"), UI kavram katmanına girmez.
   Kalan kelime kilitleri 🔓: chip metinleri · rapor kategori dili · onboarding kültür
   satırları.
```

# §17 — TEMİZLİK 🧹

`RS_V31_VS_AKTIF_YAPI_DETAYLI_FARK_ANALIZI.md` SİL (kendi raporunla çelişki kaynağı) · HTML prototip klasörleri (`pulse/`, `yakin/`, `ana-ekran-tasarimlari/`...) → `/design-refs/` altına taşı, build'den çıkar · `PulseLayoutScreen`/`LocalHubScreen`/`*DarkScreen` → tooling olarak işaretle (ürün navigasyonundan çıkar) · davet-kotası kodu varsa kaldır (§1).

# §18 — ⭐ MASTER CONFIG ENVANTERİ (tam liste — hepsi localConfig'de)

```
MEVCUT ✅ (değişmedi): GPS radius 30/50/75-100/15 · kapı %20 clamp(10-60dk) · AIS 1.00/0.85
  dilim %60/%40 · grace 10dk · KİLİT-ANI %25 clamp(15dk-3h) · feedback
  floor 12h · FL [1,4,8] + 12ay tazelik · FB ağırlık 1.0/0.5/0.0 · RS K_UP/K_DOWN 0.15/0.30 ·
  cap +0.12/−0.15 · W 0.25/0.30/0.15/0.05/0.20 · BC/MD/BR · no-show RS+askı · late-cancel ·
  host-ban · DS α0.30, çarpan 0.45-1.20, PD/CtxD/VD 0.60/0.30/0.10 · CONF n=1(%60 nötr)/2/3 · Pulse TTL 24h
DEĞİŞEN ♻️: no_peer.NO_PEER_DAMPENER 0.35 · no_peer.NO_PEER_CEILING 7.5
YENİ 🏗: ritual.MIN_DURATION_MIN:30 🔒 (RESTORASYON — ilk günden karar, config'e hiç girmemiş; create validasyonuna ekle: 30dk altı reddedilir) · keyword.CODE_LEN 3 · keyword.COLLISION_RADIUS_M 500 · keyword.ENTRY_TRIES 3 ·
  keyword.RETRY_WAIT_S 30 · [ESCROW config'leri SİLİNDİ ♻️] · ritual.INSTANT_MAX_LEAD_H:2 ⭐ · ritual.ABSOLUTE_TABLE_CAP:40 🔒 · window.CLOSE_SET:[3,6,12,24] default 12 ⭐ · witness.ACTIVE_SCHEME:LEGACY_2_TIER 🔒 (≤3→1 · ≥4→2 ⭐) · witness.FUTURE_3_TIER_ENABLED:false 🔒 (şema [≤3:1,4-12:2,≥13:3] config-hazır; aktivasyon YALNIZ founder/pivot kararıyla — Cursor kendiliğinden açmaz) · witness.PENDING_GRACE_MIN:10 ⭐ · tag.TTL_S:30 🔒 · presence.TICKET_TTL_MIN:90 ⭐ · event.CODE_BAN_MIN_SIZE:100 ⭐ · video.MAX_S 45 ·
  pulse.FRESH_HOURS 24 (retro filtresi) · regular.{N:4, WINDOW_D:45, DECAY_D:60, VITRIN_DEFAULT:false, COUNTER_UI:true} · mod.{L2A_H:72, L2B_D:7, L2B_FREE_BAN_D:30, L3_RS_BASE:-0.15,
  L3_RS_MAX:-0.30, L3_SUSPEND_D:30, SLA_H:{safety:2, content:12, general:48}, L1_PACKET_MIN} ·
  chip.{SINGLE_SELECT:true, RQ_PER_COLOR:3, P2V_PER_COLOR:5, RITUAL_TOP_MIN_DISTINCT:3, VENUE_TOP_MIN:10, ROTATE:true} · venue.{FREE_SLOTS_MO:1,
  OP_SLOTS:3, HAKIM_SLOTS:5, PRICE_OP:7900, PRICE_HAKIM:19900, SIZE_MULT:0.7🔓,
  ADDON_SLOT:2000, TAKEOVER_FORMULA🔓, TRIGGER:{N_RITUAL, X_CHECKIN, DEAD_DAY_DELTA}} ·
  ven4 K:3 · ven4 HESAP 0-1 UZAYINDA ♻️ (prior_internal:0.50, GÖSTERİM ×10 — Aras: ölçek-birimi fix, Trust VE Aura ikisinde de) · ven4.MIN_DISPLAY_N:5 🔒 ♻️ (founder: vitrin-kalitesi — public sayı 5. gözlemde; öncesi etiket; venue paneli gün-1'den görür) · ven4.MIN_ANSWERS_PER_OBS:2 🏗 (soru tipi başına ayrı — P2V/RQ bağımsız sayım; eşik altı gözlem üretmez, chip kaydedilir) · ven4.REPEAT_RATER_W:[1.0,0.5,0.5,0.25] 🏗 (aynı kullanıcı→aynı mekan 90g'de kaçıncı cevap; gözlem-içi ortalama ağırlıklı — Trust+Aura; MIN_ANSWERS sayımı ham cevapla) · prior geçişi kategori≥35 · pencere 90g · oturmuş n≥10 · tentative <3 ·
  dağılım-gizli <5 · id.{TARGET_S:60, PROVIDERS🔓} · zone.{BADGE_RITUAL_P:3, MARKER_P:1,
  SPARK_ENABLED:false} · search.RANKING_WEIGHTS · notif.PUSH_DEFAULTS🔓 · nabız bantları ·
  memory-sıralama karması · MUSIC_SDK_ENABLED:false
```

# §19 — 🔓 AÇIK MADDELER (bloklamayan — stub kur, bekle)

[1 Ağu: Weather-cancel bu listeden ÇIKTI — karar KAPANDI 🔒 ve build edilir: açık-hava kategorileri (liste config ⭐) + START−3h ⭐ cezasız host-iptali; kanıtsız (beyan); sık-kullanım MOD-desene düşer ⭐. Detay §2H.]
2. Kompakt bant onayı + Takeover fiyat formülü + kilitli-teaser onayı → aynı oturum
3. KYC sağlayıcı seçimi (Techsign/İHS teklifleri — Aras bu hafta) → provider adapter yaz, config'den seçilsin
4. Kalan kelime kilitleri (rapor kategori dili · onboarding satırları)
5. Push default listesi (founder temizliği — launch haftası)
6. Nudity/CSAM tarama sağlayıcısı
7. Paket satış-tetiği eşik değerleri (prova verisiyle)

**Kapanış:** Bu doküman + Sistem Anayasası = tek gerçek. Çelişki görürsen KOD DEĞİL BİZ hatalıyız — founder'a sor, tahmin etme. Sıralama önerisi: §1-§2-§3 (kapı+kod+kamera: launch-kritik üçlü) → §5 (mod-engine) → §8-§6 (venue ekonomi+regular) → §10-§15 (chip+UI) → §12-§13 → stub'lar (§11).


---
# §2C — 27 TEM EK KARARLARI (build listesi)
USERS ♻️: users.username (unique, citext, 3-20, rezerve-liste tablosu) + display_name + name_locked(bool, kimlik-doğrulamada true) · değişim limitleri config: identity.USERNAME_CHANGE_D:90 ⭐ · identity.NAME_CHANGE_D:90 ⭐ · üni-mail kayıtta ad-soyad ön-doldurma (mail local-part parse, düzenlenebilir + beyan checkbox).
AFFILIATIONS 🏗: affiliations{user_id, org_id, type: UNI_AUTO|BRAND_ADMIN} — UNI_AUTO mail-domain'den otomatik; brand tarafı admin-portal ataması. Kurum profil render: "Bağlı Hostlar" (Friends bileşeni KULLANILMAZ).
SERIES ♻️: series{recurrence: WEEKLY|BIWEEKLY, end: N|null} → instance üretimi: yalnız SONRAKİ instance joinable · series_follows tablosu + 🔔 (yeni instance + join-açılışı) · gezen-Series: instance.pin kilide dek editable ⭐ (pin-değişmezlik kuralı instance-kilidiyle başlar).
UFUK ♻️: ritual.PLANNED_MAX_AHEAD_D:21 ⭐ (şahıs tek-seferlik, create validasyonu) · ritual.EVENT_MAX_AHEAD_D:60 ⭐ (VEN_EVENT + brand-imzalı).
FEE 🏗: rituals.fee{amount, currency, note:"yerinde ödenir"} yapılandırılmış (nullable) → kart ₺ rozeti · [ücret sürpriziydi] chip'i feedback setine.
VISIBILITY ♻️: rituals.audience: PUBLIC|FRIENDS ⭐ (FRIENDS=FL'li arkadaşlara keşif).
VEN-EVENT FORMU 🏗: panel BUGÜN sekmesi [Etkinlik kur]: başlık+zaman(60g)+kapasite+(≥12→köşe önerisi) → origin=VEN_EVENT ritüel + imzalı kart + buradasın-push.
HOST PANELİ 🏗: /me/hosted stats (private): doluluk, dönüş oranı, no-show, arşiv; Series kırılımı. VENUE-LEAD RADARI ⭐: aynı custom-pin'e N tekrar → ops-portal lead kaydı (eşik config: leads.REPEAT_PIN_N:3 ⭐).
İÇERİK RIZASI 🏗: memory states: WINDOW_ONLY|LW_OPEN|LOCKED(takedown) · [beni rahatsız ediyor] → LW_OPEN→LOCKED anında + MOD case (öncelikli kuyruk: CONSENT) · quote.owner_kill (tek-tık, tartışmasız) · window-level user-block · opt-in notif flag: notify_when_opened (default false ⭐).
AÇILIŞ ♻️: onboarding tek CTA; venue/brand başvurusu web-form linkleri (app'te kapı yok).
CONFIG EKLERİ §18: identity.USERNAME_CHANGE_D:90 · identity.NAME_CHANGE_D:90 · ritual.PLANNED_MAX_AHEAD_D:21 · ritual.EVENT_MAX_AHEAD_D:60 · leads.REPEAT_PIN_N:3 · notif.OPENED_OPTIN:false · series.FOLLOW_NOTIF:on ⭐.


# §2D — 28 TEM EKONOMİ+CANLI-OKUMA BUILD LİSTESİ
· WALK-IN limit/sayaç kodu SİL ♻️ (origin alanı kalır) · birth_cancel 🏗: Instant + age≤10dk ⭐ (ritual.BIRTH_CANCEL_MIN:10) + seal_count==1(kuran) → hard-delete, log-only · panel [yer veremedik] 🏗: canlı walk-in kartında → aynı sessiz iptal + kurana nötr push · venue_claim 🏗: custom ritüeli mekan panelinden sahiplenme · self_rez v2 ♻️: paket-flag'siz temel, fine_tune paketli · ven_event aylık sayaç config AÇIK ⭐ · CANLI OKUMA: şeffaf window read-only stream + reader_count · canlı masaya dış yazı YOK · LW_OPEN içerikte status'ten bağımsız ▲▼+Söz+Echo; full ritual/window forumu yalnız ENDED+forum_enabled · 3-yüzey navigasyon memory→ritual→whole_window.

# §2E — KATEGORİ + KAPASİTE + CHIP BUILD (28 Tem)
categories tablosu 🏗: {key, label, cap_min, cap_max}; bantlar SOFT, ABSOLUTE_TABLE_CAP:40 🔒, 41+ event_group/venue event; rol-slot Faz-1.5. CHIPS: {key, question, color, label, route}; MAX_CHIP_SELECT:1, RQ_PER_COLOR:3, P2V_PER_COLOR:5; top-chip eşikleri ritüel 3 farklı cevap/venue 10 cevap; skor pipeline'ına girmez.

# §2F — SOLO YÜZEY SİL + NO-PEER + RS TOGGLE
Solo mode/Window/scope yoktur; eski SOLO memory scope migrate edilip silinir. “Solo Ritualist” yalnız `no_peer` algoritmik hattın ürün adıdır. RS: users.rs_visible default false; ≥10 ritüel; monokrom halka/bant, ham sayı yok; toggle 30g; ranking/erişim etkisi sıfır.

# §2G — 30 TEM BUILD LİSTESİ (GPT-denetimi kararları)
· HOST-MANUEL SİL: tek yol PENDING_WITNESS · START−15: kod bu pencereden itibaren doğar, AIS resmî start · ETKİLEŞİM: votes{content_id,user_id,dir} kimlikleri anonim; API iki count'u public döner; mutable tek-yön; self-vote; ▼ push/RS/mod yok; LW_OPEN anında dört fiil · MENTION: aynı ritüel mühürlü, thread katılımcısı, host/organizer, ilgili venue/zone/Series; Friends tek başına yetmez; self-remove ve izin ayarı · COLLABORATOR: yalnız Series/event_group/venue event; operational permissions array, seal/witness/RS/FB/MOD daima false · RS halka min10/30g.

# §2H — 31 TEM SOSYAL-TEMEL BUILD
reactions: emoji enum [🤝,😂,🙌,👀,💡,❓], 1/user/message, mutable · dm Faz-1.5 friends-only · notification-center push/in-app ayrımı + quiet 01-09 + own-ritual override + weekly digest default ON ama kapatılabilir · message edit window 5min · block join'i engellemez; `feedback_eligibility` co-presence/seal anında snapshot olur ve sonraki block ile silinmez; görünürlük yine çift yön kapanır · saves private pointer, rank etkisi 0, source takedown'da preview kapanır · pre-lock edit kuralları · `weather_cancel` 🔒 restore: kategori-listesi config ⭐ + WINDOW: start−3h ⭐ + kanıtsız + MOD-desen sayacı · account-delete consent pipeline · Ghost alanı/route'u yok.

# §DEFTER-KAPANIŞ (1 Ağu)
series_regular ⭐ F1.5: son-8-instance ≥5 mühür → rozet (avantaj 0) + SERIES_REGULAR_ONLY audience ⭐ · ritual_designer flag ⭐ F2 (sicil-eşikli; launch'ta yok) · UNDER_MIN 🔒: seal_count<min → private window/arşiv only; SKOR-İZOLASYONU: RS-pipeline'a girmez, FB soruları hiç açılmaz (RQ/P2V/P2Z), Regular sayacına yazmaz, badge/host-stats/top-chip dışı; LW-kart üretme · seal_count=0 → hard-silinme (iz yok) · witness kademe: FUTURE_3_TIER_ENABLED=false 🔒 — şema config'te uyur [≤3:1,4-12:2,≥13:3]; AKTİF olan LEGACY_2_TIER'dir (aktifleşme yalnız founder/pivot) · K_DOWN band notu: 0.24-0.36.

# §2Ağu-2 — FIND-US + PORTAL BUILD
rituals.find_note 🏗: nullable, ≤60ch ⭐ (config) · pre-lock: yalnız creator düzenler (anons+notify mevcut edit borusundan) · canlı: yalnız sealed günceller (last-write-wins + strip event "find_note_updated by X") · door-close'da readonly · dış-dünya write yok 🔒 · her lokasyon tipinde aynı alan. venue_portals 🏗: {venue_id, portal_id, label:null} — hepsi aynı buradasın-modunu açar (kuyruk-önleme); label yalnız venue.multi_room_flag ⭐ açıksa tanımlanır (panel aracı, paketli); label'lıysa self-rez/ritüel kartına soft-konum yazılır. Free=1 totem, portal-seti paket-flag ⭐.

# §2Ağu-3 — GRAF GÖRÜNÜRLÜĞÜ
users.friends_list_public 🏗 (bool, default false 🔒; owner toggle) · follower/following list endpoint'leri public 🔒 · sayaç render 🔒: profilde yalnız "Takipçiler ›" satırı (SAYISIZ); count yalnız liste sayfası başında · follow akışı ONAYSIZ kalır 🔒 (request-modeli founder teyidine dek KODLANMAZ).

# §2Ağu-4 — KAPALI PROFİL BUILD (CORE)
users.account_privacy: OPEN(default 🔒)|CLOSED · follow_requests 🏗 {from,to,state} (yalnız CLOSED hedefte; ONAY→follow; RET sessiz+bildirimsiz) · profil gating: CLOSED'da detay endpoint'leri follower-onlu; yabancıya minimal-kart DTO · search-visibility eski toggle'ı bu alana MERGE (migration) · MASA MUAF 🔒: ritüel kartı/kadro/join akışları privacy-check'siz · closed_lw_exception=true 🔒 (2 Ağu founder onayı — kapalı hesap tek-tık ŞEHİR'e açabilir) · Your Pulse kaynağı: CLOSED kişinin açtıkları yalnız onaylı takipçi akışına.

# §3Ağu — SON DÖRTLÜ: compact-band configli-kapalı 🔒 · event_general_rq sorusu EVET 🔒 (yalnız sub'lı event FB'sine tek soru; chip=1 aynen) · follower-count yalnız liste-başı 🔒 · ven_event tavanı boş-⭐ aynen.
