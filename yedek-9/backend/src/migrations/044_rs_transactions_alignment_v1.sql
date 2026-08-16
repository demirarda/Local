-- Migration 044: Align RS transaction ledger with backend-yeni.md §2.7

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rs_transaction_type') THEN
    CREATE TYPE rs_transaction_type AS ENUM ('ritual', 'bypass', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rs_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  delta DECIMAL(5,3) NOT NULL,
  rs_before DECIMAL(4,2) NOT NULL,
  rs_after DECIMAL(4,2) NOT NULL,
  transaction_type rs_transaction_type NOT NULL,
  component_a DECIMAL(4,3),
  component_iq DECIMAL(4,3),
  component_cf DECIMAL(4,3),
  component_m DECIMAL(4,3),
  component_if DECIMAL(4,3),
  ds_mult DECIMAL(4,3),
  bc5_mult DECIMAL(4,3),
  md_mult DECIMAL(4,3),
  br_mult DECIMAL(4,3),
  bypass_reason TEXT,
  rater_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rs_transactions_user_id ON rs_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rs_transactions_ritual_id ON rs_transactions(ritual_id);
CREATE INDEX IF NOT EXISTS idx_rs_transactions_transaction_type ON rs_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_rs_transactions_created_at ON rs_transactions(created_at DESC);

-- Backfill from existing rs_delta_history + rs_history (idempotent via NOT EXISTS id)
INSERT INTO rs_transactions (
  id, user_id, ritual_id, delta, rs_before, rs_after, transaction_type,
  component_a, component_iq, component_cf, component_m, component_if,
  ds_mult, bc5_mult, md_mult, br_mult, bypass_reason, rater_count, created_at
)
SELECT
  d.id,
  d.user_id,
  d.ritual_id,
  d.delta::DECIMAL(5,3),
  d.old_rs::DECIMAL(4,2),
  d.new_rs::DECIMAL(4,2),
  CASE
    WHEN COALESCE(d.pipeline_kind, '') = 'bypass' OR d.bypass_reason IS NOT NULL THEN 'bypass'::rs_transaction_type
    ELSE 'ritual'::rs_transaction_type
  END,
  d.s_r::DECIMAL(4,3),
  NULL,
  NULL,
  NULL,
  NULL,
  d.ds_mult::DECIMAL(4,3),
  d.bc5_mult::DECIMAL(4,3),
  d.md_mult::DECIMAL(4,3),
  d.br_mult::DECIMAL(4,3),
  d.bypass_reason::TEXT,
  0,
  d.created_at AT TIME ZONE 'UTC'
FROM rs_delta_history d
WHERE NOT EXISTS (
  SELECT 1 FROM rs_transactions t WHERE t.id = d.id
);

INSERT INTO rs_transactions (
  id, user_id, ritual_id, delta, rs_before, rs_after, transaction_type,
  bypass_reason, rater_count, created_at
)
SELECT
  h.id,
  h.user_id,
  h.ritual_id,
  (h.new_rs - h.old_rs)::DECIMAL(5,3),
  h.old_rs::DECIMAL(4,2),
  h.new_rs::DECIMAL(4,2),
  CASE
    WHEN h.source = 'admin' THEN 'admin'::rs_transaction_type
    WHEN h.source = 'bypass' THEN 'bypass'::rs_transaction_type
    ELSE 'ritual'::rs_transaction_type
  END,
  NULL,
  0,
  h.created_at AT TIME ZONE 'UTC'
FROM rs_history h
WHERE NOT EXISTS (
  SELECT 1 FROM rs_transactions t WHERE t.id = h.id
);

