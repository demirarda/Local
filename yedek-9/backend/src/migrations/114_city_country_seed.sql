-- 114 — cities.country backfill + ülke → şehir kataloğu

-- Mevcut satırlara ülke
UPDATE cities SET country = 'Türkiye'
WHERE (country IS NULL OR TRIM(country) = '')
  AND LOWER(name) IN ('ankara', 'eskisehir', 'eskişehir', 'istanbul', 'izmir', 'bursa', 'antalya');

UPDATE cities SET country = 'Italia'
WHERE (country IS NULL OR TRIM(country) = '')
  AND LOWER(name) IN ('milano', 'milan', 'rome', 'roma', 'firenze', 'florence');

UPDATE cities SET country = 'United Kingdom'
WHERE (country IS NULL OR TRIM(country) = '')
  AND LOWER(name) IN ('london');

UPDATE cities SET country = 'France'
WHERE (country IS NULL OR TRIM(country) = '')
  AND LOWER(name) IN ('paris');

UPDATE cities SET country = 'Germany'
WHERE (country IS NULL OR TRIM(country) = '')
  AND LOWER(name) IN ('berlin');

-- Eksik şehirler
INSERT INTO cities (name, country, status, is_active, notify_enabled, teaser_copy)
SELECT v.name, v.country, v.status, v.is_active, true, v.teaser
FROM (
  VALUES
    ('Ankara', 'Türkiye', 'ACTIVE', true, NULL::text),
    ('Eskisehir', 'Türkiye', 'ACTIVE', true, NULL::text),
    ('Istanbul', 'Türkiye', 'ACTIVE', true, NULL::text),
    ('Izmir', 'Türkiye', 'ACTIVE', true, NULL::text),
    ('Milano', 'Italia', 'ACTIVE', true, NULL::text),
    ('London', 'United Kingdom', 'COMING', false, 'LOCAL henüz şehrinde değil — açılınca haber verelim.'),
    ('Paris', 'France', 'COMING', false, 'LOCAL henüz şehrinde değil — açılınca haber verelim.'),
    ('Berlin', 'Germany', 'COMING', false, 'LOCAL henüz şehrinde değil — açılınca haber verelim.')
) AS v(name, country, status, is_active, teaser)
WHERE NOT EXISTS (
  SELECT 1 FROM cities c WHERE LOWER(c.name) = LOWER(v.name)
);

-- Güvence: bilinen şehirlerde country dolu
UPDATE cities SET country = 'Türkiye'
WHERE LOWER(name) IN ('ankara', 'eskisehir', 'eskişehir', 'istanbul', 'izmir')
  AND (country IS NULL OR TRIM(country) = '');

UPDATE cities SET country = 'Italia'
WHERE LOWER(name) IN ('milano', 'milan')
  AND (country IS NULL OR TRIM(country) = '');
