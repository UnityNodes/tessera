const GLINTS = [
  { left: "12%", top: "22%", delay: "0s", tint: "var(--color-tier-aureus)" },
  { left: "31%", top: "64%", delay: "1.7s", tint: "var(--color-accent)" },
  { left: "48%", top: "14%", delay: "3.1s", tint: "var(--color-tier-denarius)" },
  { left: "63%", top: "48%", delay: "4.4s", tint: "var(--color-tier-aureus)" },
  { left: "79%", top: "28%", delay: "2.3s", tint: "var(--color-accent)" },
  { left: "88%", top: "72%", delay: "5.6s", tint: "var(--color-tier-porphyry)" },
  { left: "21%", top: "86%", delay: "6.2s", tint: "var(--color-tier-aureus)" },
  { left: "70%", top: "88%", delay: "0.9s", tint: "var(--color-accent)" },
];

export function Backdrop() {
  return (
    <div className="floor" aria-hidden>
      <div
        className="floor__pool"
        style={{
          width: "70vw",
          height: "60vw",
          top: "-26vw",
          right: "-12vw",
          background:
            "radial-gradient(closest-side, oklch(78% 0.165 70 / 0.30), transparent 70%)",
          animation: "pool-drift 34s ease-in-out infinite",
        }}
      />
      <div
        className="floor__pool"
        style={{
          width: "62vw",
          height: "56vw",
          bottom: "-24vw",
          left: "-14vw",
          background: "radial-gradient(closest-side, oklch(62% 0.20 255 / 0.34), transparent 70%)",
          animation: "pool-drift 46s ease-in-out infinite reverse",
        }}
      />
      <div
        className="floor__pool"
        style={{
          width: "44vw",
          height: "40vw",
          top: "38%",
          left: "36%",
          background: "radial-gradient(closest-side, oklch(64% 0.25 340 / 0.16), transparent 70%)",
          animation: "pool-drift 58s ease-in-out infinite",
        }}
      />

      <div className="floor__tiles" />

      {GLINTS.map((g) => (
        <span
          key={`${g.left}${g.top}`}
          className="floor__glint"
          style={{
            left: g.left,
            top: g.top,
            animationDelay: g.delay,
            background: `linear-gradient(150deg, ${g.tint}, transparent 70%)`,
            boxShadow: `0 0 24px -2px ${g.tint}`,
          }}
        />
      ))}
    </div>
  );
}
