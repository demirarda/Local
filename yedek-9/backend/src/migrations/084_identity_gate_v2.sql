-- LOCAL v2 §1 identity gate hardening
-- Ensure Track A default uni_label_visible; Track B cleared university fields stay consistent

UPDATE users
SET identity_track = 'university',
    age_ok = true
WHERE email_verified = true
  AND (identity_track IS NULL OR identity_track = '')
  AND university IS NOT NULL;

UPDATE users
SET uni_label_visible = false,
    university = NULL
WHERE identity_track = 'identity';
