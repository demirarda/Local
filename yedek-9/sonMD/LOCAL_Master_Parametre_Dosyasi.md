# LOCAL — MASTER PARAMETRE DOSYASI (tüm sistemler, tüm değerler)
**Ne:** Uygulamadaki TÜM sayısal parametre ve bileşenlerin tek referansı — gamification, RS, venue Trust/Aura, cezalar, ekonomi, UI. Anayasa "neden"i anlatır; bu dosya "kaç"ı listeler.
**Kural:** ⭐ = kalibre edilebilir (config'te yaşar, Aras izleme protokolüne tabi) · 🔒 = yapısal sabit (değişimi founder + sistem revizyonu ister) · 🔓 = değer henüz açık (stub)

## 1 — RS MOTORU (kişi skoru)
| Parametre | Değer | Ne kontrol eder |
|---|---|---|
| Başlangıç RS | 5.00 🔒 | herkesin doğum skoru |
| Skor aralığı | 1.00–10.00 🔒 | taban/tavan |
| W_AIS / W_IQ / W_CF / W_MB | 0.25 / 0.30 / 0.15 / 0.05 ⭐ | bileşen ağırlıkları (P) |
| W_IF | 0.20 ⭐ | sürtünme düşümü (T = P − 0.20·IF) |
| Nötr çizgi | 0.50 🔒 | kazanç/kayıp sınırı |
| K_UP / K_DOWN | 0.15 / 0.30 ⭐ | asimetri — kötü 2× hızlı işler |
| CAP_POS / CAP_NEG | +0.12 / −0.15 ⭐ | tek-ritüel tavanları |
| No-show bypass tavanı | −0.20 ⭐ | "hiç gelmemek en kötü gelmekten kötü" |
| CF bileşimi | 0.65·peerQ2 + 0.35·R1 ⭐ | uyum skorunun içi |
| CONF karışımı | n=1→%60 nötr ⭐ (FOUNDER KARARI: ×0.40 — "bir tanık > hiç tanık"; eski %75 ters sıralama üretiyordu, simülasyonda yeniden test) · n=2→%25 · n≥3→ham ⭐ | tek-rater manipülasyon freni |
| BC çarpanları | ödül ×1.25 · tek-kötü sönüm ×0.70 · kötü-trend ×1.35 ⭐ | tutarlılık |
| MD (yeni kullanıcı freni) | ilk 12 ritüel ×0.50→×1.00 kademeli ⭐ | hızlı uçuş/batış engeli |
| BR eşikleri | 8.0 üstü yükseliş yavaş · 3.0 altı düşüş yavaş ⭐ | uç frenleri |

## 2 — CHECK-IN / KAPI / KOD
| Parametre | Değer | Ne kontrol eder |
|---|---|---|
| GPS radius | Free 30m · Venue 50m · Zone 75-100m · hareketli 15m ⭐ | konum kilidi |
| RITUAL MIN SÜRE | 30 dk 🔒 (ilk günden kilitli karar — RESTORASYON: dosyalara yazılmamıştı; clamp tabanları buna göre tasarlandı) | 30dk altı masa açılamaz |
| Kapı süresi | duration×%20, clamp(10dk, 60dk) ⭐ | geç kalma penceresi |
| AIS dilimleri | ilk %60 → 1.00 · son %40 → 0.85 ⭐ | zamanındalık notu |
| AIS_MANUAL | KALDIRILDI ♻️ 30 Tem | host kimseyi mühürleyemez — tek yol PENDING_WITNESS |
| KOD | 3 hane (100-999) 🔒 · İLK MÜHÜRLE doğar (ilk gelen açar — host imtiyazsız) 🔒 · statik ritüel-kodu, prelobby'de görünmez | üçüncü kilit |
| MASA AÇILDI anonsu | İLK MÜHÜRDE otomatik: push + prelobby kartı + venue sinyali · açanın konum notu (open_note) ⭐ | "hangi masa?" çözümü |
| Join kuralı | kilit=yalnız ayrılış; JOIN kapıya dek açık 🔒 · kilit-sonrası join grace'siz (anında söz) 🔒 · planners_only toggle ⭐ default kapalı | söz kilidi / masa mührü ayrımı |
| PENDING_WITNESS | kod✓+GPS-arıza/şüphe → şeritte tanık onayı (herhangi mühürlü; personel HARİÇ 🔒) · eşik AKTİF=LEGACY_2_TIER 🔒: ≤3→1 / ≥4→2 ⭐ (3-kademe config KAPALI — FUTURE_3_TIER_ENABLED=false; yalnız founder/pivot açar) · grace kapı+10dk ⭐ · AIS deneme anından 🔒 · onaysız=otomatik no-show YOK (MOD dosyası) 🔒 | arıza kişiyi yakmaz, trolü insan eler |
| Konuşma açılışı | masa konuşması KİLİTTE açılır 🔒 · host_broadcast her zaman 🔒 | kadro sabit = kanal açık |
| Kod çakışma yarıçapı | 500m ⭐ | yakın aktif ritüeller aynı kodu alamaz |
| Kod giriş denemesi | 3 deneme → 30sn bekleme ⭐ | brute-force freni |
| [ESCROW ÖLDÜ] | ilk-gelen-açar kuralı emanet zincirini gereksizleştirdi ♻️ | — |
| Instant tanımı | start ≤ create+2h ⭐ (band 1-3h) | ötesi Planned |
| Tek-masa kapasitesi ♻️v3 | kategori-önerisi SOFT ⭐ (aşılabilir, nazik uyarı) · MUTLAK 40 🔒 · üstü event_group/venue-beyan · rol-slot ⭐ raf | sohbet fiziği vs aktivite fiziği |
| Window kapanış seti | [3/6/12/24h] ⭐ · default 12 | founder: min 3 |
| K1 çakışma yasağı | taahhütler zaman-çakışamaz 🔒 · event=tek söz 🔒 | aynı beden iki masada olamaz |
| K2 join buffer | 0dk ⭐ (band 0-30) | geç-kalma cezası işi organik yapar |
| K3 günlük söz tavanı | 4 ⭐ (band 3-6) · yalnız ileri-tarihli 🔒 · ≤30dk join+Instant-kurma MUAF ⭐ · leave iadeli | yer-spam önleme |
| K4 gir-çık | aynı ritüele 1 join/gün ⭐ · günlük leave MOD-sinyali 6 ⭐ (otomatik ceza yok) | oyun kapama |
| Walk-in | SINIRSIZ 🔒 ♻️M1 (eski paket-tavanı öldü) · origin alanı 🔒 · fren: fizik+mekan iradesi+[yer veremedik] | slot≠walk-in; hayat bedava |
| Self-rez v2 ♻️M2 | HER MEKANDA BEDAVA · mekan işaretlemeden ölü 🔒 · işaretlenince DEFAULT MOD=ANINDA ⚡ · ONAYLI ⏳ opt-in · ince-ayar (saat/zon/kitle kuralları) PAKETLİ ⭐ · kişi 1/gün/mekan ⭐ | dijital bekçi yok |
| İstek kotası | 2 bekleyen/mekan ⭐ (band 1-3) · 5/gün ⭐ · fiziksel istek 📍 panelde üstte 🔒 | öneri kutusu |
| Buradayım bileti | TTL 90dk ⭐ (band 30-90) · salt UX, YETKİ SIFIR 🔒 · logout'ta ölür | totem 3-hal kapısı |
| Tag (LOCAL-TAG) | 30sn tek-kullanım 🔒 · yalnız mühürlüden, fiziksel yakınlıkta | dijital yollama yasak |
| Event kod yasağı | ≥100 kişi ⭐ → yalnız totem/personel noktaları | kod ölçek sınırı |
| Tarifeli-zone kapısı | min(formül, kalkış+5dk) ⭐ | vapur gerçeği |
| Totem | mekan başına min 1 (kasa/giriş) 🔒 · masa totemi Operatör+/event-set ⭐ · 3-hal akışı 🔒 | fiziksel kapı |
| GPS mesafe logu | check-in'de gps_distance_m kaydı 🔒 · sınır-deseni eşiği ⭐ | "hep radius sınırı + sıfır memory" MOD sinyali |
| Grace (join sonrası) | ~10dk ⭐ | cezasız çıkış + exact-detay kilidi |

## 3 — KİLİT-ANI & CEZALAR
| Parametre | Değer | Ne kontrol eder |
|---|---|---|
| KİLİT-ANI | start − duration×%25, clamp(15dk, 3h) ⭐ | "söz kesinleşme" anı |
| Late-cancel | 1:uyarı · 2:−0.06 · 3:−0.10 · 4+:−0.15 ⭐ | kilitten sonra, yerine kimse yok |
| No-show RS | 1:−0.08 · 2:−0.15 · 3+:−0.20 ⭐ | 30g pencere |
| No-show askı | 3.'ten itibaren 3h→6h→12h→24h ⭐ | iz bırakamama |
| Host-ban | uyarı+3h → 24h → 48h → 1 hafta ⭐ | host no-show merdiveni |
| Ceza penceresi | 30 gün rolling ⭐ | sayaç ömrü |

## 4 — IF (sürtünme)
| Parametre | Değer |
|---|---|
| Geç-dilim izi | 0.25 ⭐ |
| Boş feedback görevi (EMPTY_FB_IF) | 0.30 ⭐ (görev yalnız FL1/FL2 rater varsa doğar) |

## 5 — FL & FEEDBACK
| Parametre | Değer |
|---|---|
| FL eşikleri | FL1: 1-3 fb · FL2: 4-7 · FL3: 8+ ⭐ (sayaç İLK feedback'ten) |
| FL tazeliği | 12 ay ⭐ |
| FB ağırlıkları | FL1 1.0 · FL2 0.5 · FL3 0.0 🔒 (kanka torpili kapalı) |
| FB penceresi | max(window kapanışı, duration+12h) ⭐ |
| FB değerleri | 🟢1.0 · 🟡0.5 · 🔴0.0 🔒 |
| Sorular | RQ(herkes) · Q1+Q2(arkadaşa) · P2H(host'a) · R1(self) · P2V(venue'de herkes) 🔒 |

## 6 — DS (çeşitlilik — tamamen private)
| Parametre | Değer |
|---|---|
| Pencere | son 5 ritüel ⭐ · EMA alpha 0.30 ⭐ |
| RS çarpan aralığı | 0.45 – 1.20 ⭐ |
| İç ağırlıklar | PD 0.60 · CtxD 0.30 · VD 0.10 ⭐ |
| FL kişi-ağırlıkları | non-FL 1.00 · FL1 0.85 · FL2 0.55 · FL3 0.20 ⭐ (Regular-ağırlığı KALDIRILDI — mekan tekrarı VD/CtxD kanalında; çifte sayım yok) |
| Tier eşikleri | Homebody→Voyager bantları ⭐ (UI) |

## 7 — NO-PEER PATH (ürün dilinde “Solo Ritualist”)
| Parametre | Değer |
|---|---|
| NO_PEER_DAMPENER | 0.35 ⭐ (0.50'den sertleşti) |
| NO_PEER_CEILING | 7.5 ⭐ — peer-fb'siz geçilemez; tavanda pozitif=0, negatif işler; ilk peer-fb'de kalkar 🔒 |
| CF_SELF_NO_PEER_W | 0.50 ⭐ |
| NO_PEER_ENGAGEMENT | pozitif delta şartı: R1 VEYA memory 🔒 |

## 8 — MODERASYON (MOD-ENGINE)
| Parametre | Değer |
|---|---|
| L2a / L2b | 72h açamama ⭐ / 7g açamama + 30g Free-yasağı ⭐ |
| L3 | RS −0.15 baz, −0.30 tavan ⭐ + 30g tam askı ⭐ |
| L4 | kalıcı ban + identity_hash kara-liste 🔒 · extreme vakalar doğrudan L4 🔒 |
| SLA | güvenlik 2h · içerik 12h · genel 48h ⭐ |
| L1 paket eşiği | 🔓 (korelasyon puanı formülü prova'da kalibre) |
| Onay yapısı | L0-L1 tek göz · L2 four-eyes · L3-L4 çift bağımsız + founder 🔒 |
| MOD-BYPASS | ham rapor RS'e asla 🔒 · tek kuyruk 🔒 · itiraz: kararı-vermeyen göz 🔒 |
| Konum-paylaş süresi | canlı 1h default ⭐, max ritüel süresi |
| Sessiz-çıkış pattern eşiği | 2-3 / 30g ⭐ (inceleme tetiği) |

## 9 — VENUE MOTORU (Trust/Aura)
| Parametre | Değer |
|---|---|
| VEN-4 K | 3 ⭐ |
| Prior | HESAP 0-1 UZAYINDA: prior_internal 0.50 cold-start → kategori ortalamasına (≥35 ritüelde) ⭐ · GÖSTERİM ×10 (ölçek-birimi hatası kapalı) |
| Pencere | 90 gün kayan ⭐ |
| Etiket | yeni <2 · oturuyor 2-9 · oturmuş ≥10 ⭐ (park: n≥5+tutarlılık ikinci kapısı) |
| Skor gösterim tabanı | MIN_DISPLAY_N: 5 🔒 ♻️ (founder-onaylı) — public sayı 5. gözlemde; öncesi "yeni/oturuyor" etiketi; mekan kendi panelinde gün-1'den görür |
| Gözlem katılım tabanı | MIN_ANSWERS_PER_OBS: 2 ⭐ — soru tipi BAŞINA ayrı (1 P2V + 4 RQ → Aura yazar, Trust yazmaz); eşik altı chip yine yaşar |
| Tekrar-rater sönümü | REPEAT_RATER_W: 1. ×1.00 · 2.-3. ×0.50 · 4.+ ×0.25 ⭐ (aynı kullanıcı→aynı mekan, 90g kayan; Trust VE Aura; sayaç pencereden kendiliğinden tazelenir) — sabotaj + müdavim-şişirmesi tek kuralla kapalı |
| Dağılım | tentative <3 instance ⭐ · toplam <5 ritüelde gizli ⭐ · küçük yüzdeler yazılır ("+diğer") |
| Chip kırılımı gizliliği | n≥10 chip'e kadar gizli ⭐ |
| Birim | 1 ritüel = 1 gözlem (rater değil) 🔒 |
| VEN-5 / VEN-6 | kullanıcı korunur-venue açık · venue skoru RS'e asla 🔒 |

## 10 — REGULAR
| Parametre | Değer |
|---|---|
| N | 4 check-in'li ritüel ⭐ / 45 gün ⭐ (founder: ~11 günde bir = gerçek müdavim) · sönüm: son katılımdan 60g ⭐ · bildirimsiz düşüş 🔒 |
| Görünürlük | private 🔒 · mekan kendi listesini görür · vitrin toggle default KAPALI ⭐ |
| Geri sayım UI | "3/4" göstergesi açık ⭐ |
| Venue-badge eşiği | MEKAN-TANIMLI (badge'in kendi gereksinimi; koşul tipleri: geliş/kategori/slot/etkinlik · admin onay · max 5) 🔒 |

## 11 — ZONE / SPARK
| Parametre | Değer |
|---|---|
| SPARK_ENABLED | false (post-v1 flag) |
| SPARK min | 3 🔒 (dolmadan ritüel doğmaz, ekleşme kalır) |
| Badge sinyali | ritüel 3p · marker okutma 1p ⭐ |
| Zone skoru | Aura VAR, Trust YOK 🔒 · hakimiyet dağılımı serbest rekabet 🔒 |

## 12 — EKONOMİ
| Parametre | Değer |
|---|---|
| Paketler | FREE ₺0 · OPERATÖR ₺7.900 ⭐ (6.9-9.9K / €199) · HAKİM ₺19.900 ⭐ (16.9-24.9K / €499) |
| Slot hakları | Free 1/ay devretmez ⭐ · Operatör 3 eşzamanlı ⭐ · Hakim 5 ⭐ (ritüel sayısı sınırsız 🔒) |
| Kompakt bant | ≤40 koltuk ×0.7 🔓 (founder onayı) |
| Add-on | ek slot ~₺2K/ay ⭐ · Takeover formülü 🔓 (öneri: paket-%'si × gün-tipi: hafta içi %30 / sonu %50) · etkinlik kartı ⭐ |
| Hakim içerikleri | Pazar Payı + Bölge Radarı + Anonim Benchmark + AI rapor + ayda 1 Takeover + brand-slot önceliği |
| Monetizasyon tetiği | mekan-başına: N ritüel + X check-in + ölü-gün Δ% 🔓 (prova kalibresi) |
| Öneri kutusu | 1 bekleyen/mekan 🔒 · günlük toplam 5 ⭐ · 24h-kala expire 🔒 |
| Satılmazlar | skor · sıralama · güven işareti · paralı-etiket 🔒 |

## 13 — KİMLİK KAPISI
| Parametre | Değer |
|---|---|
| Şeritler | üni-mail VEYA resmi kimlik (TCKK/pasaport/AB-kimlik) 🔒 |
| Akış hedefi | ≤60sn ⭐, ömürde bir kez · NFC birincil, OCR+selfie fallback 🔒 |
| Saklama | doğrula-ve-at: verified/18+ bayrak + identity_hash 🔒 — ham veri asla |
| Sağlayıcı | 🔓 (Techsign/İHS teklif turu) |
| Üni etiketi | 🎓 default AÇIK ⭐ (kapatılabilir) · kimlik-yolunda alan yok 🔒 |
| Yaş kapısı | 18+ 🔒 |

## 14 — MEMORY / GÖRSEL / UI
| Parametre | Değer |
|---|---|
| Kaynak | in-app kamera only · galeri kapalı · filtre yok 🔒 |
| Damga | {ritual, tarih, konum} — silinemez 🔒 |
| Pulse tazeliği | captured_at son 24h ⭐ (retro yayın Pulse'a düşmez 🔒) |
| Video | max 45sn ⭐ (bant 30-60) |
| Rulo | taslak ölmez 🔒 · yalnız sahibine 🔒 · retro yayın hep damgayla 🔒 |
| Paylaşım katmanları | Window → +Your Pulse → +Local World ("dardan genele") 🔒 · Solo yüzey/scope yok |
| Buton satırı | ▲ sayılı · ▼ sayılı · Söz · Echo 🔒 · oy kimlikleri anonim |
| Yankı | 24h yaşar-söner · arşive girmez (PASSPORT-PURE) 🔒 |
| Nabız bantları | ~%40 / %70 renk eşikleri ⭐ · kelimesiz 🔒 · "%· kişi" çifti 🔒 |
| Ritüel-içi sıralama | etkileşim karması ⭐ |
| Chip mekaniği | tek-seçim ⭐ · rotasyon açık ⭐ · route kolonu 🔒 |
| Müzik | link-out v1 🔒 · MUSIC_SDK v1.5 flag 🔓 |
| Yorumlar | text-only 🔒 |

## 15 — BİLDİRİM
| Parametre | Değer |
|---|---|
| Model | sinyal→yüzey→push 3-katman 🔒 · push: doğrudan-ilgili VEYA zil 🔒 |
| Zil | venue/zone/kişi profillerinde 🔒 |
| Push default listesi | 🔓 (launch haftası founder temizliği) |
| Downvote | asla push edilmez, sayısı gösterilmez 🔒 |
| Upvote sinyal eşiği | "10+" toplu ⭐ |

## 16 — BÜYÜME EŞİKLERİ (Faz tetikleri)
| Sinyal | Sağlıklı bant ⭐ |
|---|---|
| Haftalık ritüel (küme içi) | ≥50 → sonraki halka |
| Tekrar-katılım (30g) | ≥%40 |
| No-show oranı | <%15 |
| Feedback tamamlanma | >%40 |
| RS kitle merkezi (30g) | 5.0 ± 0.5 |
| Yeni venue oturma süresi | 1-3 hafta |
| SPARK 3'e-ulaşma | >%30 (açıldığında) |
| 🟡-chip kullanım oranı | ölü chip yok |

**Kalibrasyon protokolü (değişmez):** sinyal → analiz/simülasyon → Aras tek-sayfa önerisi → founder onayı → config değişikliği (kod değişmez) → 2-4 hafta izleme.


## §2C — 27 TEM EK SATIRLARI
| Parametre | Değer | Not |
|---|---|---|
| Username/isim değişimi | 90g/1 ⭐ | @ silik, isim birincil; rezervasyon listesi |
| İleri-tarih ufku | şahıs 21g ⭐ (14-30) · VEN/kurum-event 60g ⭐ · Series muaf · venue rafı ufuksuz | söz enflasyonu freni |
| Series kurulum | haftalık/2-haftalık × N/süresiz ⭐ · instance boş doğar 🔒 · 🔔 takip ⭐ · gezen-pin kilide dek ⭐ | ardışık-blok=event_group |
| Ritüel görünürlüğü | PUBLIC / FRIENDS(FL) ⭐ | şahıs "çevre masası" |
| Fee beyanı | yapılandırılmış alan ⭐ · para LOCAL dışı 🔒 · [ücret sürpriziydi] chip | Tickets Faz2: onaylı satıcı ⭐, bilet=devredilemez mühür |
| Kaldırtma hakkı | mutlak 🔒 · rıza kuyruğu öncelikli · paylaşım sessiz, opt-in bildirim ⭐ (default kapalı) | quote: sahibi siler 🔒 |
| Venue-lead radarı | aynı pine 3 tekrar ⭐ → ops lead | organik venue satışı |
| Badge yaratma | sistem+venue only 🔒 | org/user yaratamaz |

## §2D — 28 TEM SATIRLARI
| Parametre | Değer | Not |
|---|---|---|
| Doğum-iptali | Instant ilk 10dk ⭐ + yalnız kuran mührü → [vazgeç] cezasız | sessiz silinme |
| [Yer veremedik] | panel tek-tık 🔒 → sessiz iptal + nötr yönlendirme | beşeri hamle ~0 |
| Venue-kanal tanımı | raf/istek/self-rez/VEN-EVENT'ten doğan=venue 🔒; dışı=custom · [sahiplen] ⭐ | skor kirlenmez |
| VEN-EVENT aylık tavan | ⭐ AÇIK — değer BOŞ (pivot sonrası) | ilke: keşif çöplüğü olmasın |
| Canlı okuma | yalnız şeffaf masa 🔒 · 👁 anonim sayı · canlı masaya dış yazı ASLA 🔒 | LW'ye açılan içerikte canlı/bitmiş fark etmeden ▲▼+Söz+Echo; whole-window forumu yalnız bitmiş+açık |
| LW-Pulse ağırlıkları | yer .30 · mesafe .20 · kategori .20 · sosyal-eko .20 · pop .10 (tavanlı) ⭐ | kalibre-1 konusu |

## §2E — KAPASİTE & CHIP SATIRLARI (28 Tem)
| Parametre | Değer | Not |
|---|---|---|
| Kategori bantları | 14 launch kategorisi ⭐ (E2.7 listesi) · DİĞER=3-12 | şablon-dışı sayı girilemez |
| Mutlak tek-masa | 40 🔒 | 41+ event_group / venue-beyan |
| Event_group | köşe cap 12 ⭐ · köşe sayısı max 8 ⭐ | ~96 fiili tavan |
| Zone-event yetkisi | launch: founder/elçi/kulüp ⭐ → Faz-2 sicil-eşikli | asayiş omuzu şartı |
| Chip seçimi | TEK 🔒 ♻️30Tem · opsiyonel · skora girmez 🔒 · renk-duyarlı setler (E2.8) | [tanım yanılttı]/[ücret sürpriziydi] MOD-eşikli 3/90g ⭐ |

| Solo yüzeyleri | YOK 🔒 — Solo mode/Window/scope yok; “Solo Ritualist” yalnız `NO_PEER_PATH` ürün dili | özellik/ritüel tipi değil |
| RS görünürlüğü | default OFF 🔒 · opt-in toggle (profil) · halka/bant render ⭐ · değişim 30g/1 ⭐ · sıralamaya etki SIFIR 🔒 | pusula cepte, boyna asmak tercih |

## §2F — 30 TEM SATIRLARI
| Parametre | Değer | Not |
|---|---|---|
| Kapasite v3 | soft kategori-önerisi ⭐ · MUTLAK 40 🔒 · 41+=event_group · rol-slot ⭐ raf | sert yasak öldü |
| Chip | renk→tek opsiyonel sebep 🔒 · RQ 3/renk · P2V 5/renk · top-chip min-N: ritüel 3 farklı cevap, venue 10 cevap ⭐ | kişi geçmişi ritüel özeti; skora asla |
| Etkileşim | ▲▼+Söz+Echo 🔒 · like yok · oy kimlikleri ANONİM · iki sayaç da görünür · mutable/tek yön · self-vote serbest · ▼ push/RS/mod yok | koordineli-▼ dedektörü |
| Mention | aynı-ritüel mühürlü + thread katılımcısı + host/organizer + ilgili venue/zone/Series · Friends tek başına yetmez · self-remove · izin (masa/friends/hiç) | bildirim-merkezi kesin |
| Host / collaborator | manuel onay yok · tek-masada devir yok · Series devri açık onaylı · collaborator yalnız Series/event_group/venue event, operasyonel ve güçsüz | mühür/tanık/RS/FB/MOD yetkisi yok |
| RS halka | monokrom/opaklık 🔒 · min 10 ritüel ⭐ · toggle 30g ⭐ · sıralama etkisi 0 🔒 | trafik lambası yasak |

## §2G — 31 TEM SOSYAL SATIRLAR
| DM | launch YOK 🔒 → F1.5 Friends-only | cold-DM asla |
| Reaction | 🤝 😂 🙌 👀 💡 ❓ · 1/kişi/mesaj · değiştirilebilir · ▲▼ konuşmada asla 🔒 | final set |
| Quiet hours | 01-09 ⭐ · kendi-masan-deler istisnası ⭐ · digest haftalık default AÇIK, kapatılabilir ⭐ | fiziksel fırsat özeti; guilt-push yok |
| Unfriend | FL tarihçesi kalır · re-friend aynı seviyeden 🔒 | tekrar-kasma önlemi |
| Pre-lock edit | başlık/tanım/kapasite-artır serbest (anonslu) · zaman+pin asla · düşürme yasak 🔒 | kilit sonrası donuk |
| Erteleme | YOK 🔒 (iptal+yeniden) | WEATHER_CANCEL KAPANDI 🔒: açık-hava kategorileri ⭐ + start−3h ⭐ cezasız host-iptali; kanıtsız (beyan); sık-kullanım MOD-desen → BUILD EDİLİR |
| Hesap silme | başkalarının anısı kalır · vitrinden düşer, window-arşiv yaşar · "eski üye" 🔒 | |
| Waitlist | F1.5 park 🔒 | boşalınca 15dk öncelik ⭐ |
| UNDER_MIN | private-iz only 🔒: RS/RQ/P2V/Regular/badge/top-chip ÜRETMEZ · 0-mühür=iz yok | iki kişilik kasma yapısal ölü |
| Block | içerik duvarı · JOIN SERBEST · blocklayana tek yönlü uyarı · co-presence anında FB-eligibility snapshot; sonraki block hakkı silmez | kırmızı FB + block birlikte mümkün; kaçış yok |
| Mesaj düzenleme | 5 dakika 🔒 · “düzenlendi” etiketi | silme her zaman, “silindi” izi |
| Save | private pointer · ranking/RS etkisi 0 · kaynak silinirse/takedown olursa preview kapanır | kopya değildir |
| Ghost | özellik/ayar yok 🔒 | online/last-seen zaten yok |

| Find-us notu | ≤60ch ⭐ · R-öncesi kuran · canlıda mühürlüler (son-yazan+iz) · dış-dünya yazamaz 🔒 · kapıda donar | pin=çapa, not=tarif |
| Portal seti | default KİMLİKSİZ çoklu-erişim (kuyruk-önleme) · köşe-adlandırma OPT-IN ⭐ yalnız odalı/kulüp (multi-room flag) · Free=1 totem, set paketli ⭐ | founder netleşmesi 2 Ağu |

| Graf görünürlüğü | follower/following listeleri PUBLIC 🔒 · friends default GİZLİ + opt-in ⭐ · sayaç LİSTE-İÇİ 🔒 (3 Ağu — başlıkta sayı yok) · follow: açık-hesapta onaysız 🔒 · kapalı-hesapta istek+onay 🔒 (E3.10 kapandı) | 2 Ağu |

| Kapalı profil | default AÇIK 🔒 · kapalıda follow=istek+onay 🔒 · profil detayı takipçiye · masa dünyası MUAF 🔒 · LW tek-tık istisnası ⭐ | Insta-kopyası değil: izlenme kontrolü |
| Paylaşım katmanları | MASA/ÇEVRE/ŞEHİR 🔒 · default MASA 🔒 · çevre-etkileşim var 🔒 · echo kapsam-yükseltemez 🔒 · closed_lw_exception=true 🔒 | 'zaten böyleydi' ✓ |
