/**
 * The Tessera mark: a mosaic drawn from without replacement.
 *
 * Sixteen tiles in a 4x4 grid, each in one of three states:
 *   filled quietly          still in the pool;
 *   filled bright, with a slot   the one being opened now;
 *   outline only            already drawn, gone for everyone.
 *
 * So the mark draws the very rule the game rests on.
 *
 * ── Why not an image ─────────────────────────────────────────────────
 * In the brand pack the mark is gold, and on the site that does not work: gold
 * already means something here, the VAULT, the top of the rarity ladder. Beside
 * the golden sum of the vaults in the same header the mark would make the colour
 * say two different things at once, and a colour that means two things means
 * neither.
 *
 * So the mark is monochrome and takes its colour from CSS through currentColor.
 * And currentColor does not work inside an <img> at all: the picture is rendered
 * in its own document and knows nothing of the page's colour. Hence a vector
 * right in the markup.
 *
 * The three states survive: they are held by opacity rather than colour. That is
 * even more honest, since the mark never had three different colours, only
 * dimmer and brighter.
 *
 * ── The slot ─────────────────────────────────────────────────────────
 * The cut in the tile being opened is made with a mask rather than a rectangle
 * filled with the background colour. A filled one would have to be repainted for
 * every place the mark appears: #080d09 in the header, #060a06 in the footer,
 * white in a future light themed email. A mask gives a real hole, and the mark
 * sits on anything.
 */
export function Mark({
  size = 36,
  simple = false,
  className,
}: {
  size?: number;
  /**
   * The simplified mark: no drawn tiles and no slot.
   *
   * Not a token "lite version" but a requirement of size. The outline of a drawn
   * tile is 1.3 thick on a field of 100, which at twenty four pixels is 0.3 of a
   * pixel, that is, nothing. The 5 unit slot at the same size is one pixel.
   * Together they turn the mark into a smear, so below about 28 pixels only the
   * grid remains. The brand pack does the same.
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
