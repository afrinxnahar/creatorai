/**
 * Blog SEO audit — checks every published post in public.blog_posts against the
 * Creator AI SEO checklist (see .claude/skills/blog-post-seo/SKILL.md).
 *
 * Run:  pnpm --filter web seo:audit
 * Exits non-zero if any post has gaps, so it can gate CI if desired.
 *
 * Reads the database, not a file, because that is where posts are edited now.
 * It therefore needs the Supabase env vars; in CI that means giving the job the
 * anon key, which only ever sees published rows.
 *
 * The rules themselves live in lib/blog-seo-rules.ts so this script and the
 * live check in the admin editor can never disagree.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { auditPost } from "../lib/blog-seo-rules.ts";
import { loadPublishedPosts } from "../lib/blog-source.ts";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const blogPosts = await loadPublishedPosts();

const norm = (s: string) => s.toLowerCase();

let totalGaps = 0;
const lines: string[] = [];

for (const p of blogPosts) {
  const fk = p.focusKeyword ?? p.keywords[0] ?? "";
  const { gaps, stats } = auditPost({ ...p, focusKeyword: fk, hasVideo: !!p.videos?.length });

  totalGaps += gaps.length;
  const status = gaps.length ? `✗ ${gaps.length} gap(s)` : "✓ pass";
  lines.push(
    `${status}  ${p.slug}\n    FK="${fk}"  words=${stats.words} density=${stats.density.toFixed(2)}% count=${stats.keywordCount} ext=${stats.externalLinks} int=${stats.internalLinks} urlLen=${stats.urlLength}` +
      (gaps.length ? `\n    → ${gaps.join("; ")}` : ""),
  );
}

// Focus-keyword uniqueness across the whole blog.
const byFk = new Map<string, string[]>();
for (const p of blogPosts) {
  const fk = norm(p.focusKeyword ?? p.keywords[0] ?? "");
  byFk.set(fk, [...(byFk.get(fk) || []), p.slug]);
}
const dupes = [...byFk].filter(([, s]) => s.length > 1);

console.log(lines.join("\n\n"));
if (dupes.length) {
  console.log("\n=== DUPLICATE FOCUS KEYWORDS (must be unique) ===");
  for (const [fk, slugs] of dupes) console.log(`  "${fk}": ${slugs.join(", ")}`);
}
console.log(`\n${totalGaps === 0 && !dupes.length ? "All posts pass ✓" : `${totalGaps} total gap(s) across ${blogPosts.length} posts`}`);
process.exit(totalGaps === 0 && dupes.length === 0 ? 0 : 1);
