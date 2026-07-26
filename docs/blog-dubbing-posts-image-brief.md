# Image brief — dubbing blog posts (Jul 2026)

Covers the new AI dubbing cost post plus the three existing dubbing posts, which
are currently image-starved (one visual each across ~2,000 words).

Same rules as [the thumbnail brief](./blog-thumbnail-posts-image-brief.md):

- **Bucket A — real screenshots.** Third-party product UI. Do **not** AI-generate
  these; a fabricated "Rask AI dashboard" is a made-up screenshot of a real
  company's product. Capture live or use vendor press kits.
- **Bucket B — AI-generated originals.** Heroes, charts, diagrams. Prompts below.

All new files land in `apps/web/public/blog/`.

## Size

**Every image below is 1600×900 px (16:9).** Same reason as the thumbnail brief:
the blog renders images as `<img class="w-full">` with no `width`/`height`
attributes ([page.tsx:170](../apps/web/app/blog/[id]/page.tsx#L170)), so one
shared aspect ratio keeps layout shift predictable across every post.

| Property | Value |
|---|---|
| **Every inline image** | **1600×900 px (16:9)** |
| Article column at desktop | ~880 px, so 1600 px source ≈ 1.8× DPR |
| OG / social crop of the hero | 1200×630 — keep the subject inside the middle 60% |
| Max file size | 250 KB after compression |
| Format / colour / dark mode | PNG, sRGB, `#0F1115`–`#F7F8FA` neutrals |

**Non-16:9 capture sources.** Pricing pages are tall and YouTube Studio is wide.
Do not resize them to fit — crop to the region that carries the price or the
control, then centre that crop on a 1600×900 canvas with a flat `#12141A`
background. Applies to `tool-gooddub-dubbing.png` (pricing tiers, tall) and
`tool-youtube-auto-dubbing.png` (Studio panel, wide).

---

## Post 1 (new) — `how-much-does-ai-dubbing-cost-vs-traditional-dubbing-2026`

12 image slots, already written into the post. 6 screenshots, 5 generated, 1 reuse.

### Bucket A — screenshots (6)

| File | Size | What to capture | Source |
|---|---|---|---|
| `/blog/tool-heygen-dubbing.png` | 1600×900 | HeyGen video-translate screen with the credit cost for the job visible | heygen.com |
| `/blog/tool-elevenlabs-dubbing.png` | 1600×900 | ElevenLabs Dubbing Studio, language selector + credit usage panel | elevenlabs.io |
| `/blog/tool-rask-ai-dubbing.png` | 1600×900 | Rask AI project view showing plan minutes remaining | rask.ai |
| `/blog/tool-gooddub-dubbing.png` | 1600×900 | GoodDub credit-pack pricing page (the pay-as-you-go tiers are the point) | gooddub.ai |
| `/blog/tool-vozo-dubbing.png` | 1600×900 | Vozo lip-sync / voice-identity settings panel | vozo.ai |
| `/blog/tool-youtube-auto-dubbing.png` | 1600×900 | YouTube Studio → Subtitles/Audio, automatic dubbing toggle on a real video | Your own Studio |

**Capture note:** for the four pricing-led tools, frame the shot so the *price or
credit consumption* is legible. The post is about cost — a screenshot of a
generic editor adds nothing. Blur account names and balances.

### Reuse

`/ai studio page.png` — Creator AI entry (#4). Already in `public/`. If you have a
capture showing the dubbing job screen with language selection, swap that file and
it improves three posts at once.

### Bucket B — AI prompts (5)

House **STYLE BLOCK** and **NEGATIVE** are in the thumbnail brief; append both to
every prompt below verbatim. Same reason as before: no baked-in text, add labels
in Figma afterwards.

#### 1. `/blog/ai-dubbing-cost-hero.png` — hero

**Size:** 1600×900 px (16:9)

> A wide editorial illustration split by a soft vertical seam. Left side: a dense
> cluster of studio objects rendered as clean flat vector silhouettes, a large
> condenser microphone on a boom, a mixing console, an acoustic-panel wall, three
> small person silhouettes, and a stack of coin discs rising tall beside them.
> Right side: a single small rounded processor chip with thin blue signal lines
> fanning out into six small speech-bubble glyphs of different sizes, and a
> noticeably shorter stack of coin discs beside it. The height difference between
> the two coin stacks is the visual punchline and must be dramatic, roughly six to
> one. Dark navy background, warm orange used only on the coin stacks.
> *(append STYLE BLOCK + NEGATIVE)*

**SEO note:** this is the Discover/OG crop. Keep both coin stacks inside the
middle 60% horizontally or the comparison is lost at 1200×630.

#### 2. `/blog/ai-dubbing-cost-pricing-method.png` — pricing method

**Size:** 1600×900 px (16:9)

> A clean three-step horizontal diagram on a dark navy background. Step one: a
> price-tag glyph beside a small calendar grid, connected by a division symbol to
> a row of tiny clock icons, representing price divided by included minutes. Step
> two: a bar that extends past a dashed boundary line, with the overhanging
> portion highlighted in warm orange, representing overage. Step three: a mouth
> and soundwave glyph beside a capacity bar that is exactly half filled,
> representing lip-sync halving capacity. Thin blue connector arrows, generous
> padding, blank caption strips beneath each step.
> *(append STYLE BLOCK + NEGATIVE)*

#### 3. `/blog/ai-dubbing-cost-breakdown.png` — six cost line items

**Size:** 1600×900 px (16:9)

> A horizontal stacked-bar cost breakdown on a dark navy background. One long
> rounded horizontal bar divided into six segments of clearly different widths,
> ordered largest to smallest: the widest segment in warm orange, the rest in
> descending shades of muted blue and slate. Beneath each segment, a small
> abstract icon on a thin leader line: a subscription card, a cloud with an
> upward arrow, a star badge, a person silhouette with a pencil, two circular
> arrows for rework, and a shield with a checkmark. No labels, generous leading
> between the bar and the icon row.
> *(append STYLE BLOCK + NEGATIVE)*

**Why orange on the widest segment:** the post's argument is that human review,
not software, is the largest line. The chart has to say that without text.

#### 4. `/blog/ai-dubbing-cost-savings.png` — five cost-cutting tactics

**Size:** 1600×900 px (16:9)

> Five rounded cards in one row on a dark navy background, each holding a single
> abstract glyph: a globe with only two highlighted regions out of many, a face
> silhouette with a small mouth-sync bracket applied to just one section of a
> filmstrip, a text block visibly shorter than a faded longer one behind it, two
> stacked QA checkmarks of different weights, and four small app squares merging
> into one larger rounded square. A thin descending orange line runs beneath all
> five cards suggesting falling cost. Uniform card sizing, 32px gutters.
> *(append STYLE BLOCK + NEGATIVE)*

#### 5. `/blog/ai-dubbing-cost-decision-matrix.png` — decision matrix

**Size:** 1600×900 px (16:9)

> A clean two-by-two matrix on a dark navy background, axes drawn as thin blue
> lines with small arrowheads. Each quadrant contains one abstract scene:
> top-left, a graduation cap over a stack of filmstrips; top-right, a theatre
> mask beside a spotlight; bottom-left, a repeating grid of small identical video
> cards; bottom-right, a document with a legal seal and a shield. The bottom-left
> quadrant is subtly tinted warm orange to mark it as the AI-first zone. Wide
> outer margins for axis labels to be added later.
> *(append STYLE BLOCK + NEGATIVE)*

---

## Post 2 (existing) — `how-to-dub-youtube-videos-into-multiple-languages-ai`

**Current state:** one image (`/ai studio page.png`) across the whole post. That is
well under the ~1 image per 250–300 words the competing articles run.

**Recommended additions (all Bucket B, all new files):**

| File | Size | Where it goes | Prompt |
|---|---|---|---|
| `/blog/dub-youtube-videos-language-flow.png` | 1600×900 | After the intro | > A horizontal pipeline diagram: a single video card on the left feeding into a processor node, which fans out into six identical video cards on the right, each carrying a different small abstract audio-waveform pattern. Thin blue connectors, one warm-orange path highlighted. *(append STYLE BLOCK + NEGATIVE)* |
| `/blog/dub-youtube-videos-audio-track-picker.png` | 1600×900 | In the YouTube setup section | > An abstract generic media-player frame on a dark navy background with a settings gear opened into a vertical list of six blank selection rows, one row marked with a warm-orange check. Deliberately generic chrome resembling no real product. *(append STYLE BLOCK + NEGATIVE)* |
| `/blog/dub-youtube-videos-watch-time-split.png` | 1600×900 | Near the results/analytics section | > A horizontal 100% stacked bar split into five unequal segments, with a small upward-trending line chart above it, on a dark navy background. The second-largest segment is warm orange. No labels. *(append STYLE BLOCK + NEGATIVE)* |

**Bucket A option:** a real YouTube Studio screenshot of the multi-language audio
track list on one of your own videos would outperform any of the above. Use it if
you have it.

---

## Post 3 (existing) — `youtube-auto-dubbing-vs-ai-voice-cloning-explained`

**Current state:** one embedded YouTube video (`Yg4J8mUJo-M`), no still images.

**Recommended additions:**

| File | Size | Where it goes | Prompt / source |
|---|---|---|---|
| `/blog/auto-dubbing-vs-voice-cloning-comparison.png` | 1600×900 | After the opening answer | > A symmetric side-by-side illustration on a dark navy background. Left: a generic speaker-cone glyph emitting a flat, evenly-spaced waveform. Right: a person silhouette emitting an irregular, expressive waveform that visually matches a second smaller waveform beside it, showing identity carried across. A thin vertical divider between them. Warm orange on the right waveform only. *(append STYLE BLOCK + NEGATIVE)* |
| `/blog/voice-cloning-consent-checklist.png` | 1600×900 | In the ethics/consent section | > A rounded document panel on a dark navy background with five checklist rows, each a blank line beside a small check glyph, and a shield-with-keyhole icon anchored at the top. Generous padding, no text. *(append STYLE BLOCK + NEGATIVE)* |
| `/blog/tool-youtube-auto-dubbing.png` | 1600×900 | Reuse from Post 1 | Same YouTube Studio screenshot — no need to capture twice |

---

## Post 4 (existing) — `best-ai-dubbing-tool-for-youtubers-2026-compared`

**Current state:** one embedded YouTube video, no still images, despite being a
7-tool comparison post. Comparison posts are the format that most needs one
visual per tool.

**Recommended additions:** reuse the six tool screenshots from Post 1 above
(`tool-heygen-dubbing.png`, `tool-elevenlabs-dubbing.png`, `tool-rask-ai-dubbing.png`,
`tool-gooddub-dubbing.png`, `tool-vozo-dubbing.png`, `tool-youtube-auto-dubbing.png`)
— capture once, use in both posts. Plus one new generated visual:

| File | Size | Where it goes | Prompt |
|---|---|---|---|
| `/blog/ai-dubbing-tool-scorecard.png` | 1600×900 | Above the comparison table | > A radial scorecard: five spokes from a central rounded square containing a soundwave glyph, each spoke ending in a small panel with one abstract icon — a globe for language coverage, a person silhouette for voice quality, a mouth bracket for lip-sync, a price tag, and a stopwatch. A translucent warm-orange pentagon connects the endpoints at roughly 75% extension. *(append STYLE BLOCK + NEGATIVE)* |

---

## Two issues to fix while you are in here

**1. Duplicate video across two posts.** `Yg4J8mUJo-M` is embedded in *both*
`youtube-auto-dubbing-vs-ai-voice-cloning-explained` (blog-data.ts:3177) and
`best-ai-dubbing-tool-for-youtubers-2026-compared` (blog-data.ts:3348), and both
emit `VideoObject` JSON-LD for it. Google indexes a video against **one** canonical
watch page, so the two posts are competing to be it. Pick one to keep the embed
and the `videos[]` entry; the other should link to it instead. The skill file says
this explicitly.

**2. Prices go stale fast.** Every per-minute figure in the new cost post is
labelled "as published July 2026" and every vendor on that list repriced within
the last year. Put a calendar reminder to re-verify in ~4 months — a cost post
with wrong numbers loses trust faster than one with fewer numbers.

---

## Post-generation checklist

Same as the thumbnail brief: export 1600×900 → compress to ≤250 KB → drop into
`apps/web/public/blog/` with exact filenames → `pnpm --filter web dev` and check
each post renders → `pnpm --filter web seo:audit` → `pnpm --filter web llms:generate`.

Alt text already carries the focus keyword on every slot in the new post. Don't
rewrite alts casually.
