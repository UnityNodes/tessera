/**
 *
 *
 *
 *
 *
 *
 */
export function Mark({
  size = 36,
  simple = false,
  className,
}: {
  size?: number;
  /**
   *
   */
  simple?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      data-mark={simple ? "simple" : "full"}
      role="img"
      aria-label="Tessera"
      className={className}
      style={{ display: "block" }}
    >
      <title>Tessera</title>

      {!simple && (
        <defs>
          <mask id="tessera-mark-slot">
            <rect x="32" y="53" width="15" height="15" rx="3" fill="#fff" />
            <rect x="37" y="58" width="5" height="5" rx="1" fill="#000" />
          </mask>
        </defs>
      )}

      <g fill="currentColor" opacity={0.62}>
        <rect x="74" y="11" width="15" height="15" rx="3" />
        <rect x="53" y="32" width="15" height="15" rx="3" />
        <rect x="74" y="32" width="15" height="15" rx="3" />
        <rect x="53" y="53" width="15" height="15" rx="3" />
        <rect x="74" y="53" width="15" height="15" rx="3" />
        <rect x="11" y="74" width="15" height="15" rx="3" />
        <rect x="32" y="74" width="15" height="15" rx="3" />
        <rect x="53" y="74" width="15" height="15" rx="3" />
        <rect x="74" y="74" width="15" height="15" rx="3" />
      </g>

      <rect
        x="32"
        y="53"
        width="15"
        height="15"
        rx="3"
        fill="currentColor"
        mask={simple ? undefined : "url(#tessera-mark-slot)"}
      />

      {!simple && (
        <g fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth="1.3">
          <rect x="11" y="11" width="15" height="15" rx="3" />
          <rect x="32" y="11" width="15" height="15" rx="3" />
          <rect x="53" y="11" width="15" height="15" rx="3" />
          <rect x="11" y="32" width="15" height="15" rx="3" />
          <rect x="32" y="32" width="15" height="15" rx="3" />
          <rect x="11" y="53" width="15" height="15" rx="3" />
        </g>
      )}
    </svg>
  );
}
