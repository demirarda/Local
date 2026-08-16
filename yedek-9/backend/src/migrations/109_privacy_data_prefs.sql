-- 109 — Gizlilik ekranı "veri kullanımı" tercihleri (placeholder → gerçek toggle)
-- Mevcut PUT /api/users/:id/settings privacy payload'ı ile yazılır.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS data_personalization BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_analytics_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
