-- LOCAL v2 §2 completion: event sub-seal active uniqueness

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_sub_seals_active
  ON ritual_event_sub_seals (ritual_id, sub_id)
  WHERE out_ts IS NULL;
