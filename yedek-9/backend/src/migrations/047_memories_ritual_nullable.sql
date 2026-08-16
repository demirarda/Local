-- Migration 047: memories.ritual_id should be nullable per backend-yeni.md §2.9

ALTER TABLE memories
  ALTER COLUMN ritual_id DROP NOT NULL;

