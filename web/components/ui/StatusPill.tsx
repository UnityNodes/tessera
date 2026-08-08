/**
 *
 *
 */
export type Status = "waiting" | "live" | "won" | "lost" | "done";

const TONE: Record<Status, { ink: string; bg: string; label: string }> = {
  waiting: { ink: "var(--color-tier-vault)", bg: "rgb(255 210 63 / 0.12)", label: "Waiting" },
  live: { ink: "var(--color-danger-soft)", bg: "rgb(255 45 85 / 0.14)", label: "In progress" },
  won: { ink: "var(--color-accent)", bg: "rgb(57 255 136 / 0.14)", label: "Won" },
  lost: { ink: "var(--color-tier-grout)", bg: "rgb(144 153 166 / 0.14)", label: "Lost" },
  done: { ink: "var(--color-ink-dim)", bg: "rgb(124 144 131 / 0.12)", label: "Settled" },
};

export function StatusPill({
  status,
  children,
  className = "",
}: {
  status: Status;
  children?: React.ReactNode;
  className?: string;
}) {
  const tone = TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-chip)] px-3.5 py-1.5 text-xs font-extrabold ${className}`}
      style={{ background: tone.bg, color: tone.ink }}
    >
      {status === "live" && (
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{
            background: "currentColor",
            boxShadow: "0 0 8px currentColor",
            animation: "marker-live 1.4s ease-in-out infinite",
          }}
        />
      )}
      {children ?? tone.label}
    </span>
  );
}
