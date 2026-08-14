/**
 * The light under the page.
 *
 * In the reference, depth comes from two or three large colour blooms under a
 * blur-3xl: teal at the top right, blue at the bottom left. The same here, only
 * across the whole document rather than inside one section: the bands under the
 * header and the sections with their own background sit on top, so a bloom shows
 * through exactly where the background is transparent.
 *
 * The dust motes went away along with the mosaic grid: the reference language
 * has no small moving particles at all, and they were the only thing arguing
 * with the clean planes beneath them.
 *
 * The blooms are green now and twice as quiet. The blue ones were the most
 * visible fragment of the old language: they painted the whole hero teal, that
 * is, in the colour the system reserves for action, while here it spoke about
 * nothing.
 */

const POOLS = [
  {
    w: "72vw",
    h: "60vw",
    top: "-26vw",
    right: "-14vw",
    tint: "rgb(57 255 136 / 0.09)",
    anim: "pool-drift 44s ease-in-out infinite",
  },
  {
    w: "66vw",
    h: "58vw",
    bottom: "-26vw",
    left: "-16vw",
    tint: "rgb(31 207 108 / 0.07)",
    anim: "pool-drift 58s ease-in-out infinite reverse",
  },
  {
    w: "48vw",
    h: "42vw",
    top: "42%",
    left: "34%",
    tint: "rgb(57 255 136 / 0.05)",
    anim: "pool-drift 66s ease-in-out infinite",
  },
] as const;

export function Backdrop() {
  return (
    <div className="floor" aria-hidden>
      {POOLS.map((p, i) => (
        <div
          key={i}
          className="floor__pool"
          style={{
            width: p.w,
            height: p.h,
            top: "top" in p ? p.top : undefined,
            bottom: "bottom" in p ? p.bottom : undefined,
            left: "left" in p ? p.left : undefined,
            right: "right" in p ? p.right : undefined,
            background: `radial-gradient(closest-side, ${p.tint}, transparent 70%)`,
            animation: p.anim,
          }}
        />
      ))}
    </div>
  );
}
