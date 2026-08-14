/**
 * A state in a single pill.
 *
 * It stands both in an arena row and in the header of an individual battle, so
 * that what a person clicked in the list is called the same on the page they
 * landed on.
 *
 * "Running" is no longer red. All seven error messages in this interface are set
 * in red, and a battle that is running RIGHT NOW was highlighted in the same
 * colour as a transaction that had just failed. Now it is white, and "now" is
 * said by the pulse next to it: motion is a signal no other state has, and it
 * does not borrow meaning from colour.
 *
 * Five states, five different looks, no overlap:
 *   waiting  gold
 *   running  white with a pulse
 *   won      green
 *   lost     grey
 *   settled  quiet
 */
export type Status = "waiting" | "live" | "won" | "lost" | "done";

const TONE: Record<Status, { ink: string; bg: string; label: string }> = {
  waiting: { ink: "var(--color-tier-vault)", bg: "rgb(255 210 63 / 0.12)", label: "Waiting" },
  live: { ink: "var(--color-ink)", bg: "rgb(232 245 236 / 0.12)", label: "In progress" },
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
  /** Its own state name, when on this screen it is more precise than the general one. */
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
