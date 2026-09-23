import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Sign Up Free",
  description:
    "Create a free Creator AI account: 500 credits a month, no credit card. Train the AI on your own YouTube videos and generate scripts, thumbnails, subtitles and dubs that sound like you.",
  alternates: { canonical: "/signup" },
  openGraph: { url: "/signup" },
});

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
