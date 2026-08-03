import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Affiliate Program Terms",
  description:
    "The terms of the Creator AI affiliate program: how tracking links and promo codes are attributed, 20% recurring commission, the 30-day holding period, payouts, and prohibited promotion.",
  alternates: { canonical: "/affiliate-terms" },
  openGraph: { url: "/affiliate-terms" },
});

export default function AffiliateTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
