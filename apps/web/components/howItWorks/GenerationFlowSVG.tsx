/**
 * "What happens when you press Generate": a horizontal rail with a packet that
 * stops at each stage, and a beam that lights the segment it is crossing.
 *
 * Same beam technique and palette as PipelineSVG, so the two diagrams on this
 * page read as one system. Pure SVG plus CSS keyframes, reduced-motion guarded.
 */

const STAGES = [
  { x: 60, label: "Your prompt", sub: "topic + tone" },
  { x: 230, label: "Style profile", sub: "from your videos" },
  { x: 400, label: "Generation", sub: "on Vertex AI" },
  { x: 570, label: "Your draft", sub: "editable" },
]

/** One segment per gap between stages, lit in turn as the packet crosses it. */
const SEGMENTS = [
  { d: "M60 110 H230", delay: "0s" },
  { d: "M230 110 H400", delay: "1.8s" },
  { d: "M400 110 H570", delay: "3.6s" },
]

export default function GenerationFlowSVG({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 700 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Pipeline diagram: your prompt is combined with the style profile learned from your videos, generated on Vertex AI, and returned as an editable draft"
    >
      <defs>
        <linearGradient id="gf-beam" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#a855f7" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient id="gf-packet" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{`
        .gf-seg {
          stroke-dasharray: 18 82;
          stroke-dashoffset: 100;
          animation: gf-run 5.4s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        .gf-packet { animation: gf-travel 5.4s cubic-bezier(0.5, 0, 0.5, 1) infinite; }
        .gf-halo { animation: gf-breathe 5.4s ease-in-out infinite; }
        .gf-ring { animation: gf-light 5.4s ease-out infinite; }
        .gf-num { animation: gf-ink 5.4s ease-out infinite; }

        @keyframes gf-run {
          0%        { stroke-dashoffset: 100; opacity: 0; }
          2%        { opacity: 1; }
          30%       { stroke-dashoffset: 0; opacity: 1; }
          34%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes gf-travel {
          0%, 4%     { transform: translateX(0); }
          30%, 37%   { transform: translateX(170px); }
          63%, 70%   { transform: translateX(340px); }
          96%, 100%  { transform: translateX(510px); }
        }
        @keyframes gf-breathe {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @keyframes gf-light {
          0%, 8%    { stroke: #cbd5e1; stroke-width: 2; }
          16%       { stroke: #6366f1; stroke-width: 3; }
          40%, 100% { stroke: #cbd5e1; stroke-width: 2; }
        }
        @keyframes gf-ink {
          0%, 8%    { fill: #94a3b8; }
          16%       { fill: #4f46e5; }
          40%, 100% { fill: #94a3b8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gf-seg, .gf-packet, .gf-halo, .gf-ring, .gf-num { animation: none; }
          .gf-seg { stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0.5; }
          .gf-ring { stroke: #cbd5e1; }
          .gf-num { fill: #4f46e5; }
        }
      `}</style>

      {/* the rail */}
      <path d="M60 110 H610" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />

      {/* per-segment beams, lit in sequence */}
      {SEGMENTS.map((seg) => (
        <path
          key={seg.d}
          d={seg.d}
          pathLength="100"
          stroke="url(#gf-beam)"
          strokeWidth="3"
          strokeLinecap="round"
          className="gf-seg"
          style={{ animationDelay: seg.delay }}
        />
      ))}

      {/* the packet hopping stage to stage */}
      <g className="gf-packet">
        <circle className="gf-halo" cx="60" cy="110" r="14" fill="url(#gf-packet)" />
        <circle cx="60" cy="110" r="5.5" fill="#6366f1" />
      </g>

      {STAGES.map((stage, i) => (
        <g key={stage.label}>
          <circle cx={stage.x} cy="110" r="16" fill="#ffffff" />
          <circle
            className="gf-ring"
            cx={stage.x}
            cy="110"
            r="16"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
            style={{ animationDelay: `${i * 1.8}s` }}
          />
          <text
            className="gf-num"
            x={stage.x}
            y="116"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#94a3b8"
            style={{ animationDelay: `${i * 1.8}s` }}
          >
            {i + 1}
          </text>
          <text x={stage.x} y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1e293b">
            {stage.label}
          </text>
          <text x={stage.x} y="164" textAnchor="middle" fontSize="11" fill="#64748b">
            {stage.sub}
          </text>
        </g>
      ))}
    </svg>
  )
}
