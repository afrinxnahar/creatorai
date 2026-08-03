"use client"

import { useState } from "react"
import { useAdminErrors, useAdminErrorSummary, useAdminErrorDetail } from "@/hooks/useAdmin"
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Bug,
  Server,
  Cpu,
  Users,
  X,
  BellRing,
} from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import type { ErrorLog, ErrorGroup } from "@repo/validation"

const FEATURES = [
  "ideation", "script", "story-builder", "thumbnail",
  "dubbing", "subtitle", "video-generation", "train-ai", "billing",
]

function statusColor(status: number | null) {
  if (!status) return "bg-slate-800 text-slate-400"
  if (status >= 500) return "bg-red-900/40 text-red-400"
  if (status >= 400) return "bg-amber-900/40 text-amber-400"
  return "bg-slate-800 text-slate-400"
}

/** Worst-first triage list — one row per distinct bug, not per occurrence. */
function TopErrors({ groups, loading }: { groups: ErrorGroup[]; loading: boolean }) {
  if (loading) {
    return <div className="h-40 rounded-lg border border-slate-800 bg-slate-900 animate-pulse" />
  }
  if (!groups.length) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-slate-500">
        No errors in this window. Good sign.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Most frequent</h2>
        <p className="text-xs text-slate-500">Grouped by fingerprint — fix the top row first</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs uppercase text-slate-500 bg-slate-950/50">
            <tr>
              <th className="text-left font-medium px-4 py-2">Error</th>
              <th className="text-left font-medium px-4 py-2">Area</th>
              <th className="text-right font-medium px-4 py-2">Hits</th>
              <th className="text-right font-medium px-4 py-2">Users</th>
              <th className="text-right font-medium px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, 10).map((g) => (
              <tr key={g.fingerprint} className="border-t border-slate-800/70">
                <td className="px-4 py-3 max-w-md">
                  <p className="text-slate-200 font-medium truncate">{g.name}</p>
                  <p className="text-xs text-slate-500 truncate">{g.message}</p>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    {g.source === "worker" ? <Cpu className="h-3.5 w-3.5" /> : <Server className="h-3.5 w-3.5" />}
                    {g.feature ?? g.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-200 font-medium">{g.count}</td>
                <td className="px-4 py-3 text-right text-slate-400">{g.affectedUsers}</td>
                <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                  {new Date(g.lastSeen).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Full detail for one occurrence: stack, request context, blast radius. */
function ErrorDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { error, loading } = useAdminErrorDetail(id)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full overflow-y-auto bg-slate-950 border-l border-slate-800 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100 break-words">
              {loading ? "Loading…" : error?.name ?? "Error"}
            </h2>
            {error && <p className="text-sm text-slate-400 mt-1 break-words">{error.message}</p>}
          </div>
          <AdminButton variant="secondary" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </AdminButton>
        </div>

        {error && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Source", error.source],
                ["Feature", error.feature ?? "—"],
                ["Route", error.route ? `${error.method ?? ""} ${error.route}`.trim() : "—"],
                ["Status", error.status_code ? String(error.status_code) : "—"],
                ["User", error.profiles?.email ?? error.user_id ?? "anonymous"],
                ["When", new Date(error.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm text-slate-200 break-words">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-400 px-3 py-1">
                <Bug className="h-3.5 w-3.5" /> {error.occurrences.last24h} in 24h
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 text-slate-300 px-3 py-1">
                {error.occurrences.allTime} all time
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-400 px-3 py-1">
                <Users className="h-3.5 w-3.5" /> {error.affectedUsers} users affected
              </span>
              {error.alerted_at && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 text-violet-300 px-3 py-1">
                  <BellRing className="h-3.5 w-3.5" /> emailed
                </span>
              )}
            </div>

            {Object.keys(error.context ?? {}).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Context</h3>
                <pre className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              </div>
            )}

            {error.stack && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Stack</h3>
                <pre className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminErrorsPage() {
  const [page, setPage] = useState(1)
  const [source, setSource] = useState("")
  const [feature, setFeature] = useState("")
  const [hours, setHours] = useState("24")
  const [selected, setSelected] = useState<string | null>(null)

  const { data, total, loading } = useAdminErrors(page, { source, feature, hours })
  const { groups, loading: summaryLoading } = useAdminErrorSummary(Number(hours) || 24)

  const totalPages = Math.ceil((total || 0) / 30)
  const reset = () => setPage(1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Errors</h1>
        <p className="text-slate-400 mt-1">
          Every API exception and failed background job, with the stack and request context.
          5xx failures also email you, once per bug per 30 minutes.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={hours} onValueChange={(v) => { setHours(v); reset(); }}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="1">Last hour</SelectItem>
            <SelectItem value="24">Last 24 hours</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
            <SelectItem value="720">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={source || "all"} onValueChange={(v) => { setSource(v === "all" ? "" : v); reset(); }}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="api">API requests</SelectItem>
            <SelectItem value="worker">Background jobs</SelectItem>
          </SelectContent>
        </Select>

        <Select value={feature || "all"} onValueChange={(v) => { setFeature(v === "all" ? "" : v); reset(); }}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All features" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All features</SelectItem>
            {FEATURES.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TopErrors groups={groups} loading={summaryLoading} />

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-lg animate-pulse" />
          ))
        ) : !data?.length ? (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No errors match these filters</p>
          </div>
        ) : (
          data.map((e: ErrorLog) => {
            const who = e.profiles?.full_name || e.profiles?.name || e.profiles?.email || "anonymous"
            return (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className="w-full text-left flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 hover:border-slate-700 transition-colors"
              >
                <div className="mt-0.5 h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  {e.source === "worker"
                    ? <Cpu className="h-4 w-4 text-red-400" />
                    : <Server className="h-4 w-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">
                    <span className="font-medium text-red-400">{e.name ?? "Error"}</span>{" "}
                    <span className="text-slate-500">·</span>{" "}
                    <span className="text-slate-400">{e.feature ?? e.source}</span>
                    {e.route && <span className="text-slate-500 text-xs ml-1.5">{e.method} {e.route}</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 break-words line-clamp-2">{e.message}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{who}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {e.status_code && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(e.status_code)}`}>
                      {e.status_code}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} errors</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      )}

      {selected && <ErrorDetail id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
