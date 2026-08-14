/**
 * TESA, shards rather than a crate.
 *
 * Until now a shard was drawn as the same chest, only dimmed into green. That
 * contradicted everything said about it: five TESA make up one ticket, so each
 * one on its own is a PART, not a whole thing. A chest next to a chest read as
 * "another case, only worse", when in fact it is a piece of the next one.
 *
 * So this is not a crate but three chipped off tiles. The shape is deliberately
 * angular and uneven, a shard is never symmetric, but the lines are the same as
 * on the chest edges: a dark body, a neon rib, a narrow chamfer. One material,
 * different states.
 *
 * Drawn as vector rather than as a picture: a shard is small (44 pixels in the
 * strip, 20 in the header), and at that size a raster turns into a green blob,
 * while three crisp edges stay three edges.
 */
export function Shards({
  size = 64,
  ink = "var(--color-tier-shard)",
  flat = false,
  className,
  style,
}: {
  size?: number;
  /** The tier colour. TESA by default. */
  ink?: string;
  /**
   * Icon mode: lines only, no filled body and no light under the pile.
   *
   * An item and an icon are different jobs. An item stands on the stage and has
   * to be a THING: a dark hull, a neon rib, light from below. An icon stands in
   * a row next to other icons, and all of them are drawn with a single line
   * weight on an empty background. A shard with a filled body in such a row
   * reads as a dark blob between clean lines, not as a different item but as a
   * defect.
   */
  flat?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // The gradient name comes from the colour itself rather than being one for
  // all.
  //
  // ids in <defs> are global to the whole document: two shards of different
  // colours with the same id turn into two shards of the FIRST colour. And they
  // do turn up side by side, white in the wallet panel and green in the drops
  // strip on the same page.
  //
  // The key is the colour specifically rather than random: two shards of the
  // same colour must share one gradient, otherwise each draws its own copy of
  // the same thing.
  const key = ink.replace(/[^a-zA-Z0-9]/g, "");
  const body = `tesa-body-${key}`;
  const face = `tesa-face-${key}`;

  // In icon mode it is not only the fill that changes, but two more things
  // that made the shard read as smaller and dimmer than its neighbours in the
  // same row.
  //
  // The stroke. A line icon has a weight of 2 in a field of 24, that is, a
  // twelfth of the field. Here the field is 100 and the stroke was 2.4, a
  // fortieth. At 34 pixels that is 0.8 pixels against 2.3 in the neighbours:
  // not "a different drawing" but a faded one.
  //
  // The field. The shards occupy x 12 to 88 and y 22 to 76, that is, a little
  // over half the square vertically. An icon of 34 pixels came out eighteen
  // tall, while the wallet next to it is twenty eight. We crop the field to the
  // drawing itself, and then the size given means the size.
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
        {/* The body of a shard is dark like the chest hull: the colour comes from
            the rib, not the fill. Otherwise three bright patches merge into a
            single leaf. */}
        <linearGradient id={body} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={`color-mix(in oklab, ${ink} 34%, #060a06)`} />
          <stop offset="100%" stopColor="#060a06" />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={`color-mix(in oklab, ${ink} 20%, #060a06)`} />
          <stop offset="100%" stopColor="#040704" />
        </linearGradient>
      </defs>

      {/* A soft light under the pile, the same as around the chest, only smaller:
          a shard glows, but not like a prize. An icon does not get it: in a row
          of icons only one has a halo. */}
      {!flat && (
        <ellipse cx="50" cy="62" rx="34" ry="24" fill={ink} opacity="0.16" filter="blur(9px)" />
      )}

      {/* The large shard. The rib on top is bright, the break below is dull: that
          is how it reads as a chipped off piece rather than a shape. */}
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

      {/* Two small ones beside it, and they are what turn the item into a "pile".
          One lies flat, the other stands on its edge. */}
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

      {/* Two sparks, exactly as much motion as the smallest prize should have. */}
      <circle cx="80" cy="30" r="2.4" fill={ink} opacity="0.75" />
      <circle cx="20" cy="40" r="1.6" fill={ink} opacity="0.5" />
    </svg>
  );
}
