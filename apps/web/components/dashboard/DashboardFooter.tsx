"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Quote } from "lucide-react";

const QUOTES = [
  "Your first 100 videos are the tuition. Keep filming.",
  "Consistency beats virality — the algorithm rewards the reliable.",
  "The video you almost didn't post is usually the one that lands.",
  "Nobody remembers the thumbnail you agonized over. They remember the story.",
  "One good hook is worth a hundred good edits.",
  "You're not behind. You're just earlier in the same climb.",
  "Small channel, real audience. That's the part money can't buy.",
  "Make the video only you could make.",
  "Every creator you admire had a first upload worse than yours.",
  "Ship it at 80%. The other 20% is learned from the comments.",
  "The best time to post was yesterday. The second best is today.",
  "Views are borrowed. Trust compounds.",
];

export default function DashboardFooter() {
  const pathname = usePathname();
  // Picked client-side so the server render doesn't mismatch on hydration.
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]!);
  }, [pathname]);

  return (
    <footer className="px-4 py-6 text-center">
      <p className="inline-flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <Quote className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="italic">{quote ?? " "}</span>
      </p>
    </footer>
  );
}
