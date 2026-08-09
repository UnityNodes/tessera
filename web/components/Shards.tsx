/**
 *
 *
 *
 */
export function Shards({
  size = 64,
  ink = "var(--color-tier-shard)",
  flat = false,
  className,
  style,
}: {
  size?: number;
  ink?: string;
  /**
   *
   */
  flat?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  //
  //
  const key = ink.replace(/[^a-zA-Z0-9]/g, "");
  const body = `tesa-body-${key}`;
  const face = `tesa-face-${key}`;

  //
  //
  const box = flat ? "8 18 84 62" : "0 0 100 100";
  const w = flat ? 2.6 : 1;

  return (
    <svg
      viewBox={box}
      width={size}
      height={flat ? (size * 62) / 84 : size}
      className={className}
      aria-hidden
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={`color-mix(in oklab, ${ink} 34%, #060a06)`} />
          <stop offset="100%" stopColor="#060a06" />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={`color-mix(in oklab, ${ink} 20%, #060a06)`} />
          <stop offset="100%" stopColor="#040704" />
        </linearGradient>
      </defs>

      {!flat && (
        <ellipse cx="50" cy="62" rx="34" ry="24" fill={ink} opacity="0.16" filter="blur(9px)" />
      )}

      <g>
        <path
          d="M30 30 L62 22 L74 44 L56 72 L28 64 Z"
          fill={flat ? "none" : `url(#${body})`}
          stroke={ink}
          strokeWidth={2.4 * w}
          strokeLinejoin="round"
        />
        <path d="M30 30 L62 22 L56 40 Z" fill={ink} opacity={flat ? 0.16 : 0.22} />
        <path d="M56 40 L74 44 L56 72 Z" fill={flat ? "none" : `url(#${face})`} />
        <path d="M30 30 L56 40 L56 72 L28 64 Z" fill="none" stroke={ink} strokeWidth={1.1 * w} opacity={flat ? 0.7 : 0.45} />
      </g>

      <path
        d="M12 56 L30 50 L34 66 L18 74 Z"
        fill={flat ? "none" : `url(#${body})`}
        stroke={ink}
        strokeWidth={2 * w}
        strokeLinejoin="round"
      />
      <path d="M12 56 L30 50 L26 60 Z" fill={ink} opacity={flat ? 0.16 : 0.2} />

      <path
        d="M68 58 L86 54 L88 70 L72 76 Z"
        fill={flat ? "none" : `url(#${body})`}
        stroke={ink}
        strokeWidth={2 * w}
        strokeLinejoin="round"
      />
      <path d="M68 58 L86 54 L82 64 Z" fill={ink} opacity={flat ? 0.16 : 0.2} />

      <circle cx="80" cy="30" r="2.4" fill={ink} opacity="0.75" />
      <circle cx="20" cy="40" r="1.6" fill={ink} opacity="0.5" />
    </svg>
  );
}
