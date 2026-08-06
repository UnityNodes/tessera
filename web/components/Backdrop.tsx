/**
 *
 *
 */

const POOLS = [
  {
    w: "72vw",
    h: "60vw",
    top: "-26vw",
    right: "-14vw",
    tint: "rgb(6 182 212 / 0.16)",
    anim: "pool-drift 44s ease-in-out infinite",
  },
  {
    w: "66vw",
    h: "58vw",
    bottom: "-26vw",
    left: "-16vw",
    tint: "rgb(37 99 235 / 0.16)",
    anim: "pool-drift 58s ease-in-out infinite reverse",
  },
  {
    w: "48vw",
    h: "42vw",
    top: "42%",
    left: "34%",
    tint: "rgb(168 85 247 / 0.08)",
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
