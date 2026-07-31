-- One ElevenLabs voice clone per creator, created from the first media they dub and
-- reused for every dub after that, so a creator's dubs keep the same voice across
-- languages instead of re-cloning from whatever audio each upload happens to contain.
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "elevenlabs_voice_id" text,
  ADD COLUMN IF NOT EXISTS "voice_sample_url" text,
  ADD COLUMN IF NOT EXISTS "voice_cloned_at" timestamptz;

COMMENT ON COLUMN "public"."profiles"."elevenlabs_voice_id" IS
  'ElevenLabs IVC voice id. Null until the first successful dub creates one.';
COMMENT ON COLUMN "public"."profiles"."voice_sample_url" IS
  'GCS URL of the audio the clone was built from, so the voice can be rebuilt if deleted upstream.';
