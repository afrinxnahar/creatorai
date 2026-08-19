import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

// Metadata only. The Blog + BreadcrumbList JSON-LD used to live here, which meant
// every /blog/<post> page inherited a Blog entity listing all 44 BlogPostings
// plus a second, shallower BreadcrumbList that contradicted the post's own. That
// is 44 URLs shipping near-identical structured data and two competing
// breadcrumb trails — a real "which page is canonical" signal for Google. The
// listing schema now lives on the index page itself, where it belongs.
export const metadata: Metadata = createMetadata({
  title: "Blog",
  description:
    "Tips, guides, and insights on YouTube content creation, AI tools, scripting, and growing your channel, from the Creator AI team.",
  alternates: { canonical: "/blog" },
  openGraph: { url: "/blog" },
});

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
