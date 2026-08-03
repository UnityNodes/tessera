interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children: React.ReactNode;
}

/**
 */
export function Panel({ label, children, className = "", ...rest }: PanelProps) {
  return (
    <div className={`surface rounded-[3px] ${className}`} {...rest}>
      {label && (
        <div className="px-6 pt-5 pb-3 border-b border-[var(--edge)]">
          <span className="t-label">{label}</span>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

/**
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
    <div className="flex items-baseline gap-4 py-2.5 border-b border-[var(--edge)] last:border-0">
      <span className="t-label shrink-0">{name}</span>
      <span
        className="h-px flex-1 self-center"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg,var(--edge) 0 2px,transparent 2px 6px)",
        }}
      />
      <span
        className="t-chain text-[0.9375rem] shrink-0"
        style={{ color: ink ?? "var(--color-travertine)" }}
      >
        {value}
      </span>
    </div>
  );
}
