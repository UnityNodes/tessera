import { Chest, skinOf } from "./Chest";
import { isVault, slotsPerTier, type DeckShape } from "@/lib/deck";

/**
 *
 *
 *
 */
export function DeckHero({
  deck,
  size = 128,
  skin,
  className,
}: {
  deck: DeckShape;
  size?: number;
  /**
   *
   */
  skin?: string;
  className?: string;
}) {
  const dress = skinOf(skin);
  if (dress) {
    return <Chest rarity="sealed" skin={skin} size={size} className={className} />;
  }

  const rank = (t: { spec: ReturnType<typeof slotsPerTier>[number]["spec"] }) =>
    isVault(t.spec) ? Number.MAX_SAFE_INTEGER : t.spec.tickets;

  const ladder = slotsPerTier(deck)
    .filter((t) => t.weight > 0 || isVault(t.spec))
    .sort((a, b) => rank(b) - rank(a));

  if (ladder.length === 0) {
    return <Chest rarity="grout" size={size} className={className} />;
  }

  const base = size * (ladder.length <= 2 ? 1 : ladder.length === 3 ? 0.84 : 0.66);
  const lap = ladder.length > 4 ? 0.45 : ladder.length > 2 ? 0.25 : 0.1;

  return (
    <div className={`flex max-w-full items-end justify-center ${className ?? ""}`}>
      {ladder.map((t, i) => {
        const step = Math.max(base * 0.5, base - i * base * 0.13);
        return (
          <span
            key={i}
            className="relative flex shrink-0 flex-col items-center"
            style={{
              marginLeft: i === 0 ? 0 : -step * lap,
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
