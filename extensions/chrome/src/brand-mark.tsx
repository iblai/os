import './brand/mark.css';

const BLUE = '#3e6bad';

/**
 * The ibl.ai mark, animating, for the moment before the panel knows whether
 * anyone is signed in.
 *
 * Hand-built from `brand/iblai-logo.json` rather than played with a Lottie
 * runtime: that runtime costs 357 kB for one two-second loop, on the very
 * screen shown while the panel is still starting. The geometry, colours and
 * frame timings below are transcribed from that file — see `brand/mark.css`,
 * whose keyframes are generated from the same frame numbers.
 *
 * `label` is what a screen reader hears. The motion says "working" to someone
 * watching; without it the wait would be silent to everyone else.
 */
export function BrandMark({ label }: { label: string }) {
  return (
    <svg
      className="mark"
      viewBox="0 0 840 360"
      role="status"
      aria-label={label}
      data-testid="brand-mark"
    >
      <defs>
        <linearGradient
          id="mark-disc-fill"
          gradientUnits="userSpaceOnUse"
          x1="135"
          y1="10"
          x2="135"
          y2="236"
        >
          <stop offset="0" stopColor="#5da0d9" />
          <stop offset="1" stopColor="#3c67aa" />
        </linearGradient>
        {/* The wave is cut OUT of the disc — an inverted alpha matte in the
            original, so the disc must not simply be painted over. */}
        <mask id="mark-wave">
          <rect x="0" y="0" width="840" height="360" fill="#fff" />
          <path
            d="M0 170 C50 146 80 136 120 116 C134 110 122 148 136 150 C176 144 200 120 270 80"
            fill="none"
            stroke="#000"
            strokeWidth="30"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <circle
        className="mark-disc"
        cx="135"
        cy="125"
        r="113"
        fill="url(#mark-disc-fill)"
        mask="url(#mark-wave)"
      />

      <g fill="none" stroke={BLUE} strokeWidth="22" strokeLinejoin="round">
        <g className="mark-i1">
          <path d="M314 195V340" />
        </g>
        <g className="mark-b">
          <path d="M376 128V340" />
          <ellipse cx="442" cy="268" rx="56" ry="62" />
        </g>
        <g className="mark-l">
          <path d="M536 128V340" />
        </g>
        <g className="mark-a">
          <ellipse cx="694" cy="270" rx="52" ry="59" />
          <path d="M748 206V340" />
        </g>
        <g className="mark-i2">
          <path d="M799 195V340" />
        </g>
      </g>

      <g fill={BLUE}>
        <circle className="mark-d1" cx="314" cy="160" r="14" />
        <g className="mark-dot">
          <circle className="mark-d2" cx="623" cy="327" r="14" />
        </g>
        <circle className="mark-d3" cx="799" cy="160" r="14" />
      </g>
    </svg>
  );
}
