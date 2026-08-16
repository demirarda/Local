# LOCAL — ⭐ PARAMETRE LİSTESİ (İKİ BÖLÜM: KURAL/UX × ALGORİTMA)
**Amaç:** Founder'ın tek bakışta gözden geçireceği kalibre listesi. ⭐ = config'te yaşar, prova kalibresine tabi · 🔒 = yapısal sabit. Değerler Master Parametre ile senkron — çelişki görürsen Master kazanır, buraya not düş.

---

# BÖLÜM A — KURAL & KULLANICI DENEYİMİ EŞİKLERİ (davranış kapıları)

## A1. Söz ekonomisi (spam/işgal önleme)
| Parametre | Değer | Band | Ne işe yarar |
|---|---|---|---|
| K1 çakışma yasağı | taahhütler zaman-çakışamaz | 🔒 | aynı beden iki masada olamaz; event=tek söz |
| K2 JOIN_BUFFER_MIN | 0 dk ⭐ | 0-30 | ardışık masalar serbest; geç-kalma cezası freni organik |
| K3 DAILY_COMMIT_CAP | 4/gün ⭐ | 3-6 | yalnız İLERİ-TARİHLİ taahhüt sayar 🔒; yer-spam kapısı |
| K3 muafiyet LATE_JOIN_EXEMPT | ≤30dk ⭐ | 15-60 | "kapıdan girmek söz değil" — spontane join+Instant-kurma tavana girmez |
| K4 aynı ritüele join | 1/gün ⭐ | 1-2 | join-leave-join oyunu kapalı |
| K4 günlük leave MOD-sinyali | 6 ⭐ | 4-10 | otomatik ceza YOK — desen dosyası |
| Leave iadesi | kilit-öncesi hak geri döner 🔒 | — | bedava ayrılık korunur |

## A2. Ritüel yapı sınırları
| Parametre | Değer | Band | Ne işe yarar |
|---|---|---|---|
| MIN_DURATION | 30 dk 🔒 | — | ilk günden karar; clamp'ler bu tabana göre |
| Min masa | 3 kişi 🔒 | — | 1-2 kişilik "ritüel" yok |
| INSTANT_MAX_LEAD | start ≤ +2h ⭐ | 1-3h | ötesi Planned |
| TEK-MASA KAPASİTE ♻️v3 | kategori-önerisi soft ⭐ · MUTLAK 40 🔒 | — | şablon tablosu E2.7; üstü event_group |
| Window kapanış seti | [3/6/12/24h] ⭐ · default 12 | — | founder: min 3 restore |
| Kilit | start−%25, clamp 15dk-3h ⭐ | — | söz kilidi; konuşma açılışı |
| Kapı | start+%20, clamp 10-60dk ⭐ | — | check-in + alım kapanışı; UI hep mutlak saat 🔒 |
| Pin | DEĞİŞMEZ 🔒 | — | host: iptal veya radius-içi not |
| Planners-only toggle | default KAPALI ⭐ | — | host alımı kilitte kapatabilir |

## A3. Check-in kapısı & tanıklık
| Parametre | Değer | Band | Ne işe yarar |
|---|---|---|---|
| GPS radius | custom 30m · venue 50m · zone 75-100m · hareketli 15m ⭐ | — | ① kaba filtre |
| WITNESS_THRESHOLD | mühürlü ≤3→1 · ≥4→2 ⭐ (pending anında kilitlenir 🔒) | — | tanık eşiği |
| PENDING_GRACE | kapı+10dk ⭐ | 5-15 | deneme kapı-içiyse onay penceresi; AIS deneme anından 🔒 |
| T3 sınır-deseni tetiği | KAPALI ⭐ (opsiyon) | — | gps_distance_m deseni pending'e düşürebilir |
| Tanık kimliği | herhangi mühürlü (host dahil) 🔒 · venue personeli HARİÇ 🔒 | — | güç ayrılığı |
| Kod | 3 hane, ritüel-başına statik 🔒 · 3 deneme · 500m çakışma | — | dönen/kişisel kod RED |
| TAG_TTL | 30 sn 🔒 · tek kullanım | — | LOCAL-TAG ömrü |
| EVENT_CODE_BAN | ≥100 kişi ⭐ | 50-200 | büyük event'te kod yasak — totem/personel noktaları |
| Tarifeli-zone kapısı | min(formül, kalkış+5dk) ⭐ | — | vapur gerçeği |
| Hareketli çapa devri | açan offline → sıradaki mühürlü ⭐ | — | rota ölmez |

## A4. Venue ilişki katmanı (mekan-kitle yönetimi)
| Parametre | Değer | Band | Ne işe yarar |
|---|---|---|---|
| Slot kapasitesi (eşzamanlı) | Free 1 · Operatör 3 · Hakim 5 🔒 | — | planlı takvim kabı |
| WALK-IN | SINIRSIZ 🔒 ♻️M1 | — | fren: fizik + mekan iradesi + [yer veremedik] ⭐ |
| Self-rez v2 ♻️M2 | bedava · default mod ANINDA ⚡ · ONAYLI opt-in · ince-ayar paketli ⭐ | — | kişi 1/gün/mekan ⭐ aynen |
| Self-rez kişi limiti | 1/gün/mekan ⭐ | 1-2 | spam freni |
| İstek kotası | bekleyen 2/mekan ⭐ (1-3) · 5/gün ⭐ | — | öneri kutusu |
| Fiziksel istek 📍 | GPS-rozetli, panelde üstte 🔒 | — | yüz-yüze-dijital rez |
| Cevapsız-istek sayacı | panelde görünür ⭐ | — | mekanın kaçırdığı masa — upgrade motoru |
| Buradayım bileti | 90 dk ⭐ (30-90) · YETKİ SIFIR 🔒 | — | totem 3-hal; salt UX |
| Totem | mekan başına min 1 🔒 · masa totemi Op+/event-set ⭐ | — | fiziksel kapı |
| Regular | 4 check-in'li ritüel / 45g ⭐ · sönüm 60g ⭐ · walk-in/VEN-EVENT sayılır 🔒 | — | müdavimlik (gamification kapısı — bilinçli olarak A'da: davranış kuralı) |

## A5. Bildirim/görünürlük (mevcut kilitli değerler — referans)
Nötr kapanış kartı 🔒 · şeritte tek durum (MÜHÜRLÜ=GELDİ) 🔒 · kod prelobby'de görünmez 🔒 · dışarıya sayı-yalnız 🔒 · konum notu iç katman 🔒

---

# BÖLÜM B — ALGORİTMA PARAMETRELERİ (skor motorları)

## B1. Kişi-RS pipeline (v3.1 — bu chatte DOKUNULMADI, referans)
| Parametre | Değer |
|---|---|
| P ağırlıkları | 0.25·AIS + 0.30·IQ + 0.15·CF + 0.05·MB (bant 0..0.75) 🔒 |
| T | P − 0.20·IF 🔒 |
| K (öğrenme hızı) | yukarı 0.15 · aşağı 0.30 ⭐ |
| Gün-cap | +0.12 / −0.15 ⭐ |
| CONF | n=1 → %60 nötr ⭐ · n=2 → %25 · n≥3 ham |
| No-peer dampener | 0.35 + NO_PEER_CEILING 7.5 ⭐ |
| AIS dilimleri | kapının ilk %60'ı 1.00 · son %40 0.85 ⭐ · saat=① deneme anı 🔒 |
| Pipeline sırası | Δ→CONF→DS→BC→MD→BR→CAP 🔒 |
| FL feedback ağırlıkları | 1.0 / 0.5 / 0.0 (FL3 kanka=0) 🔒 |
| Geri kalanı (IF değerleri, BC/MD/BR eşikleri, late-cancel merdiveni) | Master §3-5'teki değerler AYNEN — bu turda değişmedi |

## B2. DS (çeşitlilik)
| Parametre | Değer |
|---|---|
| Çarpan bandı | 0.45 – 1.20 ⭐ (izleme: alt uç kanka-kültürüne sert mi → 0.55 adayı) |
| EMA | son 5 ritüel, α 0.30 ⭐ |
| Eksen ağırlıkları | insan 0.60 · bağlam 0.30 · mekan 0.10 ⭐ |
| Kişi-ağırlığı | YALNIZ FL: 1.00/0.85/0.55/0.20 ⭐ — Regular-ağırlığı KALDIRILDI 🔒 |

## B3. Venue motoru (VEN-4 — bu chatte düzeltildi+simüle edildi)
| Parametre | Değer |
|---|---|
| Shrinkage | (n·ham + K·prior)/(n+K), K=3 ⭐ — HESAP 0-1 UZAYINDA 🔒, gösterim ×10 |
| Prior | 0.50 → kategori ort. (şehir-kategori ≥35 ritüelde ⭐, haftalık batch) |
| Pencere | 90g kayan 🔒 · 1 ritüel = 1 gözlem 🔒 |
| MIN_DISPLAY_N | 5 🔒 ♻️ founder-onaylı — public sayı 5. gözlemde; panel gün-1'den görür |
| MIN_ANSWERS_PER_OBS | 2 ⭐ — soru tipi başına AYRI (P2V/RQ bağımsız) |
| REPEAT_RATER_W | 1.×1.00 · 2.-3.×0.50 · 4.+×0.25 ⭐ (90g, Trust+Aura) |
| Etiketler | yeni <2 · oturuyor 2-9 · oturmuş ≥10 ⭐ · tentative <3 · dağılım gizli <5 · chip <10 |
| Zone-Aura | P2Z'den, aynı motor (Trust/panel yok) 🔒 |

## B4. Event-FB kesişme kuralları
| Parametre | Değer |
|---|---|
| Masadaşlık | aynı sub'da zaman-KESİŞMESİ 🔒 (süre filtresi YOK — süre yalnız liste sırası ⭐) |
| RQ kapsamı | son-sub ⭐ + EVENT gece-geneli tek soru EVET 🔒 (3 Ağu) · chip=1 launch 🔒, pivot maddesi: 2ye çıkarma değerlendirilir (band 1-3) |
| P2V/chip | main-bazlı herkes 🔒 · kişi-FB yalnız masadaşlar 🔒 |

---
**Kontrol notu:** Bu liste 4 ana kalpten türetildi; işleme sonrası tam senkron. Founder incelemesi → itiraz edilen satır Master'da güncellenir, burası aynalanır.


## A6 — 27 TEM EKLERİ (kural/UX)
USERNAME_CHANGE 90g ⭐ · NAME_CHANGE 90g ⭐ · PLANNED_MAX_AHEAD 21g ⭐ (14-30) · EVENT_MAX_AHEAD 60g ⭐ · SERIES takip-bildirimi ⭐ · gezen-Series pin-düzenleme (kilide dek) ⭐ · audience FRIENDS ⭐ · fee-beyan alanı ⭐ · opt-in "anım açıldı" bildirimi (default OFF) ⭐ · REPEAT_PIN_N 3 ⭐ (venue-lead) · LW hafif kişiselleştirme (bölge+kategori) ⭐ · kaldırtma hakkı 🔒 · quote-sahibi 🔒 · badge=sistem+venue 🔒

## A7 — 28 TEM EKONOMİ EKLERİ
WALK-IN sınırsız 🔒 · self-rez default ANINDA ⚡ · ince-ayar paketli ⭐ · BIRTH_CANCEL 10dk ⭐ · [yer veremedik] 🔒 · [sahiplen] ⭐ · VEN-EVENT aylık tavan ⭐ AÇIK(boş) · canlı-okuma=şeffaf-only + 👁 · canlı masaya dış yazı asla · LW'ye açılan içerikte anında ▲▼+Söz+Echo · LW-Pulse ağırlık seti ⭐

## A8 — KAPASİTE & CHIP (28 Tem)
14 kategori soft-önerisi ⭐ · mutlak masa 40 🔒 · köşe 12/8 ⭐ · zone-event yetki kilidi ⭐ · MAX_CHIP_SELECT 1 🔒 · RQ_OPTIONS_PER_COLOR 3 🔒 · P2V_OPTIONS_PER_COLOR 5 🔒 · TOP_CHIP_RITUAL_MIN_DISTINCT 3 ⭐ · TOP_CHIP_VENUE_MIN 10 ⭐ · chip MOD-eşiği 3/90g ⭐

RS_VISIBLE default OFF 🔒 · opt-in toggle · halka/bant ⭐ · RS_TOGGLE_D 30 ⭐ · sıralama etkisi 0 🔒 · Solo mode/Window/scope YOK; ürün dili “Solo Ritualist” yalnız NO_PEER_PATH

## A9 — 30 TEM
MUTLAK_KAPASITE 40 🔒 · soft-bant ⭐ · rol-slot ⭐(F1.5) · CHIP tek-seçim 🔒 · oy kimlikleri ANONİM 🔒 · ▲/▼ sayaçları görünür 🔒 · mutable tek-yön · self-vote serbest · ▼ push/RS/mod yok · MIN_RITUALS_FOR_RING 10 ⭐ · RS_TOGGLE 30g ⭐ · start−15 kod-doğumu · host-manuel ÖLÜ · collaborator yalnız Series/event_group/venue event, operasyonel

## A10 — 31 TEM
DM F1.5-friends 🔒 · reaction-set 🤝😂🙌👀💡❓ 🔒 · quiet 01-09 ⭐ + own-ritual-override ⭐ · digest haftalık default ON/kapatılabilir ⭐ · FL re-friend restore 🔒 · pre-lock-edit 🔒 · WEATHER_CANCEL 🔒 restore (açık-hava liste ⭐ · son-3h ⭐ · kanıtsız · MOD-desen) · silme-pipeline 🔒 · waitlist park 🔒 · block join-serbest+tek-yön bilgi · FB_ELIGIBILITY_SNAPSHOT co-presence anı 🔒 (block sonradan silemez) · mesaj-düzenleme 5dk 🔒 · save private-pointer 🔒 · Ghost yok 🔒

## A11 — DEFTER KAPANIŞI (1 Ağu)
MIN_DISPLAY 5 🔒 · Series-Regular ⭐(8'de5, F1.5) · SERIES_REGULAR_ONLY ⭐ · Designer ⭐(F2) · UNDER_MIN ⭐ · witness: AKTİF 2-tier 🔒 · 3-kademe config KAPALI (false) ⭐ · K_DOWN band 0.24-0.36 ⭐ · Collaborator 🔒 · FB-snapshot 🔒 · reaction-set 🔒 · edit-5dk 🔒 · fırtına 🔒

FIND_NOTE_MAX 60ch ⭐ · portal-set paket ⭐ · multi_room_flag opt-in ⭐ · venue-identity-kit F2 raf

friends_list opt-in 🔒 · follower-listeler public 🔒 · sayaç-yerleşimi ⭐ · follow-request ❓

account_privacy default OPEN 🔒 · follow-request (closed-only) 🔒 · closed_lw_exception ⭐ · masa-muafiyeti 🔒
audience WINDOW|CIRCLE|CITY 🔒 · echo-guard 🔒 · closed_lw_exception=true 🔒
compact-band OFF 🔒(⭐hazır) · event-general-RQ 🔒 · count-liste-içi 🔒 · [PİVOT NOTU: chip 1→2?]
