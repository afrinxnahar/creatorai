# Changelog

All notable changes to **Creator AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

`MAJOR.MINOR.PATCH`

- **MAJOR** – breaking changes to public APIs, SDKs, DB schema, or user-facing contracts.
- **MINOR** – new features, non-breaking enhancements.
- **PATCH** – backwards-compatible bug fixes, perf, docs, chores.

The canonical version lives in the root [`package.json`](./package.json) and is mirrored in `apps/web` and `apps/api`. Every release gets a tag `vX.Y.Z` and a GitHub Release. The public-facing changelog page ([/changelog](https://tryscriptai.com/changelog)) is sourced from `apps/web/lib/changelog-data.ts` — keep it in sync with this file.

How to cut a release:

1. Update `apps/web/lib/changelog-data.ts` with the new release entry (top of the array).
2. Mirror the entry into this file under a new `## [X.Y.Z]` heading.
3. Bump versions in the root and app `package.json`s.
4. Commit: `chore(release): vX.Y.Z`.
5. Tag: `git tag vX.Y.Z && git push --tags`.
6. Create a GitHub Release from the tag — paste the section from this file as the body.

---

## [Unreleased]

### Added
- Placeholder for upcoming features.

---

## [1.4.0] – 2026-08-15

Ideation gets a cleaner page and a Surprise me button. Behind the scenes, the admin dashboard can now see who is active and what is failing.

### Added
- **Surprise me** on Ideation — suggests a niche focus from the creator's trained style (`POST /api/v1/ideation/surprise`), replacing the static example chips.
- **Admin presence** — `profiles.last_seen_at` stamped by the auth guard, age-filtered and fire-and-forget so telemetry never adds latency to a request.
- **Error tracking** — global Nest exception filter plus per-processor reporting writes unhandled failures to `error_logs`; user cancellations excluded.
- **Promo code lifecycle** management in the admin dashboard.
- Ten new blog posts — ideation, content calendars, script generators, Spotter Studio alternatives, subtitle accuracy, auto-caption fixes.

### Changed
- Ideation page: header renamed Research → Ideation via a segment→title map (route unchanged), accordion how-it-works matching AI Studio, auto mode as a full clickable card.

### Fixed
- Annual affiliate commission calculated from the monthly price.
- Embedded blog videos failed Google's watch-page check, so they never surfaced as video results.

---

## [1.3.0] – 2026-07-31

The largest release so far, and the one that catches this file up. Audio dubbing and AI video generation both went live, Hannah arrived, and all AI generation moved to Vertex AI. Everything merged between the pricing rebuild and the end of July is documented here, including work that shipped before 1.2.0 but was never written up.

### Added
- **AI audio dubbing** — browser uploads straight to GCS via signed URL (API never touches the bytes, 500MB cap), Gemini on Vertex transcribes and translates from `gs://`, a Modal serverless-GPU service clones the speaker and synthesises, video is muxed back over the original. BullMQ-queued with SSE progress, mid-run cancellation and in-place regeneration. Paid plans only.
- **AI video generation** — Gemini Omni Flash via the Interactions API: text-to-video, image-to-video, reference-to-video and stateful editing. Async worker with cancellation, plan-gated to Pro/Business/Scale, surprise-me from `user_style`, history page.
- **Hannah** — Gemini-powered guide chatbot. Public bot (`POST /hannah/chat`) is anonymous and per-IP rate limited; dashboard bot (`POST /hannah/chat/dashboard`) is auth-guarded and injects plan, credits and activity server-side. Voice input, per-bot chat history in localStorage.
- **Channel stats** — subscribers, views and video counts on the onboarding and connected cards, with plan-based sync limits and caching.
- **Public prompt guide** at `/prompt-guide`, with sitemap entry.
- **Subtitles** — GCS-backed direct uploads, plan-based duration and size caps, next-tier upsell banner, credits consumed shown instead of raw token counts.
- **Admin subscriptions** — plan grants with 1/2/3/6/12-month validity, daily `pg_cron` auto-downgrade on expiry, reminder emails and in-app modal at 7d/3d/24h.
- **Admin tooling** — user activity feed, subscription history, dedicated mail page with reply, segmented bulk email campaigns with DB-stored templates and merge tags, `ls_webhook_events` audit trail behind real revenue reporting, purchase-intent funnel.
- **Out-of-credits dialog** on AI training failure, routing to referrals and billing.
- **AWS Lightsail deployment** — `docker-compose.prod.yml` (redis + api + worker + web + caddy), `Dockerfile.web`, Caddy with automatic HTTPS, and a step-by-step hosting guide.
- **AEO/GEO** — `llms.txt` and `llms-full.txt`, blog SEO audit tooling (`seo:audit`, `llms:generate`), `VideoObject` schema.

### Changed
- **Explore-first UX** — every feature is browsable; generation is gated at the button with a modal instead of blocking whole pages.
- **Train AI now actually watches the videos.** `processVideoAssets` interpolated the YouTube URL into a text prompt, so Gemini opened nothing and wrote a plausible transcript from the title and description. Videos now arrive as `fileData` parts.
- **Dubbing** switched to ElevenLabs' built-in voice cloning (the uploaded speaker *is* the creator) and gained accent selection.
- **Vertex AI migration** — all Gemini calls moved from AI Studio API keys to Vertex ADC; Files API replaced with inline base64; text model upgraded to `gemini-3.5-flash`; client init centralised behind a shared factory.
- **Credit multipliers** recalibrated to a documented ≥80% gross-margin policy against real vendor rates; thumbnails bill per image; Scale trimmed to 100k credits to lift the floor $/credit.
- **Marketing performance** — first-load JS roughly halved (blog pages → Server Components, Motion → LazyMotion, `optimizePackageImports`), render-blocking CSS inlined via `experimental.inlineCss`, modern `browserslist` drops ~12KiB of core-js polyfills.
- **Email templates** consolidated into `@repo/email-templates` with a shared layout; the signup confirmation email is branded Creator AI instead of the Supabase default.
- Coming-soon labels removed from video generation and audio dubbing.
- Dead packages (`packages/api`, `packages/config`) deleted; `convertJsonToSrt`, `GEMINI_*` constants and `cn` deduped into single sources of truth.

### Fixed
- **Bonus credits were rented, not earned** — every reset path overwrote `profiles.credits` with the plan allowance, wiping referral and purchase bonuses at renewal. `profiles.bonus_credits` now tags the reset-protected portion under `0 <= bonus_credits <= credits`; plan credits drain first.
- Admin dashboard showed $0.00 revenue and 0 sales against 41 active subscriptions — both cards read `affiliate_sales`, and no Lemon Squeezy payment was persisted anywhere.
- Dubbed MP4s over 50MB hit Supabase Storage's free-tier object cap; output moved to GCS and uploaded directly from Modal, so the media never round-trips through the Node worker.
- Channel stats empty state used a lucide `Link` icon as if it were `next/link`, rendering an icon with no CTA.
- Redis ECONNRESET spam from hosted idle-culls (`keepAlive` + `retryStrategy`); `next build` failures from `useSearchParams` outside Suspense; worker container built from a stale Dockerfile.

### Removed
- Legacy sales-rep portal and the standalone Sales page; affiliate sales live under Affiliates.
- Premium lock on Ideation exports.
- Dead Vercel analytics.

### Security
- Hannah is split by trust boundary rather than by client: the public bot never receives account data, and the dashboard route (not the browser) decides what user context is injected.

---

## [1.2.0] – 2026-07-16

### Changed
- Starter (free) plan monthly credits increased from 200 to 500. Existing free users topped up automatically.

---

## [1.1.0] – 2026-06-19

Every feature is now available on every plan, including free. Plans differ only by monthly credits.

### Added
- Five plans: Starter (free, 200 credits), Creator ($24/mo, 3,000), Pro ($49/mo, 8,000), Business ($299/mo, 50,000), Scale ($599/mo, 150,000).
- Annual billing on Creator and Pro, saving 20% ($19/mo and $39/mo billed yearly).
- Public Referral Program page explaining the give-1,000-get-1,000 model.

### Changed
- Every feature unlocked on every plan; nothing gated behind a higher tier.
- Referral rewards now pay on a referred friend's first purchase (1,000 credits each), not on sign-up.

### Removed
- Premium feature gates on Story Builder modes and Ideation comparison metrics.

---

## [1.0.0] – 2026-04-23

First stable public release. Creator AI graduates from beta to 1.0 with a consolidated feature set, hardened infra, and a complete monetization + affiliate stack.

### Added
- **Affiliate program** with custom sales-rep settings, approval flow, and signup email notifications.
- **Careers module** — application/job schema, admin CRUD for managing job postings, public apply flow.
- **Admin & Sales-Rep dashboards** with role-based access control (RBAC).
- **Premium gating** on Story Builder and Ideation features.
- **One-time 200 credits** granted on signup; 250 credits awarded per successful referral.
- **Audio dubbing** backed by VoxCPM model.
- **SEO**: metadata, sitemap, robots, Open Graph/Twitter cards across public pages.
- **Resend webhook** integration for transactional email lifecycle events.
- **Swagger API docs** and end-to-end Swagger tests for the backend.
- **Unit and E2E test suites** across API services.
- **Public changelog page** at `/changelog` and this `CHANGELOG.md`.

### Changed
- Redesigned the dashboard layout and landing page (new reviews section, refreshed hero/pricing CTAs).
- Moved all shared components into the `@repo/ui` workspace package.
- Consolidated Redis connection into API and Worker containers.
- Hardened validation and error handling across services with proper typed messages.
- Recalculated credit consumption model for fair per-feature billing.

### Fixed
- Email loop on Resend webhooks.
- Job application submission bug.
- Thumbnail generation, deletion, and SSE responses (image URLs now included in status events).
- Story generation and story-building edge cases.
- Referrer credit double-attribution.
- Modal freezing on ideation flow.
- Railway/Docker build errors and `@repo/config` `main`/`types` paths.

### Security
- RBAC enforcement on admin and sales-rep routes.
- Tightened auth guards and request validation with Zod schemas.

---

## [0.2.0] – 2026-04-07

### Added
- Railway + Vercel deployment configs, split Dockerfiles for API and Worker.
- YouTube channel video fetch with `forMine` support.
- Thumbnail SSE pipeline.

### Changed
- Refactored dashboard; improved connectivity between features.
- Migrated from single Dockerfile to multi-service containers.

### Fixed
- Production build errors on Railway.
- Peer dependency resolution issues.

---

## [0.1.0] – 2026-03-11

### Added
- Initial beta: AI Studio, Script Writing, Video Ideas, Story Builder, Thumbnails, Subtitles.
- Landing page, pricing, blog, contact, privacy, terms.
- Supabase auth + SSR, LemonSqueezy billing, BullMQ worker for long jobs.

[Unreleased]: https://github.com/creatorai-app/creatorai/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/creatorai-app/creatorai/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/creatorai-app/creatorai/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/creatorai-app/creatorai/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/creatorai-app/creatorai/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/creatorai-app/creatorai/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/creatorai-app/creatorai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/creatorai-app/creatorai/releases/tag/v0.1.0
