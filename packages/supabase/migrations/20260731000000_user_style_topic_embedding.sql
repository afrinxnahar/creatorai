-- `topic_embedding` is written by the train-AI worker (saveStyleData) but no migration
-- ever created it. Where it is missing the upsert fails; where it exists it was added
-- by hand and is not reproducible from this repo. Same 1536 dimensions as `embedding`.
ALTER TABLE "public"."user_style"
  ADD COLUMN IF NOT EXISTS "topic_embedding" extensions.vector(1536);

-- Backfill the split-brain column: readers are divided between `structure`
-- (script/ideation/story-builder) and `narrative_structure` (video-generation), but
-- only `structure` was ever written, so video-generation has always read null.
-- The worker now writes both; this repairs existing rows.
UPDATE "public"."user_style"
SET "narrative_structure" = "structure"
WHERE "narrative_structure" IS NULL
  AND "structure" IS NOT NULL;
