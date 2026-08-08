/**
 *
 *
 */
export function TierPlate({
  name,
  ink,
  className = "",
}: {
  name: string;
  ink: string;
  className?: string;
}) {
  return (
    <span
      className={`t-label inline-block rounded-[6px] px-2.5 py-1 text-[0.6875rem] ${className}`}
      style={{
        color: ink,
        background: `color-mix(in oklab, ${ink} 9%, transparent)`,
        letterSpacing: "0.1em",
      }}
    >
      {name}
    </span>
  );
}
