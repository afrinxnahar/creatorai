"use client"

import Link from "next/link"
import * as motion from "motion/react-m"
import { ArrowRight, Clapperboard, Sparkles } from "lucide-react"
import type { ComponentType } from "react"
import SearchIcon from "@/components/dashboard/sidebar/icons/SearchIcon"
import FileTextIcon from "@/components/dashboard/sidebar/icons/FileTextIcon"
import { FREE_TOOLS } from "@/lib/free-tools"

/**
 * Card anatomy follows Linear's feature grid: a uniform-height card built
 * around a visual rather than a paragraph, 16px radius, generous padding, and
 * an elevated surface instead of a hard border. The visual is a mock of what
 * the tool returns, so the card previews the output rather than describing it.
 */

/** Same mapping the /tools hub uses: the free sample wears the icon its paid
 *  feature wears in the dashboard, so the two read as one product. */
const TOOL_ICON: Record<string, ComponentType<{ className: string }>> = {
  "free-youtube-video-ideas-generator": SearchIcon,
  "free-youtube-script-generator": FileTextIcon,
  "free-youtube-story-structure-generator": Clapperboard,
}

/** The shape of each output, drawn as skeleton lines. Purely decorative, so it
 *  is aria-hidden: the card's real content is the heading and the copy. */
const TOOL_PREVIEW: Record<string, { label: string; lines: number[]; chips?: string[] }> = {
  "free-youtube-video-ideas-generator": {
    label: "Idea",
    lines: [100, 72],
    chips: ["Hook", "Format", "Keywords"],
  },
  "free-youtube-script-generator": {
    label: "Script",
    lines: [100, 88, 94, 64],
  },
  "free-youtube-story-structure-generator": {
    label: "Structure",
    lines: [100, 80, 90],
    chips: ["0:00 Hook", "Retention 82"],
  },
}

function ToolPreview({ slug }: { slug: string }) {
  const preview = TOOL_PREVIEW[slug]
  if (!preview) return null

  return (
    <div
      aria-hidden="true"
      className="relative mt-6 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 p-4"
    >
      <div className="flex items-center gap-1.5 pb-3">
        <span className="h-2 w-2 rounded-full bg-rose-300 dark:bg-rose-500/50" />
        <span className="h-2 w-2 rounded-full bg-amber-300 dark:bg-amber-500/50" />
        <span className="h-2 w-2 rounded-full bg-emerald-300 dark:bg-emerald-500/50" />
        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {preview.label}
        </span>
      </div>

      <div className="space-y-2">
        {preview.lines.map((width, i) => (
          <div
            key={i}
            style={{ width: `${width}%` }}
            className={`h-2 rounded-full ${
              i === 0
                ? "bg-gradient-to-r from-purple-400 to-pink-400 dark:from-purple-500 dark:to-pink-500"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>

      {preview.chips && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preview.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 ring-1 ring-slate-200/80 dark:ring-slate-700"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FreeToolsSection() {
  return (
    <div className="container px-4 md:px-6">
      <motion.div
        className="flex flex-col items-center text-center space-y-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          New: no signup required
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
          Try It Before You Sign Up
        </h2>
        <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
          Real generators running the same engine as the paid features, capped at one run. No
          account, no card, and what you generate is yours to use.
        </p>
      </motion.div>

      <motion.ul
        className="grid auto-rows-fr grid-cols-1 md:grid-cols-3 gap-6 mt-12"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
        }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {FREE_TOOLS.map((tool) => {
          const Icon = TOOL_ICON[tool.slug] ?? Sparkles
          return (
            <motion.li
              key={tool.slug}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
              transition={{ type: "spring", stiffness: 100, damping: 14 }}
            >
              <Link
                href={`/tools/${tool.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 hover:ring-purple-300 dark:hover:ring-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                {/* Tint that warms the card on hover, behind the content. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-purple-50 dark:from-purple-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="relative flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 ring-1 ring-slate-100 dark:ring-slate-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Free · No signup
                  </span>
                </div>

                <h3 className="relative mt-5 text-xl font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {tool.name}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {tool.cardDescription}
                </p>

                <div className="relative flex-1">
                  <ToolPreview slug={tool.slug} />
                </div>

                <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400">
                  Try it free
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>

      <div className="mt-10 flex justify-center">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-purple-300 hover:text-purple-700 dark:hover:text-purple-400"
        >
          See all free tools
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
