import { Chest } from "./Chest";
import { isVault, slotsPerTier, type DeckShape } from "@/lib/deck";

/**
 *
 *
 *
 */
export function DeckHero({
  deck,
  size = 128,
  className,
}: {
  deck: DeckShape;
  size?: number;
  className?: string;
}) {
  const rank = (t: { spec: ReturnType<typeof slotsPerTier>[number]["spec"] }) =>
    isVault(t.spec) ? Number.MAX_SAFE_INTEGER : t.spec.tickets;

  const ladder = slotsPerTier(deck)
    .filter((t) => t.weight > 0 || isVault(t.spec))
    .sort((a, b) => rank(b) - rank(a));

  if (ladder.length === 0) {
    return <Chest rarity="grout" size={size} className={className} />;
  }

  return (
    <div className={`flex items-end justify-center ${className ?? ""}`}>
      {ladder.map((t, i) => {
        const step = Math.max(size * 0.46, size - i * size * 0.13);
        return (
          <span
            key={i}
            className="relative flex flex-col items-center"
            style={{
              marginLeft: i === 0 ? 0 : -step * (ladder.length > 3 ? 0.3 : 0.12),
              zIndex: ladder.length - i,
            }}
            title={`${t.count} × ${t.spec.name}`}
          >
            <Chest rarity={t.spec.rarity} size={step} />
            <span
              className="t-chain -mt-1 text-xs font-extrabold"
              style={{ color: t.spec.ink, textShadow: "0 1px 6px rgb(0 0 0 / 0.9)" }}
            >
              ×{t.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}
