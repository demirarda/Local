# LOCAL — SİSTEM ANAYASASI (Algoritmalar & Tüm Eşikler)
**Kime:** Founder + Aras. Yazılımcı için DEĞİL — sistemin sahipleri için: her motorun mantığı, her eşiğin değeri ve NEDENİ, saha kalibresinde neyin nasıl değişeceği.
**⭐ işareti:** saha kalibresi parametresi — launch sonrası gerçek veriyle DEĞİŞEBİLİR. Değişiklik protokolü en sonda (Bölüm 14). ⭐'sız değerler yapısal karardır; değişmesi founder kararı + sistem revizyonu gerektirir.

---

# 1. RS — GÜVENİLİRLİK MOTORU (kişinin içsel skoru)

**Ne ölçer:** "Bu insan sözünün arkasında duruyor mu, masada nasıl biri?" 1.00–10.00 arası, herkes 5.00 başlar. Default gizli.

**Her ritüel sonrası tek bir güncelleme olur. Akış (insan dilinde):**
1. Dört bileşen toplanır → ham performans puanı **P** (0–0.75 arası):
   - **AIS (ağırlık 0.25):** zamanında geldin mi (Bölüm 2)
   - **IQ (0.30):** masadaki ARKADAŞLARIN seni nasıl puanladı (en ağır bileşen — insan tanıklığı)
   - **CF (0.15):** uyum = %65 arkadaşların "grup enerjisini okudu mu" cevabı + %35 kendi "nasıl hissettin" cevabın
   - **MB (0.05):** anı bıraktın mı (memory) — mikro teşvik
2. **P'den sürtünme düşülür:** T = P − 0.20 × IF (IF = geç kalma izi + feedback görevini boş bırakma; Bölüm 4)
3. **T, 0.50 nötr çizgisiyle karşılaştırılır:** üstü kazanç, altı kayıp. **Asimetri:** kazanç katsayısı 0.15, kayıp katsayısı 0.30 — **kötü, iyinin iki katı hızlı işler.** (Güvenin doğası: yavaş kazanılır, hızlı kaybedilir.)
4. Delta üç filtreden geçer: **DS çarpanı** (çeşitlilik — 0.45–1.20 arası; Bölüm 6) → **BC** (tutarlılık trendi: istikrarlıysa ödül büyür ×1.25, iyi geçmişte tek kötü gece sönümlenir ×0.70, kötü trend cezayı büyütür ×1.35) → **MD** (yeni kullanıcı freni: ilk 12 ritüelde delta kademeli kısılır ×0.50→×1.00 — kimse 3 gecede uçamaz/batamaz) → **BR** (uç freni: 8.0 üstünde yükseliş, 3.0 altında düşüş yavaşlar).
5. **Tek-ritüel tavanları:** en fazla +0.12, en fazla −0.15. İstisna: no-show bypass −0.20'ye kadar (Bölüm 7) — "hiç gelmemek, en kötü gelmekten kötü."

**Kanka torpili kapalı:** FL3 (en yakın) arkadaşların puanı 0 ağırlık taşır (Bölüm 5). **Tek rater manipülasyonu kapalı:** 1 kişi puanladıysa cevabı %60 ⭐ nötrle karıştırılır ("bir tanık > hiç tanık": çarpan ×0.40, no-peer dampener'ın hafif üstü), 2 kişi → %25 nötr, 3+ → tam sayılır.

**⭐ RS parametreleri:** K_UP 0.15 / K_DOWN 0.30 · cap +0.12/−0.15 · ağırlıklar 0.25/0.30/0.15/0.05/0.20 · BC çarpanları · MD kademeleri · BR eşikleri (8.0/3.0). *Saha sinyali: 30 günde kitle 5.0±0.5 bandında salınmalı; toplu drift = ağırlık dengesizliği.*

# 2. CHECK-IN & GİRİŞ KAPISI (late-registration kuralları dahil)

**Üçlü kilit:** register (kayıtlıysan) + GPS (radius ⭐: Free 30m / Venue 50m / Zone 75-100m / hareketli 15m) + kod. Arıza günü: PENDING_WITNESS (host manuel onayı YOK ♻️ — 30 Tem: host kimseyi mühürleyemez).

**GPS ÇAPA KURALI (founder netleştirmesi):** radius'un merkezi her zaman "ritüel açılırken girilen exact location" — kaynağı tipe göre: Custom = host'un bastığı pin · Venue = MEKANIN doğrulanmış pini (onboarding'de içeriden mühürlenen; host oynatamaz) · Zone = marker koordinatı (geniş zone'da centroid) · Hareketli = start point, sonra yürüyen 15m. GPS kaba kilittir, kod keskin kilittir — radius cömert kalır, sahtekârı kod yakalar.

**MIN RİTÜEL SÜRESİ: 30 dk 🔒** (ilk günden kilitli — restorasyon: yazıya hiç geçmemişti; kapı/kilit clamp tabanları [10dk/15dk] bu tabana göre tasarlandı, 30dk masada bile sistem tam çalışır — test edildi).

**İKİ KAPI KURALI (check-in masası finali):** "Söz kilitte donar, masa kapıda mühürlenir."
KİLİT (start−%25, clamp 15dk-3h) = SÖZ KİLİDİ → yalnız AYRILIŞI dondurur (late-cancel burada başlar) + MASA KONUŞMASINI AÇAR. Alımla ilgisi YOK.
KAPI (start sonrası %20, clamp 10-60dk) = check-in penceresi + ALIM KAPANIŞI → JOIN kapı kapanana dek AÇIK (kapasite içinde); kilit-sonrası join = ANINDA SÖZ (grace yok — cezasız-çıkış planlamacının hakkıydı). Host isterse create'te [Sadece planlayanlar] ⭐ toggle'ı ile alımı kilitte kapatır. Kilit-sonrası join'de exact-pin ANINDA açılır.
CHECK-IN EKRANI start−15dk ⭐ açılır (GPS ön-doğrulama + sayaç). Kapı gösterimi HER ZAMAN mutlak saat+sayaç ("21:24'te kapanır · 18dk") — kullanıcıya asla formül gösterilmez.

**PRELOBBY GÖRÜNÜRLÜĞÜ (dış/iç katman):** Dış katman (join etmemiş herkes): host kimliği + doluluk sayısı "4/6" + nabız + tanım + mekan/zone + KİLİT-ANI sayacı — KATILIMCI LİSTESİ YOK (konum-deseni koruması; kişiler ritüele gelir, kişilere değil). Tek istisna: FL-arkadaş sinyali ("2 arkadaşın katılıyor", isimli — arkadaş zaten senin grafiğin). İç katman (join sonrası): tam liste + grace sonrası exact-detay. KONUŞMA KURALI: masa konuşması KİLİTTE açılır (kadro sabitlenince — "söz kilitlendi = konuşma açıldı"); kilit öncesi tek istisna HOST ANONSU (tek yönlü duyuru: "otopark tarifi").

## 2.2 NABIZ + DETAYLI RİTÜEL GÖRÜNÜMÜ
```
NABIZ = ritüelin canlılık halkası; tek halka, üç hayat evresinde üç anlam:
  PRELOBBY: doluluk (4/6 → %67) · LIVE: canlılık (check-in oranı + memory/quote tempo
  karması ⭐) · ARŞİV: RQ sonucu. Renk bantları (~%40/%70 ⭐) hep aynı gramer; kelime yok.
DETAY SAYFASI (dış katman): tanım + kategori + tip rozeti (Anlık/Planlı/Seri + "⚡ SPARK'tan
  doğdu" etiketi) · zaman + KİLİT-ANI sayacı · yer (venue mini-kart / zone kartı / custom
  BÖLGE — exact pin join+grace sonrası) · host: isim+🎓+"X. ritüelini açıyor"+highlight
  badge'ler (P2H SAYISI GÖSTERİLMEZ — host itibarı vitrine sayıyla çıkmaz) · doluluk+nabız ·
  koşul etiketi · FL-arkadaş sinyali · [Katıl].
SERİ ŞERİDİ (Series detayında): "Perşembe Kahvesi · 7. hafta" + geçmiş instance listesi —
  her biri kendi ARŞİV sayfasına link (memories/quotes, paylaşım scope'una tabi). Yeni gelen
  "bu masa 6 haftadır nasıl yaşanıyor" kanıtını görür. Hostun BAŞKA ritüellerinin içeriği
  burada YAŞAMAZ (o passport/venue arşivinin işi — ritüel sayfası ritüelin hikayesidir).
ARŞİV DETAYI: nabız arşiv-modu (RQ) + memories duvarı (scope'lu) + quotes + retro "ek
  memory"ler + open-forum ise yaşayan forum şeridi.
```

## 2.1 KEYWORD — FİNAL MODEL v2 ("Founder'ın Son Krizi" — İKİNCİ ve KESİN karar)
```
FOUNDER FİNAL KARARI: keyword = 3 HANELİ SAYISAL KOD (kelime-havuz modeli denendi,
  masada elendi — founder tercihi: kod; evrensel, dil-bağımsız, üretim/kürasyon yükü sıfır).
ÜRETİM — MÜHÜR OMURGASI (CHECK-IN FİNAL — tam spec: LOCAL_CheckIn_Sistemi.md):
[CHECK-IN] → ① CANLI GPS (atlanamaz; 🟢 geç · 🔴 uzak=kapı kapalı+pusula · ⚠️ konum-yok/kirli=② açılır ama PENDING'e düşer) → ② ANAHTAR — KÜLTÜR HİYERARŞİSİ 🔒: 🗣 kod söyle · 👀 kod göster (mühürlü ekranda kalıcı) · 📱 LOCAL-TAG (mühürlüden 30sn tek-kullanım tag) = ANA KÜLTÜR; 🔵 totem/marker-değdir = kısayol; dijital YOLLAMA yasak → ③ MÜHÜR → gelenler şeridi → AIS deneme anından.
İLK GELEN AÇAR 🔒 (host imtiyazsız/yüksüz): GPS🟢+kod-yok → "MASAYI SEN AÇIYORSUN"+konum notu ⭐ → mühür = KOD+WINDOW doğumu + "Masa açıldı 🟢" anonsu (push+prelobby kartı+venue sinyali). Host geç = normal AIS, koddan girer. Race: tek kod, host tie-break, ilk-yazan. İlk-mühür denemesi PENDING'e düşerse kod/window DOĞMAZ — masa açılmamış sayılır, sonraki 🟢 gelen açar.
PENDING_WITNESS: kod✓+(T1 arıza|T2 kirli-sinyal|T3 sınır-deseni ⭐) → şeritte tanıklık tek-tık → eşik mühürlü-oranlı ⭐ (≤3→1, ≥4→2; pending anında kilitlenir) → onay=mühür, AIS DENEME ANINDAN. GRACE ⭐: deneme kapı-içiyse onay kapı+10dk'ya dek basar. Onaysız+kapı=mühür yok ama otomatik no-show İŞLEMEZ → MOD dosyası. TANIK=masadaki herhangi MÜHÜRLÜ (host dahil); VENUE PERSONELİ TANIK DEĞİL 🔒 (main-mühür basması teknik açılıştır).
ÇAKIŞMA KORUMASI: aktif + yakın (yarıçap ⭐ 500m) ritüeller aynı kodu ALAMAZ (kampüs kuralı).
GÖSTERİM: kod ekranda dev punto — yazı-okunuş satırı YOK (founder: gereksiz; insan zaten
  rakam rakam söyler). GİRİŞ: 3 deneme ⭐ → 30sn bekleme ⭐ (brute-force freni).
GAMING CASE (Arda sorusu — karar): "radius içindeki kayıtlı trole kod telefonla söylenir"
  saldırısına karşı KİŞİYE-ÖZEL KOD RED (sızdıran suç ortağı kişisel kodu da okur — saldırıyı
  çözmez; relay kültürünü öldürür + host'a kod-listesi UX çöplüğü) · MASA-QR-CHECK-IN RED
  (statik QR fotoğraflanıp iletilir — sözlü koddan zayıf; QR'ın rolü sabit: ritüel-sayfa
  linki). Gerçek savunma 3 katman: kazanç zaten minimal (CONF+FL+DS kanka ekosunu
  fiyatlamış durumda) + sosyal iz (masadakiler görür → rapor + HOST-WITNESS) + YENİ:
  CHECK-IN GPS MESAFESİ LOGLANIR ⭐ — "hep radius sınırında check-in, hiç memory yok"
  deseni MOD korelasyon sinyali. Artık-risk kabul edilmiş ve fiyatlanmıştır.
LOKASYON ÇAPALARI: custom=host pini 30m · venue=mekanın mühürlü pini 50m · zone=marker 75-100m · tarifeli(vapur)=iskele→gemi, kapı=min(formül, kalkış+5dk) ⭐ · hareketli=açanın canlı konumu 15m (çapa ölürse sıradaki mühürlüye devrolur ⭐). EVENT: join=event'e TEK SÖZ → MAIN mühür kapıda (AIS; ≥100 kişide kod YASAK — totem noktaları) → SUB mühür masada (feedback o masaya; totemsizse sub-KOD, köşenin ilk oturanı açar). Masa geçişi söz değil; FB hakları=mühür logu KESİŞMESİ (aynı sub'da kesişenler masadaş; süre yalnız liste sırası); RQ son-sub + "gece geneli" ⭐; P2V main'den herkes. WALK-IN: origin=WALK_IN, %100 venue ritüeli (Trust/Aura/rapor/Regular sayılır), slot hakkı yemez, TAVAN YOK 🔒 ♻️M1 (sınırsız — fren: fizik + mekan iradesi; mekanın kabul ettiği hiçbir masa raf hakkı yemez). TOTEM 3-HAL 🔒: sözü var→direkt kapı ekranı · kayıtlı-sözsüz→buradasın-modu (90dk bilet ⭐, salt UX, yetki sıfır) · app'siz→web-vitrin. INSTANT=start≤+2h ⭐ · custom tek-masa: KATEGORİ-ÖNERİSİ (soft) ⭐ · mutlak 40 🔒 ♻️v3 — bkz E2.7.
YAYILIM: FİZİKSEL RELAY — app'te sadece check-in'lilere görünür; geç gelen masadan alır.
İSTİSNASIZ: her ritüelde. [ESCROW/EMANET ANAHTAR ÖLDÜ — ilk-gelen-açar kuralı gereksizleştirdi. SÖZ EKONOMİSİ (K-seti): K1 çakışma yasağı 🔒 (taahhütler zaman-çakışamaz; event=tek söz; masa geçişi/tanıklık söz değil) · K2 buffer 0dk ⭐(0-30) · K3 günlük söz tavanı 4 ⭐(3-6) — yalnız İLERİ-TARİHLİ sayar, ≤30dk join+Instant-kurma MUAF ⭐, leave iadeli · K4 aynı ritüele günde 1 join ⭐, günlük leave MOD-eşiği 6 ⭐]
  ilk talep eden açar; host'a no-show; radius boşsa kapı sonunda ritüel düşer (katılımcı cezasız).
CUSTOM/SABİT KOD YOK — hiçbir hesap için (VIP istisnası = tek-kuyruk ihlali; sabit kod =
  ölü kilit: bir öğrenen sonsuza dek bilir). ARIZA: PENDING_WITNESS — host manuel onayı KALDIRILDI ♻️ (host yalnız sıradan mühürlü tanıktır; ekstra doğrulama gücü yok).
ARŞİV NOTU: v1 kelime-havuz tasarımı (kategori havuzları + kürasyon kuralları) rafta —
  saha "kod soğuk geldi" derse tek config'le kelimeye dönülebilir; iki model de tasarlanmış durumda.
```

**Giriş kapısı — geç kalma kuralları:**
```
kapı = duration'ın %20'si, ama en az 10 dk, en fazla 60 dk ⭐
   kapının ilk %60'ında geldin → AIS 1.00 (tam)
   son %40'ında geldin        → AIS 0.85 (hafif iz)
   kapı kapandı               → GİREMEZSİN = no-show
Örnekler: 30dk ritüel → 10dk kapı (0-6dk tam / 6-10 hafif)
          2 saat → 24dk kapı · 4 saat → 48dk · 5 saat+ → hep 60dk
```
Mantık: 24 saatlik ritüelde bile randevu randevudur — 3. saatte gelen "katılmış" sayılmaz.

**Late-REGISTRATION (ritüel başladıktan sonra kayıt):** Ritüel canlıyken kapasite boşsa join hâlâ mümkün — ama check-in için kapı kuralı aynen işler: kapı kapandıysa join etsen de giremezsin (sistem join'i kapı kapanınca kilitler). SPARK/açık-kapasite ritüellerde "katıl" kartı kapı açık olduğu sürece görünür.

# 3. KİLİT-ANI & İPTAL MERDİVENİ

```
KİLİT-ANI = başlangıçtan geriye duration'ın %25'i (en az 15dk, en fazla 3 saat) ⭐
   Prelobby'de görünür: "Alımlar 13:00'te kilitlenir"
Merdiven (hafif→ağır):
   kilitten ÖNCE çık            → serbest, hiçbir şey
   kilitten SONRA çık + yerine birini bul → ceza yok
   kilitten sonra, yerine kimse yok → LATE-CANCEL: 1.uyarı · 2.−0.06 · 3.−0.10 · 4+.−0.15 (askı yok)
   hiç gelmemek → NO-SHOW (Bölüm 7)
   gelip yarıda bırakmak → sistem TESPİT EDEMEZ (GPS izlemiyoruz — bilinçli);
      ceza organik doğar: masa düşük puan basar + boş feedback görevi IF cezası
      işler + izi cılız kalır. Panel üzerinden ayrılan: o ritüelde FB veremez, alır.
Join sonrası ~10dk grace ⭐: yanlış-tık cezasız çıkış (exact detaylar da bu grace
   bitmeden açılmaz — bilgi sızıntısı koruması; re-join'de grace yenilenmez)
```

# 4. IF — SÜRTÜNME (küçük ama önemli)

IF = geç kalma izi (kapının 2. dilimi → 0.25) + **feedback görevini boş bırakma** (~0.30 ⭐). Feedback görevi SADECE puanlayabileceğin (FL1/FL2) arkadaşın o ritüelde varsa doğar — no-peer/salt-FL3 masada görev yok, ceza da yok. T'den 0.20×IF düşer. *Erken kaçanın AIS bedavasını geri ödeten mekanizma budur.*

# 5. ARKADAŞLIK & FL & FEEDBACK

- Arkadaşlık = karşılıklı istek+kabul, SADECE aynı ritüelde bulunmuşlar arasında (QR-BUMP = kısayol, kural aynı). Feedback SADECE arkadaşlar arası.
- **FL seviyeleri feedback SAYISIYLA derinleşir** (beraber ritüelle değil): FL1 = 1-3 fb · FL2 = 4-7 · FL3 = 8+ ⭐. Tazelik 12 ay ⭐.
- **Feedback ağırlıkları: FL1 tam (1.0) · FL2 yarım (0.5) · FL3 SIFIR.** En yakının övgüsü sisteme veri değildir — kanka çemberi RS şişiremez.
- Feedback soruları: RQ (ritüele, herkes) · Q1 comfort + Q2 energy-fit (kişiye, arkadaşlar) · aynı ikili host'a · R1 (kendine) · P2V (mekana). Hepsi 🟢🟡🔴 (1.0/0.5/0.0) + opsiyonel neden-chip'i.
- Feedback penceresi: ritüel bitince açılır → window kapanışı VEYA +12 saat ⭐ (hangisi geçse).

## 5.5 GÖRSEL KAYNAK KURALI (memory'nin anayasası — "anti-fake"in teknik hali)
```
DOĞUM: LOCAL'de bir görüntü ANCAK bir window'un içinden doğabilir — IN-APP KAMERA
  ONLY. Galeri kapısı YOK (window'da hiç render edilmez), FİLTRE YOK (flaş/gece
  modu gibi çekim gereklilikleri hariç — ışık evet, makyaj hayır).
DAMGA: her çekim anında mühürlenir: ritüel + tarih + konum. Damga silinemez.
AKIŞ (Snap hızı): çek → [Paylaş şimdi] / [Ruloya kaydet] / [Sil]
PAYLAŞIM EKRANI — "DARDAN GENELE": [Window] → [+ Your Pulse] → [+ Local World].
  Window ritüelin iç katmanıdır; kişisel/Solo yüzey değildir. Hepsi damgalı, hepsi arşive düşer.
TASLAK: sadece foto/video için (quote/playlist taslağı YOK — an geçtiyse geçti).
  Taslaklar RULO'da (ad KESİN — 5.7) sadece sahibine görünür;
  yayınlanmışla karışmaz. TASLAK ASLA ÖLMEZ.
RETRO YAYIN: taslak istenen zaman yayınlanabilir — HER ZAMAN orijinal gece
  damgasıyla (büyük çekim damgası + küçük yayın tarihi; yalan throwback imkansız).
  Retro yayın PULSE'A DÜŞMEZ (Pulse = yalnız taze, şehrin CANLI nabzı) — arşive,
  duvara ve RİTÜELİN FORMUNA "ek memory" olarak işlenir (geçmiş ritüelin arşivi
  sessizce zenginleşir; profiline giren görür, şehre duyurulmaz).
PROFİL ARŞİV MİMARİSİ (4 sekme): QUOTE · BADGE · MEMORIES (yayınlananlar) ·
  RULO (tüm çekimler + taslaklar). Memories duvarına yükleme AKIŞI YOKTUR —
  duvar, yayınlanmış memory'lerin otomatik toplamıdır; LOCAL-öncesi hiçbir kare
  hiçbir yolla giremez.
AVATAR: kimliktir, iz değildir — galeriden serbest (canlı-avatar opsiyonu park ⭐).
YORUMLAR: YAZIDIR — foto/GIF/galeri eklentisi yok; görsel konuşmak isteyen
  memory'sini yayınlar/yankılar.
VİDEO: aynı kural — in-app, süre limiti ⭐ (30-60sn bandı), filtresiz.
MÜZİK: link-out modeli v1 (metadata+kapak+derin-link; ses bizden akmaz → lisans
  yükü sıfır) · v1.5: kullanıcının kendi Premium'u üzerinden SDK ile window-içi
  çalma ⭐ (Aras Görev 3 incelemesi) · kendi çalarımız = Music hattı, Yıl 1+ park.
```

## 5.7 İSİM KARARLARI (founder finalleri — string tablosunun kilitli çekirdeği)
```
RITUAL: KESİN — kavram kelimesi kalır (çevrilmez, her dilde aynı). İlk günden gelen
  şüphe kapandı; gerekçe: niyet+tekrar+ciddiyet'i taşıyan tek aday ("buluşmaya söz
  verilmez, ritüele verilir"); hafif tuhaflık = öğrenilen kelime = sahiplenilen kelime.
  ÇİFT KATMAN: "masa" = sokak kelimesi — pazarlama/copy/boş-ekran dilinde yaşar
  ("Bu akşam masan var mı?", "masaya dön") — kavramı ısıtır, kavramla yarışmaz.
ZAMAN TİPLERİ: INSTANT (Anlık) · PLANNED (Planlı) · SERIES (Seri — "recurring" öldü,
  UI'da asla görünmez). SPARK = tip değil DOĞUM ETİKETİ (zone-tanışmasından doğan
  Instant; kartta "⚡ SPARK'tan doğdu").
BUTONLAR: TR = SÖZ (yorum) + YANKI (repost) · EN = COMMENT + ECHO ("Say" elendi:
  buton olarak eğreti; Echo founder-onaylı ve sevildi) · çekim arşivi = RULO (EN: Roll).
  ⭐ FOUNDER ŞÜPHE İŞARETİ: Söz ve Comment'te founder hâlâ tam emin değil — prova
  döneminde founder-host canlı tepkisiyle son test; string tablosunda tek satır, sıfır kod.
"EFEMERİT" ÖLDÜ (founder kararı): window-sonrası ayarı kullanıcıya KAVRAM olarak değil
  SORU olarak sorulur — "Masa bitince tartışma devam etsin mi?" [Hayır — izler kalır,
  defter kapanır] / [Evet — forum açık kalır]. Enum kodda aynı kalır (sıfır refactor);
  "Efemerit" kelimesi hiçbir kullanıcı yüzeyinde yaşamaz. Konuşma dili: "kapalı-defter
  masası" / "forumlu masa".
KEYWORD → KOD: 3 haneli sayısal (bkz. 2.1 v2) — "saçma kelime riski ciddiyet kapısında
  piyango oynatır" (founder); kod her dilde nötr, kürasyonsuz, global-hazır.
KALAN KELİME İŞLERİ (Aras/founder oturumu): chip metinleri · rapor kategori dili ·
  onboarding kültür satırları.
```

# 5.8 FOLLOW KATMANI (arkadaş-olmayan ilişkinin değeri)
```
FRIEND = yaşanmış masa (feedback hakkı + FL + iç sinyaller — kazanılır, istenmez).
FOLLOW = ilgi (tek yönlü, serbest, onaysız — herkes zaten kimlikli).
FOLLOW NE VERİR: (1) PULSE ERİŞİMİ — "+Your Pulse" memory'leri arkadaş + TAKİPÇİYE
  görünür (24h; follow'un eti bu) · (2) RİTÜEL SİNYALİ — YÜZEYDE yaşar (feed'de görürsün),
  PUSH ETMEZ (founder: "otomatik zil yorar"). Push yalnız: kişi-zili 🔔 bilinçli opt-in
  VEYA RARE-HOST istisnası — takip ettiğin kişi uzun süredir (60g ⭐) ritüel açmamışken
  açarsa tek push ("uzun aradan sonra masa açtı" — nadir olay = değerli haber, sık olay =
  gürültü) · (3) passport public katmanı + quote arşivi.
FOLLOW NE VERMEZ: feedback hakkı (asla) · iç-katman · FL-"katılıyor" istisnası ·
  RS/DS görünümü. Follower listesi yönetilir (remove/block). Takipçi sayısı hiçbir algoritmaya/kapıya girmez.
FELSEFE: friend kazanılır, follow verilir — ara ASLA bulanmaz.
```

## 5.9 KALE MEKANİZMASI (mekan hedef-kitle eşleşmesi — üni/Erasmus kaleleri)
```
Kale BEYAN edilmez, YAŞANIR: (1) SLOT KİTLE ETİKETİ — slot açarken opsiyonel DAVET
  etiketi ("🎓 üni-dostu" / "🌍 international") — koşul değil, dışlamaz, çağırır;
  keşifte hedef kitleye işaretli görünür. Koşullu versiyon ayrı (sadece-üniversiteliler
  slotu). (2) Aura dağılımı kaleyi kanıtlar (tandem %38...). (3) Gece Raporu/Aylık
  Nabız'a AGGREGATE kitle satırı: "%64 üni-etiketli, %22 international" (kimliksiz,
  VEN-5 uyumlu) — mekan kaleleşme ilerlemesini sayıyla görür. (4) VEN-EVENT ile mekan
  kimliğini kendi inşa eder. Launch kısa devresi: founder-host'lar hedef ritüelleri
  bilerek taşır → 3 haftada dağılım → gölge-veri kartı: "zaten kalesin, işte kanıtı."
```

## 5.10 ZONE-EVENT (LOCAL'in çoklu-masa etkinlikleri — Emirgan modeli)
```
YAPI: her masa = AYRI RİTÜEL ("101 Masası #3", "Monopoly #1"...) + tek event_group_id →
  keşifte TEK ŞEMSİYE KART ("LOCAL @ Emirgan Sahili · Pazar 15:00 · 8 masa · 22/32") →
  karta dokun → masa listesi → masanı seç, join.
NEDEN masa=ritüel: feedback masa-bazlı (101'in RQ'su Monopoly'ye karışmaz) + her masa
  zone-Aura'ya AYRI gözlem (8 masa = 8 gözlem) + kod sistemi doğal işler.
GİRİŞ: GPS çapası = MARKER (zone radius) + her masanın KENDİ 3 haneli kodu (500m çakışma
  koruması bu case'in sigortası) + masada fiziksel MASA KARTI: numara + QR → o masanın
  ritüel sayfası (yoldan geçen okutur → join → oturur → kodu masadan alır).
DROP-IN: masalar Instant-mantıklı (alımlar kapı sonuna dek açık); dolu masa diğerlerini önerir.
HOST: 2-3 yüzer founder-host yeter (masa-sabit host şart değil; emanet anahtar sigorta).
FİZİKSEL: masa+sandalye+marker kurulumu = belediye/sahil izin dosyası (Local Tree
  çevre-gençlik çerçevesi). Zone-Event = launch döneminin ritüel fabrikası + zone-Aura
  hızlandırıcısı + içerik bankası sahnesi.
```

## 5.11 GECE RAPORU v2 & VENUE PANELİ
```
GECE RAPORU = mekanın GECE RİTÜELİ (push değil alışkanlık): gün kapanışı (mekanın
  kapanış saati + 30dk ⭐) tek digest — GÜNÜN AURASI (o günün RQ ortalaması, tek halka)
  + gün içi her ritüelin satırı (nabız + doluluk + memory/quote sayısı + chip'leri)
  + 🟢🟡🔴 toplamı + en-çok chip + dikkat-chip'i + check-in toplamı + YENİ-vs-DÖNEN
  oranı + regular hareketi + kitle aggregate'i (%üni / %international — kimliksiz).
  Ritüel biter bitmez mini sinyal düşer ("raporda seni bekliyor"); asıl sahne gece.
  SATIŞ CÜMLESİ: "Kasan sana ciroyu söyler; LOCAL sana GECEYİ söyler." — dünyada hiçbir
  platform mekana 'içinde ne yaşandı'yı veremez; veri yalnız bizde doğar.
VENUE PANELİ (VAPP-UNIFIED sekmeleri): GECE (rapor digest) · BUGÜN (canlı ritüeller +
  sıradaki slotlar + VEN-EVENT ilk-mühür [personel] + walk-in rozetli masalar + self-rez onay kuyruğu ⭐ + cevapsız-istek sayacı ⭐) · İTİBAR (Trust/Aura + chip kırılımı + dağılım +
  kilitli Pazar-Payı teaser + regular sayısı) · SLOT&TAKVİM (slot aç + kitle etiketi +
  öneri kutusu) · İŞLETME (paket/ayar). Panel dili: sayı az, halka çok — venue paneli de
  LOCAL estetiğinde yaşar (vitrin-panel değil, gece defteri).
```

## 5.12 WEB-VİTRİN (✓ onaylı) & WINDOW VISIBILITY
```
WEB-VİTRİN: Local World-scope içerik login'siz webde SALT-OKUNUR — kapsam: Open-Forum
  thread'leri + LW-memory/quote'lar + venue/zone/brand profilleri + "Local World Pulse"
  (LW-scope taze akış ana sayfası). ASLA: kişi passport'ları · Your-Pulse/Solo ·
  iç katmanlar. Etkileşim SIFIR — tek CTA: "söz söylemek için gerçek ol → indir".
  OG-kartlı linkler (LOCAL-imzalı, damgalı) + venue SEO. İnşa şimdi (flag'li),
  açılış prova sonrası.
KİŞİ GÖRÜNÜRLÜĞÜ — OPT-IN (founder kararı): default web'de İSİM KAPALI — LW içeriği
  vitrine düşer ama yazar rumuzlanır ("bir LOCAL üyesi · Beşiktaş"). "Web'de ismimle
  görüneyim" ayarını AÇAN ismiyle çıkar (internette adı çıkmayı seçen insan gibi).
  App içinde isimler her zaman görünür — rumuz yalnız login'siz web katmanında.
WINDOW VISIBILITY (create-ritual 7. boyut, host seçer):
  ŞEFFAF: window akışı (sözler/thought'lar) ritüel detayında ŞEHRE okunur.
  KAPALI (DEFAULT ⭐): akış dışarıdan okunmaz; dışarıya yalnız kişilerin bilerek
  LW'ye açtığı memory'ler düşer (dardan-genele kişi kararı window ayarını EZER).
  İlke: "Masa kayda alınmaz; kayıt isteyen masa açar." Open-Forum'la bağımsız iki ayar
  (forum = sonrası kalıcı; şeffaflık = içi okunur); Open-Forum'da UI şeffaflık önerir.
MUTLAK KURAL: exact katılımcı LİSTESİ hiçbir ayarda/katmanda dışarı açılmaz — liste
  yalnız katılanlara (arşivde de). Şeffaflık masanın SÖZÜNÜ açar, masadakileri asla.
  Dış görünüm her senaryoda: künye+host+nabız+katılımcı SAYISI (+ açılmış izler).
  Web'de ritüel: LW-izi kadar vardır; izi yoksa web'de hiç görünmez.
```

## 5.13 ŞEHİR MİMARİSİ (çok-şehir kuralları — Milano/Londra hazırlığı)
```
LAUNCH: şehir SEÇİMİ yok (tek şehir), şehir KİLİDİ var — city_id her ritüel/venue/
  zone/memory'de gün-1'den (konumdan otomatik). Mimari şehirli doğar, UI sonra açılır.
DÖRT KATMAN DÖRT KURAL:
  FİZİKSEL (harita·keşif·city-akışı·slot) → ŞEHİR-KİLİTLİ: aktif şehrin neyse o.
    Eylem üretmeyen içerik gürültüdür; dağınıklık cold-start zehridir.
  SOSYAL (arkadaş/takip Pulse'ı·passport·follow) → ŞEHİR-ÜSTÜ: arkadaşın Milano
    masası Pulse'ında görünür — sosyal graf şehir tanımaz (yeni şehrin en organik reklamı).
  OKUMA (forum arşivi·web-vitrin·venue/zone/brand profilleri) → SERBEST: her şehirden okunur.
  EYLEM (join·check-in) → YEREL — ama şehirler-arası PLANLI join MEŞRU ("haftaya
    Milano'dayım": Planned ritüele uzaktan join; söz sözdür, coğrafya bahane değil).
GEZGİN MODU: aktif şehir manuel değiştirilebilir ("Milano'ya bak") — keşif o şehre
  döner; seyahat aracı.
ŞEHİR DURUMU: ACTIVE / COMING — açılmamış şehirde: "LOCAL henüz şehrinde değil —
  founder'ı ol · vitrini oku · haber-ver listesi" (talep haritası = sonraki şehir
  kararının verisi ⭐).
```

# 6. DS — ÇEŞİTLİLİK (tamamen private)

Son 5 ritüelin insan/bağlam/mekan çeşitliliği → 0-1 arası bir "keşif nabzı" (EMA ile yumuşatılır, alpha 0.30 ⭐). RS'e çarpan olarak girer: 0.45–1.20 ⭐. Hep aynı çevre = kazançlar kısılır (ceza değil, dürüst ölçüm); yeni insanlar = küçük bonus. FL3'ler çeşitlilik saymaz (kişi-ağırlığı = YALNIZ FL ⭐: 1.00/0.85/0.55/0.20 — Regular-ağırlığı KALDIRILDI: mekan tekrarı zaten VD/CtxD kanalında, çifte sayım olmaz; tanımadığın regular = tam puanlı yeni insan). Kullanıcıya radar/tier olarak görünür (Homebody→Voyager, eşikler ⭐) — sadece kendine.

# 7. CEZALAR — NO-SHOW & HOST & ASKI

```
NO-SHOW (haber vermeden gelmemek):
   RS: 1. −0.08 · 2. −0.15 · 3+. −0.20  (30 gün pencere)
   Askı: 3.'ten itibaren 3h → 6h → 12h → 24h ⭐ (askı = ritüel açamaz/katılamaz/iz bırakamaz)
HOST NO-SHOW: RS aynı + HOST-BAN (ritüel AÇAMAZ, katılabilir): 1. uyarı+3h · 2. 24h · 3. 48h · 4+. 1 hafta ⭐
   Host çökerse katılımcılar cezasız.
Mantık: RS cezaları hafif ve tavanlı — asıl caydırıcı ASKI (iz bırakamamak).
```

# 8. SOLO RITUALIST / NO-PEER PATH (arkadaşsız kullanıcı — algoritmik yol)

Rater'ı olmayan ritüelde (hiç arkadaş yok VEYA masada sadece FL3): ölçülemeyen bileşenler (IQ, CF-peer) nota 0 yazılmaz, MASADAN KALKAR; kalanlar (AIS + yarı-ağırlıklı R1 + MB) kendi içinde yeniden ölçeklenir. Üç fren:
- **Pozitif kazanç ×0.35** ⭐ (arkadaşsız güven inşa edilir ama ~3 kat yavaş; ceza TAM işler)
- **NO-PEER ENGAGEMENT:** pozitif delta için en az bir iz şart (R1 veya memory) — check-in'le kaçan turist sıfır kazanır.
- **NO-PEER TAVAN: peer feedback'siz RS 7.5'i geçemez** ⭐ ("zirve kefil ister"); tavanda pozitif işlemez, negatif işler; ilk gerçek arkadaş-feedback'iyle tavan kalkar.
- Bu bir Solo modu, Solo Window, scope veya ritüel tipi değildir. Normal min-3 ritüelde uygun peer rater bulunmamasının ölçüm yoludur; kod/config adı yalnız `no_peer` olur.

# 9. MODERASYON — L MERDİVENİ & MOD-BYPASS

**Demir kural: ham rapor kimsenin RS'ine DOKUNMAZ.** RS'e giden tek yol = moderasyonun onayladığı ihlal (MOD-BYPASS). Rapor-bombing yapısal olarak ölü.

```
L0  içerik aksiyonu (memory kaldır, profil düzelt) — kişiye ceza yok, sicile not
L1  resmi uyarı (nötr dil, sicil sayacı başlar) — tek moderatör, paket eşiği geçerse
L2a 72 saat ritüel açamama ("mola")
L2b 30 günde tekrar → 7 gün açamama + 30 gün Free-location yasağı ⭐
     (riskli kişi en korumasız ortamdan uzaklaşır, venue/zone'da kalır)
L3  RS cezası −0.15 baz, −0.30'a kadar bant ⭐ + 30 gün tam askı — İKİ bağımsız
     moderatör + founder onayı
L4  kalıcı ban (+ gerekirse yasal bildirim) — çocuk istismarı/cinsel saldırı gibi
     extreme vakalar L3'e uğramaz, DOĞRUDAN L4 + yasal süreç
Her kademede itiraz (kararı vermeyen göz bakar) · TEK kuyruk (ünlü/marka ayrıcalığı yok)
· askıda badge kazanımı durur, kazanılmış silinmez · kasıtlı asılsız raporcu kendisi L1-L2 yer
```
**Karar hammaddesi (insan inisiyatifi minimum):** korelasyon puanı (aynı ritüelden 2. rapor, sessiz-çıkışlar, hedefin sicili, raporcu-güvenilirliği — otomatik) + AI ön-önerisi (asla otonom L3+) + HOST-WITNESS mikro-anketi. **Playbook Aras'ın masası** — kategori tanımları, örnek vakalar, SLA'lar (⭐: güvenlik <2h · içerik <12h · genel <48h).

# 10. VENUE MOTORU — TRUST & AURA

```
İki soru → iki skor: P2V ("mekan nasıldı") → TRUST · RQ ("ritüel nasıldı") → AURA
Birim = RİTÜEL (30 kişilik tek gece ≠ 30 kanıt): önce ritüel-içi ortalama, sonra ritüeller
GÖSTERİM TABANLARI: public sayı 5. gözlemde açılır 🔒 ♻️ (MIN_DISPLAY_N=5, founder-onaylı — düşük örneklem mekanı damgalamasın; öncesi yalnız "YENİ/oturuyor" rozeti; mekan kendi panelinde gün-1'den görür) · gözlem sayımı için soru-tipi başına min 2 cevap (1 P2V + 4 RQ → Aura yazar, Trust yazmaz — borular bağımsız). Gösterim = 90 günlük KAYAN pencere ⭐ (sıfırlama değil — eski akar gider; sessiz mekan
   prior'a süzülür; şef değişimi ~90 günde otomatik yeni imaj)
S = (n×gerçek + K×prior) / (n+K)   ·   K = 3 ⭐   ·   prior = 5.0 → kategori şehirde
   35 ritüele ulaşınca ⭐ o kategorinin gerçek ortalamasına döner
Etiket: yeni <2 · oturuyor 2-9 · OTURMUŞ 10+ ⭐ (park: n≥5+tutarlılık ikinci kapısı)
Aura dağılımı: kategori kırılımı — <3 instance "tentative" · toplam <5 ritüel gizli
   · küçük yüzdeler YAZILIR (+diğer satırı)
Chip kırılımı public ama n≥10 chip'e kadar gizli ⭐
DUVARLAR: kullanıcı korunur/venue açıktır · venue skorları kişi RS'ine ASLA girmez ·
   skor satılamaz, arşiv gizlenemez · içerik moderasyonu (çıplaklık vb.) sahibin
   isteğiyle değil KURALLA kalkar — venue/brand/zone'da aynı
```
Gaming notu: sahte ritüel = üçlü-kilit check-in'le fiziksel maliyet; ilk-gün hilesi K sayesinde 3 günde erir (simülasyonla doğrulandı).

# 11. REGULAR (müdavimlik)

Aynı mekanda son 45 günde ⭐ 4 check-in'li ritüel ⭐ → Regular (otomatik — founder: "regular olmak kolay olmaz"; ~11 günde bir = gerçek müdavimlik). Son katılımdan 60 gün ⭐ geçerse sessizce düşer (bildirim yok). **Private:** başkası göremez ("her Salı orada" = konum deseni = güvenlik riski); mekan kendi regular listesini görür; isteyen passport'unda gösterir. Açtığı şey: regular-only slotlar + mekanın iç-halka araçları. Kalıcı prestij ayrı yerde: VENUE-badge (eşik MEKAN-TANIMLI — badge'in kendi gereksinimi; izinli koşul tipleri: geliş/kategori/slot/etkinlik, admin onaylı, max 5. Evrensel merdiven YOK — founder düzeltmesi).

# 12. ZONE & SPARK & MARKER

Zone = bizim alanlarımız; profili: canlı + arşiv + Aura (Trust yok) + forum. Marker (Tree/L/DJ/taş) = QR/NFC'li fiziksel kapı. **SPARK** (post-v1, flag): zone içinde QR'la tanış → beraber instant ritüel başlat; min 3 korunur ("2 kişi başlattı—katıl" kartı); 3 dolmazsa ritüel doğmamış sayılır (ekleşme kalır); default kapasite AÇIK. Zone-Aura kullanıcıların serbest rekabetine açık ("hakimiyet savaşı" = özellik — tematik kimlik aşağıdan doğar). Badge sinyali: ritüel 3p / marker okutma 1p ⭐.

# 13. EKONOMİ EŞİKLERİ

Paketler: Free (varlık — asla paralı olamaz) · Operatör ₺7.900/€199 ⭐ (bant 6.9-9.9K / 179-249) · Hakim ₺19.900/€499 ⭐ (bant 16.9-24.9K / 449-599). Slot = eşzamanlı hak (Operatör 3 ⭐ / Hakim 5 ⭐), ritüel sayısı SINIRSIZ. Add-on: ek slot paketi ⭐ · LOCAL Takeover (gün ücreti ⭐) · etkinlik vitrini ⭐. Faz 0-1 herkes free; pivot'lara ilk-yıl indirimi. Satılmaz: skor/sıralama/güven işareti. Kullanıcı hiçbir fazda ödemez.

## 13.5 KAPI & KİMLİK KURALI (v2 — "kapı devrimi", founder kararı)
```
İKİ ŞERİTLİ TEK KAPI — gün 1'den, her ülkede, sonsuza dek:
  ÜNİVERSİTELİ: üni-mail + doğrulama → 🎓 üni etiketi (default AÇIK; isteyen
     kapatır; tıklanınca üni-profiline gider). Üni listede yoksa → başvur →
     o üninin LOCAL FOUNDER'ı ol.
  HERKES:       resmi kimlik doğrulaması (TR: TC/NVİ-tabanlı · yabancı uyruklu:
     PASAPORT veya AB kimlik kartı · İT: SPID · ülke başına eşdeğeri) → profilde
     etiket alanı HİÇ YOK (boş da render edilmez)
     (Erasmus/exchange öğrencisi genelde TR üni-maili alır → üni yolundan girer;
      pasaport yolu üni-öğrencisi-olmayan yabancılar içindir)
  → LOCAL'de doğrulanmamış hesap YOKTUR. İstisnasız.
DAVET: kapı-anahtarı DEĞİL (o rol kalktı) — paylaşım/onboarding hızlandırıcısı
  olarak yaşar (ritüel referansı / L-friend kilitli). Doğrulamayı asla atlatmaz.
SAKLAMA — DOĞRULA-VE-AT: ham kimlik verisi veritabanında YAŞAMAZ. Kalan:
  verified/18+ bayrağı + tekrar-kayıt engelleme hash'i. Cümle: "Doğruluyoruz,
  saklamıyoruz." (KVKK/GDPR paketi + doğrulama servisi seçimi: hukuk cofounder,
  launch-öncesi tek iş kalemi ⭐)
SONUÇLARI (neden devrim):
  · L4/ban artık GERÇEK — aynı kimlikle ikinci hesap açılamaz; tüm L-merdiveni
    dişe dokunur hale geldi. Sahte hesap/bot/troll ordusu yapısal olarak kapalı.
  · 18+ yaş kapısı aynı hamlede çözüldü.
  · "Sadece üniversitem/üniversiteliler" ritüel koşulu gün 1'den anlamlı;
    kimlik-yolu kullanıcıları bu koşullu ritüellere katılamaz, üni friends-
    listelerinde görünmez.
  · Hedef kitle gün 1'den genişledi (25-40 dahil herkes girebilir) — AMA
    pazarlama odağı DEĞİŞMEDİ: üni kümesi çekirdek, yoğunluk stratejisi aynen.
    Kapı açık ≠ hedef dağınık.
GENEL DEĞERLENDİRME (founder + sistem yorumu): Bu karar LOCAL'in güven tezini
  kapının kendisine taşıdı — Tinder'ın yıllar sonra yarım eklediğini biz gün 1'de
  kural yaptık: "Gelmek istiyorsan kimliğini doğrula." Büyüyen kitle, büyüyen
  sorumluluk demek; asayiş EN BÜYÜK DENETLEME KATIYLA sağlanır: kimlikli kapı
  (giriş) + üçlü-kilit check-in (fiziksel) + moderasyon merdiveni (davranış) +
  tek kuyruk (eşitlik). Dört kat üst üste — hiçbir sosyal platformda dördü birden
  yok. Onboarding dili özür değil gurur: "LOCAL'de herkes gerçek. Bu yüzden
  buradasın."
```

## 13.6 GELECEK HATLARI & KIRMIZI-ÇİZGİ KARARLARI (founder "deli soruları" defteri)
```
✅ PARK — LOCAL TICKETS (Faz 2+): VEN-EVENT bilet satışı + premium masa tier'ı
   ("erken bilet = pencere masası"). Şart: bilet MEKANIN ürünü, LOCAL kasa+komisyon;
   sosyal katman asla paralı olmaz. Kazanç: kimlikli katılımcı listesi = no-show'suz
   etkinlik. Genel ödeme kasası (masa hesabı) RED — fintech lisans/odak yükü.
✅ PARK — PARTNER-PERKS / "LOCAL BLACK" (Faz 2+): KAZANILAN statü (badge/Regular/
   davranış-temelli, satın alınamaz) partner mekanlarda perk açar (erken erişim,
   regular masası, mekan ikramı). Perk'i MEKAN fonlar, para LOCAL'e akmaz.
   İlke: "skorun sana kapı açar; cüzdanın açamaz."
❌ RED — PARALI KULLANICI TIER'I ("LOCAL Elite" parayla): mavi-tık yolu = kültür
   intiharı; kullanıcı hiçbir fazda ödemez (değişmez).
❌ RED — GARSON/PERSONEL PUANLAMA: insan-puanlama yalnız karşılıklı-masa bağlamında
   yaşar; çalışana tek-yönlü puan = güç asimetrisi ihlali + KVKK/iş-hukuku mayını +
   "garson puanlayan app" basın distopyası. ALTERNATİF (mekanın kendi işi):
   VARDİYA-EŞLEME — Gece Raporu'nun ritüel-bazlı [servis] chip'lerini mekan kendi
   vardiya çizelgesiyle kendisi eşler; LOCAL kişi-düzeyi çalışan verisi ÜRETMEZ.
   Cümle: "LOCAL insanları masada eşit tutar — garson da masadadır."
🔒 İLKE — KURUM KAPISI: LOCAL'de İÇERİK-DAĞITIM YÜZEYİ YOKTUR (feed/link akışı/"post"
   fiili yok) — hiçbir hesap tipi için. Kurum/medya/marka (CNN, BBC, 9gag...) LOCAL'de
   ancak RİTÜEL YAŞATARAK var olur: Brand entity (yalnız Aura + yaşandığı yerler) +
   çalışanların kimlikli kişi-hesaplarıyla hosted ritüeller/Series + brand-hosted
   VEN-EVENT'ler. Meme/viral makinesi mimari olarak çalışamaz (görsel yalnız window'dan,
   yorum text-only, Yankı söner) — bu forumun kalite sigortasıdır. Değer cümlesi medyaya:
   "Twitter'da sana bağıran 10.000 anonim; LOCAL'de seninle oturan 6 gerçek okur."
   Gelir hattı: brand görünürlük SATIN ALAMAZ, ritüel yaşatmak için öder (Brand-Host
   programı Faz 2+ parked). "Instagram markaya izlenme satar; LOCAL oturan masa satar."
   BRAND MEKANİĞİ (onaylı — tam açılım: Kurum & Brand Rehberi): brand = İMZA katmanı,
   ritüeli kimlikli yetkili KİŞİ host'lar (brand_members), yer serbest. BRAND'İN SLOTU
   YOKTUR (venue değildir, Trust'ı yoktur). Kendi binası: K1 = custom location + çoklu
   masa için event_group_id (gün-1) · K2 = düzenli halka-açık program isterse bina AYRI
   VENUE olur (Trust dahil, normal kurallar) — imza katmanı asla slot almaz. Launch:
   2-3 pilot (ücretsiz, min 8-12 hafta Series taahhüdü — Socrates arketipi) · red
   listesi: bahis/sigara/MLM/siyasi parti/dini kurum hesabı · kültür vetosu founder'da.
```

# 14. ⭐ MASTER TABLO — kalibrasyon protokolü

**Tüm ⭐'lar tek config dosyasında yaşar (kodda gömülü DEĞİL).** Değişiklik akışı:
```
1. SİNYAL: Aras'ın izlediği metrik eşik dışına çıkar (aşağıdaki tablo)
2. ANALİZ: veri + gerekirse simülasyon (Claude'la — mevcut sim altyapısı hazır)
3. ÖNERİ: Aras → founder (tek sayfa: mevcut değer, önerilen, gerekçe, beklenen etki)
4. ONAY: founder · 5. UYGULAMA: config değişikliği (kod değişmez) · 6. İZLEME: 2-4 hafta etki takibi
```

| İzlenecek sinyal | Sağlıklı bant ⭐ | Sapma → bakılacak vida |
|---|---|---|
| RS kitle dağılımı (30g) | 5.0 ± 0.5 merkez | W ağırlıkları / K_UP-K_DOWN |
| Feedback tamamlanma | > %40 | soru yükü / pencere / EMPTY_FB_IF |
| No-show oranı | < %15 | ceza kademeleri / kapı / KİLİT-ANI |
| CAP_NEG isabet sıklığı | nadir | K_DOWN sertliği |
| Solo-path kullanıcı oranı | izle | QR-BUMP UX / dampener |
| Yeni venue "oturma" süresi | 1-3 hafta | K / oturmuş eşiği / tutarlılık kapısı |
| Chip'lerin kullanımı | ölü chip yok | chip seti budama |
| SPARK 3'e-ulaşma oranı | > %30 | MIN tartışması ancak o zaman |
| Sessiz-çıkış sıklığı (kişi başı) | < 2-3/30g | pattern inceleme eşiği |
| SLA'lar (güvenlik/içerik/genel) | 2h/12h/48h | moderasyon kapasitesi → işe alım tetiği |

**Tam ⭐ envanteri (config sırasıyla):** GPS radius'ları · kapı %20+clamp(10-60dk) · AIS dilimleri (%60/%40) · grace 10dk · KİLİT-ANI %25+clamp(15dk-3h) · feedback +12h · EMPTY_FB_IF 0.30 · FL eşikleri 1/4/8 + 12 ay tazelik · FB ağırlıkları 1.0/0.5/0.0 · DS alpha 0.30 + çarpan 0.45-1.20 + FL/Regular ağırlıkları + tier eşikleri · no-show/askı/host-ban kademeleri · late-cancel kademeleri · no_peer dampener 0.35 + tavan 7.5 + CF_self yarısı · L2 süreleri 72h/7g/30g · L3 bandı −0.15..−0.30 · SLA'lar · sessiz-çıkış pattern eşiği · VEN K=3 + prior geçişi 35 + pencere 90g + oturmuş 10 + tentative 3 + dağılım-gizli 5 + chip-gizli 10 · Regular 4/45g + sönüm 60g + venue-badge eşikleri mekan-tanımlı · zone puanları 3/1 · nabız bantları · paket fiyat bantları + slot hakları + add-on ücretleri · notif default'ları · üni-etiket default AÇIK (kapatılabilir) · kimlik doğrulama servisi/ülke eşlemesi · Takeover mekaniği ücreti.

**Kapanış ilkesi:** *"Sistem hiçbir yerde uydurmaz: bilmediğinde 'bilmiyorum' der, öğrendiğinde öğrendiğini kullanır. Eşikler tahmin olarak doğar, veri olarak yaşar — kalibrasyon LOCAL'in bitmeyen ritüelidir."*

---

# EK-A — ALGORİTMANIN TAM ANLATISI (sinyalden skora, uçtan uca)
*Founder isteğiyle: "7 ayın en güçlü ve en zor yeri." Bu bölüm algoritmanın hem matematiğini hem FELSEFESİNİ anlatır — yeni ekip üyesi, yatırımcı teknik sorusu ya da 2 yıl sonraki biz için tek referans.*

## A0 — Neden bir skor var? (felsefi temel)
Gerçek dünyada güven, tanışıklıktan damıtılır: yıllar, ortak arkadaşlar, görülmüş davranış. Şehir hayatı bunu kırdı — yabancı = bilinmez = risk. Sosyal medya daha da kırdı: profil = performans, takipçi = sahte kefalet. **LOCAL'in iddiası: güven ödünç alınamaz ama ÖLÇÜLEBİLİR — yalnız yaşanmış, tanıklı, fiziksel davranıştan.** RS bir puan değil; "bu insan sözünün arkasında duruyor mu ve masada nasıl biri" sorusunun, yüzlerce küçük gerçek anın damıtılmış cevabı. Kullanıcı neye muhtaç olmalı? Skora değil — skorun MÜMKÜN KILDIĞI şeye: tanımadığı biriyle masaya oturabilme cesaretine. LOCAL dışında tanımadığın insan tehlikelidir; LOCAL içinde tanımadığın insan bile kimliklidir, tanıklıdır, cezalıdır. "O adam lavuktu" dedirtmeyiz; çünkü lavukluk sistemde iz bırakır ve iz, kapıları kapatır.

## A1 — SİNYALLER: hangi soru/an hangi veriyi doğurur
```
AN / SORU                                  → SİNYAL           → NEREYE
Check-in zamanı (kapı dilimi)              → AIS (1.00/0.85)  → RS bileşeni (W 0.25)
Check-in hiç yok                           → NO-SHOW          → BYPASS (doğrudan ceza)
Q1+Q2 (masadaki FL1/FL2 arkadaşların
  "nasıl biriydi / katkısı" cevabı 🟢🟡🔴)  → IQ               → RS bileşeni (W 0.30, en ağır)
Q2(peer) + R1(kendi dürüst öz-cevabın)     → CF = 0.65p+0.35s → RS bileşeni (W 0.15)
Yaşanmış iz bıraktın mı (memory)           → MB               → RS bileşeni (W 0.05)
Geç dilim izi (0.25) + boş fb görevi (0.30)→ IF               → T = P − 0.20·IF
RQ ("bu ritüel nasıldı", herkes)           → ritüel kalitesi  → nabız + venue Aura + host'a sinyal (RS'e DEĞİL)
P2V ("mekan nasıldı", herkes)              → venue Trust      → mekan motoru (kişiye asla)
P2H (host'a)                               → PRIVATE host sinyali → YALNIZ host'un kendi paneli + MOD korelasyon — hiçbir sıralamaya/keşfe girmez, hiçbir yerde render edilmez
Chip'ler (neden-etiketleri)                → kırılım          → venue/host/ops route — HİÇBİR SKORA girmez
Rapor (panel/profil/içerik)                → MOD paketi       → L-merdiveni — RS'e YALNIZ L3 kararıyla
Late-cancel (kilitten sonra)               → ceza             → BYPASS merdiveni
```
**İlk okuma dersi:** RS'e yalnız DÖRT bileşen + IF girer. RQ ritüeli ölçer, P2V mekanı, P2H hostu, chip nedeni, rapor davranış-ihlalini — hepsi ayrı borularda akar. Boruların karışmaması sistemin ilk namusudur: mekan kızgınlığı kişiyi yakamaz, kişi düşmanlığı mekanı yakamaz, öfkeli tek rapor kimsenin skoruna dokunamaz.

## A2 — PIPELINE: bir ritüel bittiğinde adım adım ne olur
```
1) HAM NOT:  P = 0.25·AIS + 0.30·IQ + 0.15·CF + 0.05·MB     (0..0.75 bandında — ağırlık toplamı)
2) SÜRTÜNME: T = P − 0.20·IF                                  (geç iz + boş görev düşer)
3) YÖN:      ham Δ = (T − 0.50) × K      K_UP=0.15 / K_DOWN=0.30
   → 0.50 nötr çizgi: "idare eder" bir gece skoru OYNATMAZ. Güven yavaş kazanılır (0.15),
     çabuk kaybedilir (0.30) — insan sezgisinin matematiği.
4) CONF:     rater sayısı karışımı — n=1: %60 ⭐ nötrle karıştır · n=2: %25 · n≥3: ham
   → tek tanık yargı olamaz; tek kankanın 🟢'si de tek düşmanın 🔴'si de sulandırılır.
5) DS ÇARPANI (0.45–1.20): son 5 ritüelin insan/bağlam/mekan çeşitliliği (EMA α=0.30,
   FL-ağırlıklı: non-FL 1.00 → FL3 0.20 — Regular-ağırlığı kaldırıldı)
   → aynı 4 kankayla dönen değirmen güven ÜRETMEZ; yeni masalara açılan beslenir.
6) BC ÇARPANI: istikrar ödülü ×1.25 · tek-kötü sönüm ×0.70 · kötüleşen trend ×1.35
   → desen > an. (Founder'ın korkusu için bkz. A4.)
7) MD: ilk 12 ritüelde ×0.50→×1.00 kademeli → yeni gelen ne uçar ne batar; tanınma süre ister.
8) BR: RS>8.0'da yükseliş yavaşlar, RS<3.0'da düşüş yavaşlar → uçlarda atalet; zirve
   şişmez, dip mezara dönmez (rehabilitasyon matematiksel olarak mümkün kalır).
9) CAP: Δ clamp(+0.12, −0.15) → TEK GECE HAYAT DEĞİŞTİRMEZ — ne yükselişte ne düşüşte.
10) İŞLE + LOG: RS güncellenir; score_events'e her çarpan AYRI yazılır (ceiling, DS, BC...)
    → kalibrasyon şeffaflığı: 6 ay sonra "BC gerçekte ne yapıyor" sorusu VERİYLE cevaplanır.
```
**BYPASS KAPISI (pipeline'ı atlayanlar):** no-show (−0.08/−0.15/−0.20 + askı), late-cancel merdiveni, moderasyon L3 (−0.15..−0.30). Bunlar "kötü bir gece" değil "bozulan söz / ihlal" — nota değil doğrudan skora işler, cap'e takılmaz. İyi kapı tek: pipeline. Kötü kapı iki: pipeline + bypass. **Asimetri bilinçli: iyilik kazanılır, ihlal cezalandırılır.**

## A3 — NO-PEER PATH (rater'sız ritüel): ölçemediğini yok say, ölçebildiğini küçült
Masada FL1/FL2 yoksa IQ ve CF-peer HESAPTAN KALKAR (0 yazılmaz — yokluk ceza değildir); kalanlar (AIS + 0.50 ağırlıklı R1 + MB) yeniden ölçeklenir, sonra NO_PEER_DAMPENER ×0.35 uygulanır ve pozitif delta için iz şartı aranır (R1 veya memory). Tavan: peer-feedback'i hiç olmayan hesap RS 7.5'i geçemez — **çünkü tanıksız güven yarım güvendir**; ilk gerçek tanıklıkta tavan kalkar. Bu kişisel/tek kişilik ritüel değil, normal fiziksel masaya katılan ama uygun peer rater'ı olmayan kullanıcının yoludur.

## A4 — FOUNDER KORKUSU: "BC istikrarı gerekli mi?" — dürüst cevap
BC'nin işi tek cümle: **anı değil deseni ödüllendir/cezalandır.** Üç kolu üç insan gerçeğine basar: (1) istikrarlı iyi ×1.25 — güvenilirlik tanım gereği TEKRARDIR, tek iyi gece değil; (2) tek-kötü sönüm ×0.70 — iyi insanın kötü günü olur, sistem bunu affetmeli (hakkaniyet, senin kelimen); (3) kötüleşen trend ×1.35 — bozulma erken yakalanmalı. Kaldırırsak ne olur: her gece bağımsız işler → varyans artar, "kötü gün geçiren iyi adam" daha sert düşer, sinsi kötüleşme daha geç görünür. Yani BC tam senin istediğin şeyi yapıyor: **hakkaniyet + gerçek kötüyü hızlı yakalama.** Maliyeti: pipeline'a bir çarpan daha = izlenebilirlik yükü — çözümü kurduk: score_events her çarpanı ayrı loglar. **Kararım/önerim: BC KALIR; prova döneminde "BC-off gölge simülasyonu" koşulur** (aynı veriyle BC'siz skorlar paralel hesaplanır, fark raporlanır) — gereksizse tek config ile ×1.0'a nötrlenir, kod silinmez. Korkuyu söküp atmıyoruz; veriyle yargılanmaya mahkûm ediyoruz. ⭐

## A5 — VENUE MOTORU (kişi motorunun kardeşi, ayrı kan dolaşımı)
```
P2V (🟢🟡🔴 + chip) → TRUST: "işletme sözünü tutuyor mu" — VEN-4 shrinkage:
   skor = (n_eff × ham + K × prior) / (n_eff + K)   K=3 ⭐ — HESAP TAMAMEN 0-1 UZAYINDA:
   ham = ritüel-ortalaması (0-1), prior_internal = 0.50; GÖSTERİM ×10 (Aras yakalaması:
   ölçekler karıştırılırsa yeni harika mekan ~3 gösterirdi — birim hatası kapatıldı)
   prior_internal: 0.50 → kategori şehir-ortalamasına (0-1 uzayında; kategori ≥35 ritüelde) · pencere 90g kayan
   → az veri = temkinli tahmin; "3 kankasına 5 yıldız bastıran" açılış hilesi ölür.
AURA: RQ + kategori dağılımından — "burada NE yaşanıyor, ne kadar iyi yaşanıyor"
   dağılım <3 instance "tentative", toplam <5 ritüelde gizli, chip kırılımı n≥10'a kadar gizli.
1 RİTÜEL = 1 GÖZLEM (rater sayısı değil — kalabalık masa çifte oy değildir). TEKRAR-RATER SÖNÜMÜ ⭐: aynı kullanıcının aynı mekana cevabı 90g'de 1.×1.00 / 2.-3.×0.50 / 4.+×0.25 ağırlıkla girer (Trust+Aura) — sabotajcı da müdavim-şişirmesi de tek kuralla kesilir; skor ÇEŞİTLİ tanıklardan doğar.
İKİ YÖNLÜ YALITIM: venue skoru kişi RS'ine asla; kişi RS'i venue skoruna asla.
   Mekan kullanıcıyı puanlayamaz (güç asimetrisi: esnaf müşteriye not veremez).
```

## A6 — ÇIKTILAR: skor nerede yaşar, ne yapar, ne YAPMAZ
RS default GİZLİ (sahibi isterse açar). Kullanıcı ritüellerinde RS kapı DEĞİL (min-RS koşulu yok — skor sosyal kast yaratamaz); venue slotlarında sessiz eşik OLABİLİR (mekan kendi masasının çıtasını koyar, kullanıcı sayı görmez — uygun olmayan slot görünürlükten doğal düşer). DS tamamen private (kimseye kapı, kimseye etiket). Skor SATILMAZ, sıralama satılmaz, güven işareti satılmaz — para sahne aletleri alır, sahnedeki sırayı asla. Ceza görünür değil hissedilirdir: askıdaki adamın profili damgalanmaz, sadece iz bırakamaz — utandırma değil, durdurma.

## A7 — KALİBRASYON: "eşikler tahmin doğar, veriyle yaşar" (founder ilkesi)
Bütün ⭐'lar (Master Parametre Dosyası ~90 kalem) config'te yaşar; değişim protokolü: sinyal → analiz/simülasyon → Aras tek-sayfa önerisi → founder onayı → config (kod değişmez) → 2-4 hafta izleme. Kullanıcı hiçbir kalibrasyonu HİSSETMEZ — duyuru yok, changelog yok; sistem sessizce doğruya yaklaşır. İzleme sinyalleri Bölüm 16'da (Master dosya): RS kitle merkezi 5.0±0.5, feedback tamamlanma >%40, no-show <%15, 🟡-chip canlılığı... Kalibrasyon bitmez — **bu bir ürün özelliği değil, ürünün metabolizması.**

## A8 — SİSTEMİN TEK CÜMLESİ
*Her sinyal yaşanmış bir andan doğar; her boru kendi skoruna akar; iyilik yavaş birikir, ihlal hızlı öder; tek gece hayat değiştirmez, desen her şeyi değiştirir; ve hiçbir şey satın alınamaz.* — Bu cümleyle çelişen her gelecek özellik, cevabını bu ek'te bulur: HAYIR.


---
# EK BÖLÜM E1 — KİMLİK, SOSYAL KATMAN, SERIES, PARA (27 Tem işlemesi — karar defteri C-bloğu)

## E1.1 KİMLİK & USERNAME
İsim-soyisim BİRİNCİL (kimlikliyse kilitli); username = @silik-alt-satır: benzersiz, aramada bulunur, kartlarda ismin önüne ASLA geçmez, değişim 90g/1 ⭐, tanınmış isim/kurum rezervasyonu (impersonation koruması), bio-link/mağaza alanı YOK. Üni-mail'li (kimliksiz) hesapta GERÇEK-İSİM POLİTİKASI: mail'den ön-doldurma + gerçek-isim beyanı; sahte/persona isim = moderasyon ihlali; isim değişimi 90g/1 ⭐; isteyen kimlik doğrulatıp ismini kilitletir. Kurum: doğrulanmış kurum adı + @handle. "@ bir ADREStir, VİTRİN değil."

## E1.2 ÜÇ BAĞ KATMANI
FRIEND (kişi↔kişi): masada kazanılır — değişmez. FOLLOW (→): tek yönlü ilgi, ayrıcalıksız; tek işlevi Your Pulse görünürlüğü. AFFILIATE (kişi↔kurum): doğrulanmış bağ — üni'de OTOMATİK (mail-domain), brand'de ADMIN-ATAMALI (imza yetkilileri). Kurum profilinde "Friends" yazmaz → "BAĞLI HOSTLAR / TOPLULUK". Resmi olmayan kulüpte bağ launch'ta yok (lider+Series yeter) → Faz-2 üyelikle affiliate olur.

## E1.3 SERIES (resmi ad — "repeated" ölü kelime)
Şablon + haftalık INSTANCE (katılımcısı BOŞ doğar; oto-join YOK; yalnız SONRAKİ instance join alır). Kurulum seti (launch): her hafta / 2 haftada bir × N-hafta / süresiz. Ardışık-blok (3 gün üst üste) Series DEĞİL → event_group. 🔔 SERIES-TAKİP ⭐: yeni instance/join-açılışı bildirimi — takip ≠ söz, K3'e girmez. GEZEN SERIES ⭐: gün+saat sabit, pin instance-bazında kilide dek düzenlenebilir. İLERİ-TARİH UFKU: şahıs tek-seferlik 21g ⭐ · VEN-EVENT/kurum-event 60g ⭐ · Series muaf · venue rafları ufuksuz. Kulüp adı SERIES adında taşınır ("Kadıköy Koşu Kulübü · Pazar Koşusu") — marka/kurum adı taşımak brand-imza şartı.

## E1.4 KAPILAR & AÇILIŞ
Üç kapı: KİŞİ (self-serve: üni-mail/kimlik) · VENUE (white-glove) · KURUM (admin-only; profil+imza+bağlı yetkili kişiler). Üni/kulüp resmi hesabı YOK — kulüp = liderin kişi hesabı + Series (+ venue REGULAR_ONLY). Açılış ekranı: tek parlak yol [GERÇEK OL — KATIL]; venue/kurum başvurusu silik alt-link (web form). COMMUNITIES: Faz-1.5 salt-okunur topluluk sayfası → Faz-2 üyelik (members-only görünürlük + rozet + yetki devri; tetik gelmeden açılmaz).

## E1.5 PULSE & LOCAL WORLD
Pulse (24h) İKİ kapsam: YOUR PULSE (friends + follows + kendi açtıkların) · LOCAL WORLD (şehrin nabzı). Solo sekme, Solo Window ve SOLO scope yoktur. Your Pulse İKİ ŞEYİ birden taşır: ÇEVRE'ye açılmış memory'ler (audience=CIRCLE — yalnız friends+takipçilerin gördüğü katman) + çevrendekilerin ŞEHİR'e açtıkları. Kendi paylaşımın burada yaşar; kapılar rulo/window, profil ve kendi kartın. Yankı-hatırlatması nadir karttır; sayaç/streak/suçlama asla yoktur. LW sıralaması tazelik temel + hafif kişiselleştirme ⭐ (bölge yakınlığı + kategori izleri); takipçi-ağırlığı/ödeme ASLA. LW ORTA EKRAN: search'süz kart+harita; search'te forum, memories arşivi, profiller, mekan ve Series.

## E1.6 İÇERİK RIZASI & MASA BARIŞI
KALDIRTMA HAKKI 🔒: memory'de yer alan herkes [beni rahatsız ediyor] → şehre açılım kilitlenir/düşer; itiraz halinde RIZA KAZANIR, ısrar MOD'a (rıza şikayeti öncelikli kuyruk). Masada-olmayan kişinin görüntüsü: doğrudan kaldırma. Paylaşım SESSİZDİR (LW-açılış bildirimi YOK — öldü); opt-in ayar ⭐: "içinde olduğum an şehre açılınca haber ver" (default kapalı). QUOTE-SAHİBİ KURALI 🔒: söz sahibinindir — [kaldır] tartışmasız. Window'da kişi-engelleme var; kavga = küçük sahne (≤12, süreli, kapalı-default) + kimlikli bedel + FB izi. Kamera-zırhı hatırlatma: rulo tamponu + mühürlü-seyirci + bilinçli şehre-açma.

## E1.7 PARA İLKELERİ (genişleme)
Slot para birimi değil MEKANIN RAFIDIR; LOCAL'e ödeyen tek launch aktörü venue. ÜCRETLİ RİTÜEL (launch): fee-BEYAN alanı ⭐ (yapılandırılmış: tutar+"yerinde ödenir"; serbest metne gömme yasak) + ₺ rozeti + [ücret sürpriziydi] chip'i; para LOCAL dışında; join hep bedava-buton ([Katıl]=söz). ≥100 event'te kod yasak 🔒 → paralı büyük kapının tek yolu personel-totem mühürü ("biletini sat, kapını biz mühürleriz"). FAZ-2 LOCAL TICKETS: bilet=devredilemez mühür ön-satışı; satıcı yalnız onaylı aktör ⭐; RS paradan izole. Brand'in ödediği: venue paketi (mekanıysa) · Brand Programı (Faz2+) · Tickets komisyonu · Faz-3 rafları. Asla satılmayan: keşif sırası, skor, kuyruk.

## E1.8 HOST PANELİ & ORGANİZATÖR
Panel merdiveni: katılımcı=passport · HOST PANELİ ⭐ (private): kurduğu masaların yoklama defteri (doluluk/dönüş/no-show/arşiv) · Series-host: +hafta kırılımı · kurum: brand arşivi · venue: Gece Raporu. Tekrarlayan custom-pin = VENUE-LEAD RADARI ⭐ (ops'a düşer). BADGE yaratma: sistem+venue only 🔒 — org/user yaratamaz; kulübün madalyası Series şeridi+arşiv sayısı. CREATE: tek ekran / yedi bölüm. Şahıs ritüel görünürlüğü: HERKESE / ARKADAŞLARA(FL) ⭐.


# EK BÖLÜM E2 — VENUE EKONOMİSİ v2 + CANLI ÇARDAK + ETKİLEŞİM MİMARİSİ (28 Tem — founder onaylı)

## E2.1 WALK-IN SINIRSIZ 🔒 (♻️M1 — check-in'den sonraki en büyük revizyon)
Sokaktan doğan masa (self-rez · 📍istek · sözlü kabul · açık masaya katılım) hiçbir pakete, hiçbir tavana vurulmaz. Fren üçlüsü: FİZİK (masa boşluğu) + MEKAN İRADESİ + [YER VEREMEDİK] tek-tık ⭐ (panel, sessiz iptal + kurana nötr yönlendirme). KABUL=HAK-YEMEZ GENELLEŞTİ 🔒: mekanın kabul ettiği hiçbir masa (walk-in VEYA planlı istek) raf hakkı yemez — irade kotaya vurulmaz. DOĞUM-İPTALİ ⭐: Instant ilk 10dk + yalnız kuranın mührü → [vazgeç] = sessiz silinme, cezasız ("söz henüz kimseye verilmemişti"). VENUE-KANAL TANIMI 🔒: masa ancak mekanın kanalından (raf/istek-kabulü/self-rez/VEN-EVENT) doğduysa venue ritüelidir; kapı önü/kaldırım = CUSTOM (P2V/Trust kirlenmez; tekrarlayan pin = venue-lead radarı) — mekan gri-alan masasını panelden [SAHİPLEN] ⭐ ile venue'ya evirebilir.

## E2.2 SELF-REZ v2 (♻️M2 — "dijital bekçi yok")
Her mekanda BEDAVA; mekan işaretlemeden ölü 🔒; işaretlenince DEFAULT = ANINDA ⚡ (30sn create → masa+kod doğar, panel zona atar); ONAYLI ⏳ = opt-in kontrol (titiz mekanın tercihi). İNCE-AYAR PAKETLİ ⭐: saat-aralığı ("12-18 anında, akşam onaylı") · zon-filtresi · kitle-koşulu. Kişi limiti 1/gün/mekan ⭐. İLKE: insan dokunuşu yalnız üç yerde ve tek-tık — uzaktan isteğe cevap, opt-in onay, yer-yok/vazgeç; gerisi makine+fizik. 0-çalışanlı self-service ile lüks restoran AYNI akışı yaşar.

## E2.3 SLOT = MEKANIN MASA-TASARLAMA HAKKI (♻️M3-M4 — paketin sattığı şey)
7 fark: ①KURGU (gün/saat/zon/kapasite/kitle/koşul/görünürlük/tema mekanın kaleminden — walk-in'de kurgu sokağın, mekan yalnız kapıcı) ②GELECEK+TEKRAR (Series yalnız rafta) ③ONAYSIZ PASİF AKIŞ ④KEŞİF İLANI ⑤AURA YÖNLENDİRME ⑥REGULAR MÜHENDİSLİĞİ (REGULAR_ONLY raf) ⑦HAZIRLIK GARANTİSİ. Ekonomi finali: FREE = sınırsız walk-in + sınırsız elle-kabul + kaba self-rez + 1 raf + temel rapor · PAKET = raf sayısı (3/5) + tasarım araçları (kurgu zenginliği + self-rez ince-ayarı + totem seti + kroki) + analitik derinlik. "Masaları herkes bedava yaşar; uyurken masa toplayan takvimi ve geceyi okuyan gözü satıyoruz." VEN-EVENT AYLIK TAVANI: ⭐ AÇIK — değer BOŞ (founder: pivot sonrası; ilke kabul: keşif mekan-ilanı çöplüğü olmasın).

## E2.4 CANLI ÇARDAK & ETKİLEŞİM MİMARİSİ (founder finali)
CANLI OKUMA yalnız ŞEFFAF masada mümkündür; dışarıdan canlı masa/window yazısı ASLA yoktur. Ancak sahibi bir içerik nesnesini LOCAL WORLD'e açtığı anda — ritüel canlı veya bitmiş fark etmeksizin — **▲, ▼, Echo ve Söz** açılır. Bunlar LW içerik nesnesinin altında yaşar, canlı masa konuşmasına düşmez. Oy kimlikleri anonim; ▲ ve ▼ sayaçları görünür; tek aktif yön değiştirilebilir/geri alınabilir; self-vote serbesttir. ▼ push/bildirim üretmez, RS'e girmez ve otomatik moderasyon değildir; koordineli saldırı etkisizleştirilir. Whole Window/ritüel forumuna yazma yalnız status=ENDED + forum_enabled iken açılır. Kapalı masa arşivi künye+açılmış memory'lerdir. ANTİ-GUILT: sayaç/streak/suçlama asla.

## E2.5 LW-PULSE TARİFİ ⭐ (kalibre-sınıfı — "ilerde en çok buna bakacağız")
Havuz: yalnız LW'ye açılmış memory'ler. Sıralama: tazelik çekirdeği × yer-izi 0.30 (mühürlü geçmiş mekanların) × mesafe 0.20 × kategori-izi 0.20 × sosyal-eko 0.20 (arkadaşlarının MASADAŞLARININ açtıkları — LOCAL usulü FoF: takip listesi değil masa komşuluğu) × tavanlı-popülerlik 0.10. Yasak: engagement-hedef-fonksiyonu, ödeme/takipçi sinyali, doom-scroll (24h raf + "şehre çık" kartları).

## E2.6 ONAY HARİTASI (özet ilke)
"Onay üç yerde insandır — mekanın kapısında (istek/opt-in onay), masanın şeridinde (tanıklık), founder masasında (brand/elçi); geri kalan her yerde ya ÖNDEN verilmiştir (raf koşulu, görünürlük) ya FİZİKSELDİR (tag, kimlik, mühür). Onay kutusu biriktirmeyiz — swipe kültürü anti-tezimizdir."


## E2.7 KAPASİTE MİMARİSİ — KATEGORİ-BAZLI (28 Tem finali ♻️)
İlke: "Masa ölçeği sohbetin fiziğidir; aktivite ölçeği aktivitenin fiziğidir — ikisini KATEGORİ ŞABLONU ayırır." Ortak taban her yerde min 3 🔒.
LAUNCH KATEGORİLERİ + kapasite bantları (hepsi ⭐ — pivot kalibresine tabi):
SOHBET & TARTIŞMA 3-12 · KAHVE BULUŞMASI 3-12 · YEMEK MASASI 3-14 · KİTAP & OKUMA 3-12 · OYUN MASASI (tavla/satranç/kutu) 3-16 · FİLM & İZLEME 3-16 · MÜZİK & JAM 3-16 · DİL TANDEM 3-12 · YÜRÜYÜŞ & KOŞU 3-30 · PİKNİK & AÇIK HAVA 3-24 · TAKIM SPORU (halısaha/basket/voley) 6-30 · ATÖLYE & ÖĞRENME 3-20 · GEZİ & KEŞİF 3-16 · DİĞER 3-12 (default şablon).
KAPASİTE v3 ♻️30Tem (REOPENED→FINAL): kategori bantları SERT DEĞİL — ÖNERİLEN default'lardır; host bandı serbestçe aşar, sistem yasaklamaz, nazik uyarı verir ("16 kişide tek sohbet zorlaşabilir — köşelere ayırmak ister misin?"). MUTLAK custom tek-masa tavanı 40 🔒 (halısaha 22 oyuncu+4 yedek+seyirci rahat sığar); 41+ = EVENT_GROUP veya venue-beyan; ≥100 kod-yasağı 🔒 aynen. ROL-SLOT ⭐ RAF (Faz-1.5, takım-sporu şablonu): opsiyonel roller (oyuncu/yedek/seyirci) + "aranan" satırı ("3 oyuncu eksik · 1 kaleci aranıyor") — kart: "17/22 oyuncu · 2/4 yedek"; launch'ta tek sayı, rol şablonu pivot sonrası.

## E2.8 FEEDBACK CHIP SETLERİ (28 Tem finali — renk-duyarlı; string-key'li, etiketler ⭐ copy-kalibresine tabi)
KURALLAR: chip'ler OPSİYONEL · TEK seçim 🔒 ♻️30Tem (renk → o rengin 3-5 sebebi → yalnız BİRİ: gecenin baskın teşhisi — form hissi yasak) · skora SAYI olarak girmez 🔒 (teşhis katmanı + panel kırılımı) · kırmızı chip'ler panelin "dikkat" satırını besler · [tanım yanılttı] ve [ücret sürpriziydi] MOD-eşiklidir (3/90g ⭐ öneri) · basılan renge göre FARKLI set açılır (yeşilin dili kutlama, sarının dili teşhis, kırmızının dili sorun — asla suçlama tonu).
RQ — MASA NASILDI (her renkte tam 3):
 🟢: [sohbet aktı] [masa dengeliydi] [tekrar isterim]
 🟡: [geç ısındı] [küçük gruplara bölündük] [tanımdan biraz farklıydı]
 🔴: [tanım yanılttı] [tek ses baskındı] [kadro uyumsuzdu]
P2V — MEKAN NASILDI (venue paneli kırılımının kaynağı; renkle isim değişir — founder isteği):
 🟢: [mekan sahiplendi] [servis akıcıydı] [fiyatına değdi] [ortam tam masalıktı] [personel sıcaktı]
 🟡: [servis yavaştı] [yer dardı] [biraz gürültülüydü] [fiyat yüksekti] [masa geç hazırlandı]
 🔴: [servis sorunluydu] [gürültüden konuşamadık] [temizlik zayıftı] [ücret sürpriziydi] [masa hazır değildi]
P2Z — ZONE (kısa set):
 🟢: [alan keyifliydi] [atmosfer güzeldi] · 🟡: [kalabalıktı] [gürültülüydü] · 🔴: [güvensiz hissettirdi] [temizlik sorunu]


## E2.9 — SOLO YÜZEY YOK + NO-PEER PATH + RS GÖRÜNÜRLÜĞÜ
Solo modu, Solo Window, Solo scope ve kişisel ritüel yoktur. “Solo Ritualist” yalnız uygun FL1/FL2 peer rater'ı olmayan kullanıcının ürün dilidir; normal min-3 ritüele katılır ve `NO_PEER_PATH` ölçümünden geçer. Eski `solo.*` config ve SOLO memory scope migrate edilip silinir. RS default görünmez; kullanıcı en az 10 ritüelden sonra ham sayı olmadan monokrom halka açabilir; toggle 30 günde bir ⭐, erişim/ranking etkisi sıfırdır.
RS GÖRÜNÜRLÜĞÜ (founder finali): DEFAULT NON-VISIBLE 🔒 aynen — ve YENİ: kişi İSTERSE profilinde açabilir (rs_visible toggle, default OFF 🔒): "pusula cepte; boynuna asmak isteyenin tercihi." Guardrail önerileri ⭐ (founder onayı bekleyen ayarlar): görünüm SAYI değil HALKA/BANT olarak render (kast-etkisi yumuşatma) · toggle değişimi 30g/1 ⭐ (skor-yüksekken-aç-düşünce-kapat oyunu frenlenir) · açık-RS keşif/sıralamada SIFIR etki 🔒 (görünürlük süs, avantaj değil). Bilinen risk (kayda geçsin): açanlar öz-seçilimle yüksek-skorlular olacak → görünürlük statü sinyaline dönüşebilir; pivotta izlenecek.


# EK BÖLÜM E3 — 1 AĞUSTOS TEMİZ KARARLAR

## E3.1 ETKİLEŞİM SETİ (kilitli çekirdek + kural önerileri)
SET: ▲UPVOTE · ▼DOWNVOTE · SÖZ (comment) · YANKI/ECHO. LIKE/KALP YOK. LW'ye açılan içerikte dört fiil anında açılır; canlı masa konuşmasına dışarıdan yazı düşmez. Oy kimlikleri anonim, ▲ ve ▼ sayaçları public; yön değiştirilebilir/geri alınabilir; self-vote serbesttir. ▼ bildirim/push üretmez, RS'e girmez, otomatik moderasyon değildir; koordineli saldırı etkisizleştirilir.
ECHO: kimlikli yeniden-yankı — memory/söz kendi çevrene (Your Pulse) taşınır; echo sayısı görünür; içerik sahibinin kaldırtma hakkı echo'yu da düşürür.

## E3.2 CHIP v2 + TOP-CHIP VİTRİNİ (30 Tem)
Akış: 🟢/🟡/🔴 seç → RQ'da o rengin tam 3, P2V'de tam 5 sebebi açılır → en fazla biri opsiyonel seçilir. Top-chip ritüelde ≥3 farklı cevap, venue'da ≥10 cevap olmadan public değildir. Kişi geçmişindeki chip kişi değerlendirmesi değil, katıldığı ritüelin özetidir. Chip skora girmez.

## E3.3 MENTION SİSTEMİ (30 Tem — rıza mimarisine bağlı)
Mention havuzu: aynı ritüelde mühürlü kişiler, thread'e daha önce katılanlar, host/operasyonel organizer ve ilgili venue/zone/Series. Sadece Friends olmak yeterli değildir. Kullanıcı mention'ı tek tık kaldırabilir; izin ayarı masa bağlamı/arkadaşlar/hiçbiri; bildirim merkezine kesin, push tercihe bağlıdır.

## E3.4 HOST YAŞAM DÖNGÜSÜ (30 Tem netleşmesi)
Host=KURAN'dır; mühürleme/onay gücü yoktur ve manuel host onayı yoktur. Host geçse de masa ilk gelenle açılır; host hiç gelmezse no-show işler, masa yaşayabilir ve P2H sorulmaz. Series/event_group/venue event'te operasyonel collaborator bulunabilir: anons, iletişim, instance/subtable ve rol-slot yönetir; mühür/tanık/RS/feedback/moderasyon yetkisi yoktur. Küçük tek-seferlik custom masada collaborator yoktur. Owner devri ayrı ve açık onaylıdır.

## E3.5 RS HALKASI GÖRSEL KURALI (30 Tem)
Opt-in halka MONOKROM 🔒: siyah-gri-beyaz / opaklık-bazlı (soluk→dolgun) — LOCAL'in tasarım diliyle bire bir; trafik-lambası rengi ASLA (kırmızı halka=suçlu damgası, yasak). Ham sayı asla public. Sahibine tam şeffaflık: kendi ekranında tam RS + değişim geçmişi + hangi ritüel ne etkiledi. Guardrail'ler ⭐: default OFF 🔒 · toggle 30g/1 (AÇIKLAMA: aç-kapa oyunu freni — skoru yüksekken açıp düşünce kapatma taktiğini öldürür; değişim ayda bire kilitli) · min 10 tamamlanmış ritüel şartı ⭐ · sıralamaya/keşfe etki SIFIR 🔒 · ritüellerde min-RS kapısı YASAK 🔒 · halka filtresiyle arama YASAK 🔒 · kapalı profilde "gizli" etiketi bile yazmaz (boşluk şüphe üretmesin).

## E3.6 SOSYAL ÜRÜN TEMELLERİ — 31 TEM KARARLARI (özet; tam dosya: Sosyal_Urun_Temelleri)
DM launch'ta yok, Faz-1.5 Friends-DM'dir. Masa reaksiyon seti 🤝 😂 🙌 👀 💡 ❓; ▲▼ mesaj reaksiyonu değildir. Mesaj düzenleme 5 dakika. Digest haftalık, default açık ama kapatılabilir ⭐. Block join'i engellemez; co-presence anında feedback uygunluğu snapshot olur ve sonraki block bunu silemez: kişi kırmızı feedback de verebilir, block da koyabilir. Save private pointer'dır ve algoritmaya etkisizdir. FIRTINA AFFI 🔒 (founder-onaylı — GPT paketine geç ulaşan karar, restore edildi): AÇIK-HAVA kategorilerinde (yürüyüş&koşu · piknik&açık-hava · gezi&keşif · açık-saha takım sporu · zone-masaları ⭐ liste) host iptali START−3h içinde CEZASIZ ⭐. KANIT İSTENMEZ — meteoroloji API'si/hakemlik YOK (LOCAL hava hakemi değildir; host beyanı yeter); suistimal freni: sık-kullanım MOD-desen dosyasına düşer ⭐. Karar kapalı; build edilir. Ayrı Ghost özelliği yoktur.

## E3.7 — DEFTER KAPANIŞI (1 Ağu: onaylı-ama-işlenmemiş son maddeler)
SERIES-REGULAR ⭐ RAF (F1.5, founder-onaylı): son 8 instance'ın ≥5'inde mühürlü → Series kartında sessiz müdavim rozeti + host panelinde çekirdek kadro + passport'ta "H.N'den beri"; skor/keşif/öncelik avantajı SIFIR. Beraberinde SERIES_REGULAR_ONLY görünürlüğü ⭐ (halısaha "sadece çekirdek" oynar — venue REGULAR_ONLY'nin Series kardeşi; by-approval join yine YOK 🔒). RITUAL DESIGNER / JOIN'SİZ-CREATE ⭐ RAF (F2, founder-onaylı fikir): create'te "masa şehrin — ben gelmiyorum" işareti (söz sayılmaz, P2H yok, kartta "tasarlayan/açan" ayrışır); sicil-eşikli — launch'ta create=söz 🔒 aynen. UNDER_MIN 🔒 (1 Ağu final — GPT önerisi kabul): min-altı açılan masa (1-2 mühür) yaşar ve window doğar; yalnız PRIVATE window/arşiv izi bırakır — RS ÜRETMEZ, RQ/P2V sorulmaz (Trust/Aura'ya sıfır), Regular'a SAYILMAZ, badge/host-istatistiğine girmez, public top-chip üretmez (tam skor-izolasyonu: iki kişinin birbirini puanlayarak sistemi kasması yapısal ölü). Hiç açılmayan masa (0 mühür) iz bırakmadan düşer 🔒. WITNESS-KADEME ⭐ (AKTİF DEĞİL — ACTIVE_SCHEME=LEGACY_2_TIER 🔒; şema config'te kapalı uyur, yalnız founder/pivot açar): mühürlü ≤3→1 · 4-12→2 · ≥13→3 tanık (büyük tek-masa 40'a çıkınca 2 tanık hafif kalır; sub'lı event'te pending masa-içi çözülür — kademe sub'suz büyük masa içindir). K6 BAND NOTU ⭐: K↓ 0.30 ilerde 0.26/0.24'e inebilir (band ↓0.24-0.36 · ↑0.12-0.18); "↓>↑" ilkesi KİLİTLİ — oran kalibre, asimetri felsefe.

## E3.8 — İKİ AÇILIŞ + FIND-US NOTU + PORTAL SETİ (2 Ağu)
İKİ AÇILIŞ CÜMLESİ (founder): "Mekan müşterilerine iki açılış verir — WALK-IN (her şey otonom ve rastgele; masa-spesifik boşluk bekleme diye bir şey YOKTUR) ve SLOT (mekanın kurduğu, kendi advertise ettiği raflar). Trust/Aura/veri ikisinin karmasından beslenir — burası LOCAL zaten."
FIND-US NOTU 🔒 (her ritüel tipinde — custom/venue/zone): opsiyonel ≤60 karakter ⭐ mikro-konum ("bar sağındaki yüksek masa" / "3. kat, zile 2 kez" / "çeşmenin arkası"). YAZAN: R-öncesi yalnız KURAN (pre-lock edit kuralıyla, anonslu). R-SÜRECİNDE yalnız MÜHÜRLÜLER günceller ("terasa geçtik" — masa neredeyse not oradadır; ilk-gelen-açar ruhu): tek alan, son-yazan-kazanır, şeride iz düşer ("not güncellendi · Deniz"). Dış dünya yazamaz 🔒 (söz-vermemiş kimse masanın yerini tarif edemez). GÖRÜNÜRLÜK: ritüelin görünürlüğüyle aynı; kapı kapanınca donar (işlevi biter). Pin-değişmezliğe dokunmaz — pin ÇAPADIR, not TARİFTİR.
PORTAL SETİ (netleşme — founder düzeltmesi): DEFAULT anlamı = KİMLİKSİZ ÇOKLU ERİŞİM: 4 duvara birer QR/NFC halkası, tek amaç kasada kuyruk olmasın (hepsi aynı buradasın-modunu açar). KÖŞE-ADLANDIRMA ("bar"/"DJ önü"/"teras") AYRI ve OPT-IN ⭐: yalnız ODALI mekan/kulüp tipi panelden açar (multi-room flag) — açarsa portal seçimi ritüel kartına yumuşak konum yazar. Ekonomi: Free=1 kasa-totemi · paket=portal seti ⭐ (+opsiyonel adlandırma aracı). Duvar S-desen / venue-identity-kit: F2 tasarım rafı (N&N brief'i).

## E3.9 — SOSYAL GRAF GÖRÜNÜRLÜĞÜ (2 Ağu, founder)
FOLLOWER + FOLLOWING listeleri profilde PUBLIC 🔒 (Insta paraleli — follow zaten ayrıcalıksız olduğundan liste şeffaflığı zararsızdır; kimlikli dünyada "gizli takipçi" tuhaflığı olmaz). FRIENDS listesi DEFAULT GİZLİ 🔒 + sahibi isterse OPT-IN açar (⭐ toggle) — gerekçe: friends = yaşanmışlık haritasıdır (kiminle masaya oturduğunun türevi), adres defteri hassasiyetinde; açmak vitrine koymak isteyenin tercihi. Claude önerisi ⭐ (vanity freni): takipçi SAYACI profil başlığında büyük rozet olmasın — liste sayfasının içinde nötr dursun (takipçi-sayısı-statüsü Instagram hastalığıdır; listeler açık, sayı sahne almaz). [❓ KAPANDI 3 Ağu → E3.10: "request usulü" KAPALI-PROFİL içindi — açık hesapta follow ONAYSIZ 🔒, kapalı hesapta İSTEK+ONAY 🔒.]

## E3.10 — KAPALI PROFİL (2 Ağu — founder kararı: "kesinlikle olmalı"; LOCAL-usulü model)
Hesap iki modlu: AÇIK (default 🔒) / KAPALI (tercih). KAPALI'da: follow = İSTEK+ONAY 🔒 (request kutusu; ret sessiz) · profil detayı (açılmış memory'ler, rozetler, follower/following listeleri) yalnız ONAYLI takipçiye · yabancıya minimal kart: isim+@handle+"kapalı profil" · arama-görünürlüğü toggle'ı bu modun içine katlanır. AÇIK hesapta follow ONAYSIZ kalır 🔒 (E3.9 ❓ kapandı — "request usulü" kapalı-mod içindi). DEĞİŞMEZLER 🔒: MASA DÜNYASI privacy'den muaftır — kapalı hesap public masa kurar/katılır ve o masada adıyla görünür ("masaya çıkan masada görünür; kapalılık masadan muafiyet değildir"); forum/söz kimlikli; RS/friends zaten gizli; block/mute bağımsız işler. LW İSTİSNASI ⭐ (founder onayı bekler): kapalı hesap memory'yi tek-tık şehre açabilir (Claude önerisi: EVET — "kapalı profil, kapalı hayat değil"; hayır seçilirse memory'ler yalnız takipçi-Pulse'ında yaşar). Gerekçe kaydı: Insta-private kopyası değil — bizde Insta'nın gizledikleri zaten herkese gizli; bu mod yalnız İZLENME kontrolüdür (stalker/eski-sevgili Your-Pulse'tan hayat izleyemez), şehir arşivini boşaltmaz.

## E3.11 — PAYLAŞIM KATMANLARI FİNAL (2 Ağu — founder: "zaten böyleydi" ✓ doğrulandı)
Kontrol hükmü: üç-katman DOSYALARDA ZATEN VARDI (paylaşım ekranı "dardan genele": Window → +Your Pulse → +Local World; follow'un tek işlevi de buydu) — eksik olan resmi adlar ve alt-kurallardı, şimdi kapandı. RESMİ ADLAR: MASA (yalnız window) · ÇEVRE (window + Your Pulse: friends+takipçiler) · ŞEHİR (window + LW). ALT-KURALLAR: default seçim = MASA 🔒 (yukarı bilinçli tık — rıza mimarisi) · ÇEVRE'de etkileşim VAR 🔒 (▲/söz/echo — bilinçli açılan yüzey etkileşir) · ECHO SEVİYE YÜKSELTEMEZ 🔒: çevre-memory'si echo'yla şehre SIZAMAZ; echo sahibin seçtiği kapsamı asla aşamaz (kaldırtma hakkı her katmanda üstün) · KAPALI-PROFİL LW-İSTİSNASI 🔒 ONAYLANDI: kapalı hesap memory'yi tek-tık ŞEHİR'e açabilir ("kapalı profil, kapalı hayat değil") — LW canlılığı bilinçli istisnayla beslenir.

## E3.12 — 3 AĞU KÜÇÜK KARARLAR (fırın öncesi son dörtlü)
① KOMPAKT-BANT: kapalı başlar 🔒 (config-hazır ⭐ ×0.7 · ≤40 koltuk; aktivasyon pivot). ② EVENT GECE-GENELİ SORUSU: EVET 🔒 — sub'lı event'lerde FB ekranına tek ek soru "gece geneli nasıldı" (son-sub RQ'su masayı, bu soru geceyi ölçer); chip=TEK launch'ta aynen 🔒, founder-kararsızlık pivot maddesine yazıldı (MAX_CHIP_SELECT band 1-3). ③ TAKİPÇİ SAYACI: LİSTE-İÇİ 🔒 — profilde yalnız "Takipçiler ›" satırı (sayısız); sayı liste sayfasının tepesinde (vanity-metric sahneye çıkmaz — anti-Instagram imza). ④ VEN-EVENT: özellik yaşıyor teyidi; yalnız aylık-tavan değerleri bilinçli-boş ⭐ (pivot).
