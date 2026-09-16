"use client"

import type { InputHTMLAttributes, ReactNode } from "react"

/**
 * Form primitives for the "Studio Floor" auth screens.
 *
 * The handoff specifies underline fields and mono buttons, which the shadcn
 * Input/Button in @repo/ui do not do, so these are local to the auth pages
 * rather than a change to the shared primitives every other screen uses.
 */

const INK = "#12151A"
const GROUND = "#F7F8FC"
const PINK = "#ec4899"
const PURPLE = "#a855f7"
// Primary CTA wears the brand ramp: indigo to purple to pink, same family as
// the logo and the site CTA gradient.
const CTA_GRADIENT = "linear-gradient(135deg,#6366f1 0%,#a855f7 55%,#ec4899 100%)"
const CTA_GRADIENT_HOVER = "linear-gradient(135deg,#4f46e5 0%,#9333ea 55%,#db2777 100%)"
const ERROR = "#C0453F"

export const authKeyframes = `
  @keyframes au-rise { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
  @keyframes au-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
  @keyframes au-spin { to { transform: rotate(360deg) } }
  .au-rise { animation: au-rise .4s ease both; }
  .au-rise-fast { animation: au-rise .25s ease both; }
  .au-shake { animation: au-shake .4s ease; }
  .au-spin { animation: au-spin .7s linear infinite; }
  .au-input:focus { border-bottom-color: ${PURPLE} !important; }
  .au-cta:hover:not(:disabled) { transform: translateY(-2px); background: ${CTA_GRADIENT_HOVER}; box-shadow: 0 14px 34px rgba(168,85,247,.34); }
  .au-google:hover { border-color: ${PURPLE}; color: ${PURPLE}; }
  @media (prefers-reduced-motion: reduce) {
    .au-rise, .au-rise-fast, .au-shake, .au-spin { animation: none; }
    .au-cta:hover:not(:disabled) { transform: none; }
  }
`

export function AuthField({
  label,
  error,
  shake,
  labelAction,
  children,
  ...input
}: {
  label: string
  error?: string
  shake?: boolean
  labelAction?: ReactNode
  children?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span
        className="au-mono mb-2 flex items-baseline justify-between font-bold"
        style={{ fontSize: "10px", letterSpacing: ".18em", color: "rgba(18,21,26,.4)" }}
      >
        {label}
        {labelAction}
      </span>
      <input
        {...input}
        className={`au-input w-full box-border bg-transparent outline-none ${shake ? "au-shake" : ""}`}
        style={{
          padding: "0 0 10px",
          border: 0,
          borderBottom: `1.5px solid ${error ? ERROR : "rgba(18,21,26,.2)"}`,
          color: INK,
          fontSize: "16px",
          transition: "border-color .2s",
        }}
      />
      {error && (
        <span
          className="au-rise-fast mt-2 block font-medium"
          style={{ fontSize: "12px", color: ERROR }}
        >
          {error}
        </span>
      )}
      {children}
    </label>
  )
}

/** Four-bar strength meter from the handoff. `score` is 0-4. */
export function PasswordStrength({ score, label }: { score: number; label: string }) {
  const colors = ["#2563eb", "#6366f1", "#a855f7", "rgba(18,21,26,.14)"]
  return (
    <span className="au-rise mt-3 flex items-center gap-[5px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="flex-1"
          style={{
            height: 3,
            borderRadius: 2,
            background: i < score ? colors[Math.min(i, 2)] : "rgba(18,21,26,.14)",
          }}
        />
      ))}
      <span
        className="au-mono font-bold"
        style={{ fontSize: "10px", letterSpacing: ".1em", color: "rgba(18,21,26,.45)" }}
      >
        {label}
      </span>
    </span>
  )
}

export function AuthSubmit({
  loading,
  loadingLabel,
  children,
  ...props
}: {
  loading?: boolean
  loadingLabel: string
  children: ReactNode
} & InputHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...(props as object)}
      type="submit"
      disabled={loading}
      className="au-cta mt-8 w-full cursor-pointer disabled:cursor-not-allowed"
      style={{
        padding: 16,
        border: 0,
        borderRadius: 6,
        background: CTA_GRADIENT,
        color: "#ffffff",
        transition: "transform .16s, box-shadow .22s, background .2s",
      }}
    >
      <span
        className="au-mono inline-flex items-center gap-[9px] font-bold"
        style={{ fontSize: "12.5px", letterSpacing: ".12em" }}
      >
        {loading && (
          <span
            className="au-spin"
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.35)",
              borderTopColor: "#ffffff",
            }}
          />
        )}
        {loading ? loadingLabel : children}
      </span>
    </button>
  )
}

/** Google mark kept as the real asset, not the mock's gradient placeholder. */
export function GoogleButton({ label = "GOOGLE", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="au-google mt-[10px] flex w-full cursor-pointer items-center justify-center gap-[10px]"
      style={{
        padding: 15,
        border: "1.5px solid rgba(18,21,26,.16)",
        borderRadius: 6,
        background: "transparent",
        color: INK,
        transition: "border-color .2s",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      <span className="au-mono font-bold" style={{ fontSize: "12.5px", letterSpacing: ".1em" }}>
        {label}
      </span>
    </button>
  )
}

export function AuthFootLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[22px]" style={{ fontSize: "12.5px", lineHeight: 1.6, color: "rgba(18,21,26,.5)" }}>
      {children}
    </p>
  )
}

export function AuthFootLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-bold no-underline"
      style={{ color: INK, borderBottom: "2px solid #a855f7" }}
    >
      {children}
    </a>
  )
}
