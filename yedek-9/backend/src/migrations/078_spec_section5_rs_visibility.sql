-- son-part.md §5.4 — RS default private; public opt-in only
ALTER TABLE user_settings
  ALTER COLUMN show_rs_score_publicly SET DEFAULT false;

COMMENT ON COLUMN user_settings.show_rs_score_publicly IS
  'When true, other users may see exact RS. Default false (§5.4).';
