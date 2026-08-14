import { Chest, skinOf } from "./Chest";
import { isVault, slotsPerTier, type DeckShape } from "@/lib/deck";

/**
 * A deck's face is what is inside it rather than one of its rungs.
 *
 * The card used to draw ONE large chest, the deck's best prize. Which made two
 * different seasons look identical: in #1 and #3 the top prize is the same
 * porphyry while the rest of the contents is not. One pays once in a hundred,
 * the other once in four, and from the picture that was indistinguishable.
 *
 * Here the whole ladder is shown instead of its top, stepping down from the
 * highest rung to the lowest. A deck's silhouette becomes its signature: a deck
 * with two rungs has two chests, one with five has five, and confusing them is
 * no longer possible. Colour still speaks only of rarity, it just now speaks of
 * the WHOLE contents.
 *
 * The chests overlap like cards in a hand: the row reads as one object rather
 * than a table, and five rungs fit in a card where two used to.
 */
export function DeckHero({
  deck,
  size = 128,
  skin,
  art,
  className,
}: {
  deck: DeckShape;
  /** The size of the highest chest. The rest step down from it. */
  size?: number;
  /**
   * The deck's skin. If there is one, that is the face, instead of the ladder.
   *
   * The ladder answers "what is in here" and is needed when a deck cannot
   * otherwise be told from its neighbour. A deck with its own skin has already
   * done that work with its name and colour, and it reveals its contents in the
   * table below anyway.
   */
  skin?: string;
  /** The deck's uploaded picture. The face, if there is one. */
  art?: string;
  className?: string;
}) {
  const dress = skinOf(skin);
  if (art || dress) {
    return <Chest rarity="sealed" skin={skin} art={art} size={size} className={className} />;
  }

  // Emptiness does not join the row: it is in every deck and says nothing about
  // this one. The vault does, even though it weighs zero, because it is the most
  // valuable thing there is.
  const rank = (t: { spec: ReturnType<typeof slotsPerTier>[number]["spec"] }) =>
    isVault(t.spec) ? Number.MAX_SAFE_INTEGER : t.spec.tickets;

  const ladder = slotsPerTier(deck)
    .filter((t) => t.weight > 0 || isVault(t.spec))
    .sort((a, b) => rank(b) - rank(a));

  if (ladder.length === 0) {
    return <Chest rarity="grout" size={size} className={className} />;
  }

  // The highest chest gets smaller as the ladder gets longer: a card of one
  // width has to hold both two chests and five. Without this a row of five
  // overflowed the card and covered its name and price.
  const base = size * (ladder.length <= 2 ? 1 : ladder.length === 3 ? 0.84 : 0.66);
  const lap = ladder.length > 4 ? 0.45 : ladder.length > 2 ? 0.25 : 0.1;

  return (
    <div className={`flex max-w-full items-end justify-center ${className ?? ""}`}>
      {ladder.map((t, i) => {
        // A step down, but not into nothing: the fifth rung stays a
        // recognisable box rather than a speck.
        const step = Math.max(base * 0.5, base - i * base * 0.13);
        return (
          <span
            key={i}
            className="relative flex shrink-0 flex-col items-center"
            style={{
              // The overlap grows with the ladder: two rungs stand side by
              // side, five lie over one another like cards in a hand.
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
