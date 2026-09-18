-- Zone vizyon kilitleri: ZONE-OPS kuyruğu (P2Z ops-chip)

CREATE TABLE IF NOT EXISTS zone_ops_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID,
  ritual_id UUID,
  chip_id TEXT,
  kind TEXT,
  created_by UUID,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zone_ops_queue_zone
  ON zone_ops_queue (zone_id, created_at DESC);

CREATE INDEX IF NOT EXISTS zone_ops_queue_status
  ON zone_ops_queue (status, created_at DESC);
