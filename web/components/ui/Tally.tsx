/**
 * A number with a caption, the right hand side of any header.
 *
 * The setting comes from the system: an Orbitron caption, small and tracked out,
 * with the number itself below it in the same Orbitron, heavy. It lived in the
 * arena and was repeated across pages with small deviations; now there is one
 * for all.
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
  /** A small line under the number, when the number alone leaves something unsaid. */
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
