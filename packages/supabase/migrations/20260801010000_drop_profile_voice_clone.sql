-- Reverses 20260731100000_profile_voice_clone.sql.
--
-- Dubbing no longer stores a voice per creator: the ElevenLabs dubbing endpoint
-- clones the speaker from the uploaded media on every job, which for a creator
-- dubbing their own video is already their own voice.
--
-- Written as a forward migration rather than by deleting the original, which has
-- already shipped — removing an applied migration leaves environments that ran it
-- holding columns nothing creates, and puts the local history out of step with the
-- remote one.
--
-- Any voice clones created while the old pipeline was live are still in the
-- ElevenLabs workspace and hold a voice slot each; delete those from the dashboard.
ALTER TABLE "public"."profiles"
  DROP COLUMN IF EXISTS "elevenlabs_voice_id",
  DROP COLUMN IF EXISTS "voice_sample_url",
  DROP COLUMN IF EXISTS "voice_cloned_at";
