interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children: React.ReactNode;
}

/**
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
 *
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
