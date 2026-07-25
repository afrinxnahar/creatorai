"use client"

import { useReportWebVitals } from "next/web-vitals"

/**
 * Reports Core Web Vitals to GA4.
 *
 * Google ranks on field data (CrUX), not on the lab numbers PageSpeed shows, and
 * INP — the metric that replaced FID — only exists in the field: no lab run can
 * measure how a real user's interactions felt. Without this the site collects
 * none of it.
 *
 * Values are queued straight onto dataLayer rather than through `window.gtag`.
 * gtag.js loads with strategy="lazyOnload", so FCP and LCP have normally already
 * fired before the global exists; dataLayer is a replay queue, so GA4 picks these
 * up when it initialises instead of dropping them.
 */
function reportWebVital(metric: { name: string; value: number; id: string }) {
  const w = window as unknown as { dataLayer?: unknown[] }
  const dataLayer = (w.dataLayer ??= [])

  dataLayer.push([
    "event",
    metric.name,
    {
      // GA4 metric values must be integers, and CLS is a small fraction.
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      // Unique per page load, so percentiles can be rebuilt in GA4.
      event_label: metric.id,
      // Keeps these off bounce-rate calculations.
      non_interaction: true,
    },
  ])
}

export default function WebVitals() {
  useReportWebVitals(reportWebVital)
  return null
}
