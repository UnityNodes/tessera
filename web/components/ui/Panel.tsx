interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A small caption above, like a label on a museum display. */
  label?: string;
  children: React.ReactNode;
}

/**
 * The panel. One for the whole interface: the same translucent background, the
 * same border, the same corner, everything described in .slab.
 */
export function Panel({ label, children, className = "", ...rest }: PanelProps) {
  return (
    <div className={`slab ${className}`} {...rest}>
      {label && (
        <div className="border-b border-slate-800 px-6 pb-3 pt-5">
          <span className="t-label">{label}</span>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

/**
 * A "name and value" row.
 *
 * The value is always monospaced: everything that came from the chain should
 * look like a figure that can be checked. The row itself is a separate tile on a
 * deeper background, like the drop table in the reference: that way the "name
 * and number" pair stays a pair even when there are a dozen rows in a run.
 */
export function DataRow({
  name,
  value,
  ink,
}: {
  name: string;
  value: React.ReactNode;
  ink?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-3 last:mb-0">
      <span className="t-label">{name}</span>
      <span
        className="t-chain shrink-0 text-sm font-bold"
        style={{ color: ink ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
