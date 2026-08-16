-- LTE-3 §3.7: check-in keyword must be unique

CREATE UNIQUE INDEX IF NOT EXISTS ux_rituals_check_in_keyword_ci
ON rituals (LOWER(TRIM(check_in_keyword)))
WHERE check_in_keyword IS NOT NULL AND TRIM(check_in_keyword) <> '';
