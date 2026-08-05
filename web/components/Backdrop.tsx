/**
 *
 *
 */

const POOLS = [
  {
    w: "78vw",
    h: "66vw",
    top: "-30vw",
    right: "-16vw",
    tint: "oklch(78% 0.165 70 / 0.34)",
    anim: "pool-drift 38s ease-in-out infinite",
  },
  {
    w: "70vw",
    h: "62vw",
    bottom: "-28vw",
    left: "-18vw",
    tint: "oklch(62% 0.20 255 / 0.38)",
    anim: "pool-drift 52s ease-in-out infinite reverse",
  },
  {
    w: "50vw",
    h: "44vw",
    top: "34%",
    left: "32%",
    tint: "oklch(64% 0.25 340 / 0.18)",
    anim: "pool-drift 64s ease-in-out infinite",
  },
  {
    w: "46vw",
    h: "40vw",
    top: "58%",
    right: "6%",
    tint: "oklch(72% 0.15 190 / 0.14)",
    anim: "pool-drift 46s ease-in-out infinite reverse",
  },
] as const;

const MOTES = [
  { left: "9%", top: "82%", size: 3, dur: "34s", delay: "0s", dx: "3vw", o: 0.34, tint: "oklch(80% 0.14 75)" },
  { left: "21%", top: "94%", size: 2, dur: "46s", delay: "6s", dx: "-2vw", o: 0.22, tint: "oklch(70% 0.16 255)" },
  { left: "34%", top: "88%", size: 2, dur: "40s", delay: "13s", dx: "4vw", o: 0.26, tint: "oklch(80% 0.14 75)" },
  { left: "47%", top: "96%", size: 3, dur: "52s", delay: "3s", dx: "-3vw", o: 0.3, tint: "oklch(70% 0.16 255)" },
  { left: "58%", top: "86%", size: 2, dur: "38s", delay: "20s", dx: "2vw", o: 0.24, tint: "oklch(80% 0.14 75)" },
  { left: "69%", top: "92%", size: 3, dur: "44s", delay: "9s", dx: "-4vw", o: 0.32, tint: "oklch(80% 0.14 75)" },
  { left: "78%", top: "84%", size: 2, dur: "56s", delay: "16s", dx: "3vw", o: 0.2, tint: "oklch(70% 0.16 255)" },
  { left: "88%", top: "95%", size: 3, dur: "42s", delay: "26s", dx: "-2vw", o: 0.28, tint: "oklch(80% 0.14 75)" },
  { left: "15%", top: "90%", size: 2, dur: "50s", delay: "31s", dx: "5vw", o: 0.18, tint: "oklch(70% 0.16 255)" },
  { left: "63%", top: "98%", size: 2, dur: "36s", delay: "23s", dx: "-3vw", o: 0.24, tint: "oklch(80% 0.14 75)" },
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

      {MOTES.map((m, i) => (
        <span
          key={i}
          className="floor__mote"
          style={
            {
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              background: m.tint,
              boxShadow: `0 0 ${m.size * 4}px ${m.tint}`,
              animationDuration: m.dur,
              animationDelay: m.delay,
              "--mote-dx": m.dx,
              "--mote-opacity": m.o,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
