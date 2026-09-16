import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

/**
 * Indexable on purpose. "creator ai login" is a navigational brand query, and
 * if we do not rank for it someone else's round-up page does. The sibling
 * auth routes (/forgot-password, /reset-password) stay noindex: they have no
 * search demand and reset-password is token-only.
 */
export const metadata: Metadata = createMetadata({
  title: "Login",
  description:
    "Log in to Creator AI to write scripts in your own voice, generate thumbnails, subtitles and dubs, and see your channel stats. New here? Sign up free, no card needed.",
  alternates: { canonical: "/login" },
  openGraph: { url: "/login" },
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
