import { auditPost, type AuditablePost } from "./blog-seo-rules";

// Rules now run in two places: `pnpm seo:audit` in CI and live in the admin
// editor. This pins the behaviour so a change to one cannot silently move the
// bar for the other.

const keyword = "ai thumbnail maker";

/** A post that satisfies every rule, built from the shape real posts have. */
function goodPost(): AuditablePost {
  const body = [
    `> **What is the best ai thumbnail maker?** The best ai thumbnail maker depends on how often you publish.`,
    ``,
    `![ai thumbnail maker screenshot](/thumbnail.png)`,
    ``,
    `## How we tested every ai thumbnail maker`,
    ``,
    `We compared them on [YouTube's own guidance](https://support.google.com/youtube/answer/72431) and against [our dubbing guide](/blog/best-ai-dubbing-tool).`,
    ``,
    // Enough filler to clear the 1,000-word floor without tripping the dash rule.
    Array.from({ length: 950 }, (_, i) => `word${i}`).join(" "),
    ``,
    `An ai thumbnail maker earns its place only when it speeds up iteration.`,
    `A second ai thumbnail maker mention keeps the density honest.`,
    `A third ai thumbnail maker mention, then a fourth ai thumbnail maker.`,
    `The last ai thumbnail maker line closes the post.`,
  ].join("\n");

  return {
    slug: "best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026",
    title: "Best AI Thumbnail Maker in 2026",
    excerpt: "We tested 17 tools.",
    content: body,
    seoTitle: "Best AI Thumbnail Maker in 2026: 17 Tools Tested",
    seoDescription: "We tested 17 ai thumbnail maker tools on real uploads.",
    focusKeyword: keyword,
  };
}

describe("auditPost", () => {
  it("passes a post that satisfies the checklist", () => {
    const { gaps, stats } = auditPost(goodPost());
    expect(gaps).toEqual([]);
    expect(stats.words).toBeGreaterThanOrEqual(1000);
    expect(stats.keywordCount).toBeGreaterThanOrEqual(7);
  });

  it("flags a missing focus keyword rather than throwing", () => {
    const { gaps } = auditPost({ ...goodPost(), focusKeyword: "" });
    expect(gaps).toContain("no focusKeyword field");
  });

  it("flags a meta description over Google's truncation point", () => {
    const post = goodPost();
    const { gaps } = auditPost({
      ...post,
      seoDescription: `${keyword} ${"a".repeat(160)}`,
    });
    expect(gaps.some((g) => g.includes("155"))).toBe(true);
  });

  it("flags em dashes but not markdown table separator rows", () => {
    const post = goodPost();

    const withTable = auditPost({
      ...post,
      content: `${post.content}\n\n| Tool | Price |\n| --- | --- |\n| Canva | Free |`,
    });
    expect(withTable.gaps.some((g) => g.includes("dash"))).toBe(false);

    const withEmDash = auditPost({ ...post, content: `${post.content}\n\nOne thing — then another.` });
    expect(withEmDash.gaps.some((g) => g.includes("dash"))).toBe(true);
  });

  it("accepts a video in place of a keyword-tagged image", () => {
    const post = goodPost();
    const noImage = { ...post, content: post.content.replace(/!\[[^\]]*\]\([^)]*\)/, "") };

    expect(auditPost(noImage).gaps).toContain("no image alt with FK (and no video)");
    expect(auditPost({ ...noImage, hasVideo: true }).gaps).not.toContain(
      "no image alt with FK (and no video)",
    );
  });

  it("counts the keyword case-insensitively", () => {
    const post = goodPost();
    const { stats } = auditPost({ ...post, content: post.content.replace(/ai thumbnail maker/i, "AI Thumbnail Maker") });
    expect(stats.keywordCount).toBeGreaterThanOrEqual(7);
  });
});
