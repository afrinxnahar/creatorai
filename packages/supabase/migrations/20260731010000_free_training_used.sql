-- The free first training must be free ONCE PER ACCOUNT, not once per connected
-- channel. `ai_trained` cannot carry that: disconnecting a channel resets it to
-- false, so a user could disconnect/reconnect and train free forever.
-- `free_training_used` is set on the first successful training and never reset.
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "free_training_used" boolean NOT NULL DEFAULT false;

-- Anyone already trained has spent their free run.
UPDATE "public"."profiles"
SET "free_training_used" = true
WHERE "ai_trained" = true;
