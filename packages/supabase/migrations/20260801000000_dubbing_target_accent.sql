-- Optional accent preference passed through to the dubbing API's target_accent.
-- Stored so a regenerate reproduces the same dub rather than silently dropping it.
ALTER TABLE "public"."dubbing_projects"
  ADD COLUMN IF NOT EXISTS "target_accent" text;
