-- Bring blog_posts up to the content model the blog actually publishes.
--
-- The table was written as a generic admin CMS before the blog had an SEO
-- contract, so it has nowhere to put the eight fields every post carries.
-- faqs[] emits FAQPage JSON-LD, videos[] emits VideoObject, and focus_keyword is
-- what .claude/skills/blog-post-seo audits against.

-- == 1. CONTENT MODEL ==

ALTER TABLE public.blog_posts
  -- Display byline, matched against apps/web/lib/authors.ts for the avatar, bio
  -- and sameAs profiles. Not a FK: a post's author is a public identity.
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS read_time text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS focus_keyword text,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS videos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.blog_posts
  DROP COLUMN IF EXISTS cover_image_url;

ALTER TABLE public.blog_posts
  ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_author_fkey;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_author_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- == 3. THE SEO CONTRACT ==
--
-- Every check is scoped to status = 'published', so a half-written draft can
-- always be saved and only publishing has to satisfy the contract.

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_published_seo_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_published_seo_check CHECK (
    status <> 'published' OR (
      seo_title IS NOT NULL AND length(btrim(seo_title)) > 0
      AND seo_description IS NOT NULL AND length(btrim(seo_description)) > 0
      AND focus_keyword IS NOT NULL AND length(btrim(focus_keyword)) > 0
      AND excerpt IS NOT NULL AND length(btrim(excerpt)) > 0
    )
  );

-- Google truncates past ~155 characters, so anything longer is written for nobody.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_seo_description_length_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_seo_description_length_check
  CHECK (seo_description IS NULL OR char_length(seo_description) <= 155);

-- Read with jsonb array accessors on the render path: an object or scalar here
-- is a 500, not a bad-looking page.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_faqs_is_array_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_faqs_is_array_check CHECK (jsonb_typeof(faqs) = 'array');

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_videos_is_array_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_videos_is_array_check CHECK (jsonb_typeof(videos) = 'array');

-- published_at drives ordering, scheduling, the sitemap and datePublished.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_published_at_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_published_at_check
  CHECK (status <> 'published' OR published_at IS NOT NULL);

-- Slugs go in URLs, so a typo must not mint /blog/My Post.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_slug_format_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_slug_format_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- One post per focus keyword: two posts sharing one is the cannibalization the
-- August audit traced the duplicate-canonical reports to. Archived posts are
-- excluded so retiring a post frees its keyword for the hub that absorbed it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_focus_keyword_unique
  ON public.blog_posts (lower(focus_keyword))
  WHERE focus_keyword IS NOT NULL AND status <> 'archived';

-- == 4. READ PATHS ==

-- The blog index, the sitemap and the scheduled-post filter all read published
-- rows newest-first.
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON public.blog_posts USING btree (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_search
  ON public.blog_posts USING gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(focus_keyword, ''))
  );

COMMENT ON COLUMN public.blog_posts.focus_keyword IS
  'The one phrase this post ranks for. Unique across non-archived posts.';
COMMENT ON COLUMN public.blog_posts.faqs IS
  'Array of {question, answer}. Rendered as the FAQ block and emitted as FAQPage JSON-LD.';
COMMENT ON COLUMN public.blog_posts.videos IS
  'Array of {youtubeId, name, description, uploadDate, duration?}. Emitted as VideoObject JSON-LD.';
COMMENT ON COLUMN public.blog_posts.published_at IS
  'Publish date. A future value schedules the post: it stays hidden until then.';
