/**
 *
 */
export function Tally({
  label,
  value,
  ink,
  note,
}: {
  label: string;
  value: string | number;
  ink?: string;
  note?: string;
}) {
  return (
    <div className="text-right">
      <span className="t-label block">{label}</span>
      <span
        className="t-chain text-2xl font-extrabold leading-tight"
        style={{ color: ink ?? "var(--color-ink)" }}
      >
        {value}
      </span>
      {note && <span className="t-chain block text-xs text-slate-400">{note}</span>}
    </div>
  );
}
