-- Drop the format column from scripts.
-- Format was removed from the domain model; scripts are format-agnostic for now.

ALTER TABLE scripts DROP COLUMN IF EXISTS format;
