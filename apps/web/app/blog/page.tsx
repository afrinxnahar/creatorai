// Server Component. Imports the full post list (with bodies) but hands the
// client only the metadata it needs to render cards, search and paginate — so
// every post's markdown body stays server-side instead of shipping as JS.
import { blogPosts } from "@/lib/blog-data"
import { getAuthor } from "@/lib/authors"
import { siteConfig } from "@/lib/seo"
import BlogListing, { type BlogPostMeta } from "@/components/blog/BlogListing"
import JsonLd from "@/components/JsonLd"

// Index-only schema. Lives here rather than in the section layout so post pages
// don't each inherit a 44-entry Blog entity and a duplicate breadcrumb.
const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `${siteConfig.name} Blog`,
  description:
    "Tips, guides, and insights on YouTube content creation, AI tools, scripting, and growing your channel.",
  url: `${siteConfig.url}/blog`,
  publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  blogPost: blogPosts.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: `${siteConfig.url}/blog/${post.slug}`,
    datePublished: new Date(post.date).toISOString(),
    author: getAuthor(post.author)
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: post.author },
  })),
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
  ],
}

export default function BlogPage() {
  const posts: BlogPostMeta[] = blogPosts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    author: p.author,
    date: p.date,
    readTime: p.readTime,
    featured: p.featured,
    tags: p.tags,
  }))

  return (
    <>
      <JsonLd data={blogJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <BlogListing posts={posts} />
    </>
  )
}
