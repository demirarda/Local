-- Migration 061: Ritual state enum values (son-part.md §2)
-- Must commit before using new enum labels in UPDATE/INSERT.

ALTER TYPE ritual_status ADD VALUE IF NOT EXISTS 'prelobby';
ALTER TYPE ritual_status ADD VALUE IF NOT EXISTS 'window';
ALTER TYPE ritual_status ADD VALUE IF NOT EXISTS 'archived';
