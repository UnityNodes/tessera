import type { Rarity } from "@/lib/deck";
import { Shards } from "./Shards";

/**
 * The drawn chest, the same one as in the reference.
 *
 * Three rungs arrived as finished pictures, each in two states, closed and open.
 * The open one is the same chest from the same angle, with the lid thrown back,
 * a column of light inside and lottery tickets in its belly. Those tickets are
 * not decoration: a Megapot ticket really is in the case, and it is what the
 * player takes.
 *
 * The remaining rungs are not drawn, and rather than drafting them and standing
 * them side by side, they take the nearest picture and recolour it with a
 * filter. As it stands:
 *
 *   sealed    desaturated
 *   grout     the same, darker
 *   shard     shifted green, dimmed
 *   denarius  shifted green
 *   aureus    as is, the source is already blue
 *   porphyry  shifted violet
 *   vault     shifted gold
 *
 * ALL SEVEN rungs are one picture in seven colours, and that is deliberate: a
 * rarity ladder reads only when exactly one thing changes between rungs.
 * Separate files (denarius.webp, aureus.webp) drew DIFFERENT chest models, a
 * different silhouette and different hardware, and in a row they read as objects
 * from another set rather than as neighbouring rungs. They are gone now.
 *
 * This is not forever. As soon as real pictures exist, only the file map stays
 * here and the filter disappears.
 *
 * The picture is square and has a dark background baked in. So that the square
 * does not read as a tile on the page, its edge is faded with a radial mask: the
 * chest stays as it is and its corners dissolve into the background, which is
 * exactly what the reference shows, where the dark square matches the dark
 * section.
 *
 * data-tier is not decorative: --metal and --glow are taken from it, and the
 * rung's glow around the object rests on those.
 */

/**
 * `bare` means the CLOSED picture has no baked in background.
 *
 * The rest arrived with a dark square inside, and the code faded it with a
 * radial mask, that is, ate the chest's edges to hide somebody else's
 * background. Where the background is genuinely removed the mask is unnecessary,
 * and harmful, because now it would cut into the object itself.
 */
const ART: Record<Rarity, { src: string; open: string; filter?: string; bare?: boolean }> = {
  // Three drawn sources: blue, green, gold. The ladder has six rungs, so three
  // of them are recoloured by filter, though no longer the ones that used to be:
  // by the system gold belongs to the VAULT and blue to aureus, so the sources
  // swapped places.
  //
  // Sealed and empty take the same blue, desaturated: neither of them names a
  // rung, and the colour of rarity does not belong to them. They differ in
  // lightness, since a closed chest on the shelf is brighter than "nothing" in a
  // result.
  sealed: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "saturate(0.14) brightness(0.95)",
  },
  // 0.72 was not enough. An empty slot is shown on the scene's near black
  // screen, and the chest drowned there: what was left was a silhouette rather
  // than an object. Together with the mask eating its edges the result was a
  // dark smear instead of a result; the mask is gone and the brightness is up to
  // 0.85.
  //
  // Higher is not allowed: a closed chest on the shelf sits at 0.95, and
  // "nothing" must not glow level with what has not been opened yet. A tenth of
  // a step is small, but here it is the only thing that distinguishes the two
  // states, because the picture is the same.
  grout: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "saturate(0.12) brightness(0.85)",
  },
  // The green rungs are recoloured from the blue source too rather than taking
  // their own file.
  //
  // denarius.webp is a DIFFERENT chest: a different model, silhouette and
  // proportions. In a row of catalogue cards it read not as "the same box at
  // another rung" but as an object from another game. A rarity ladder works only
  // when exactly one thing changes, the colour; the moment the shape changes
  // with it, the rungs can no longer be compared by eye.
  // shard stays here only for type completeness: TESA is drawn as vectors in
  // <Shards>, because it is fragments rather than a box.
  shard: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
  },
  denarius: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(-66deg) saturate(1.15)",
  },
  aureus: { bare: true, src: "/chests/sealed-bare.webp", open: "/chests/sealed-open.webp" },
  porphyry: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(72deg) saturate(1.3)",
  },
  // The vault is the same chest recoloured gold rather than a separately drawn
  // box.
  //
  // It used to take aureus.webp, a DIFFERENT model: another silhouette, other
  // hardware, a Roman two on the lid. In the ladder it read not as the higher
  // rung of the same thing but as an object from another set. Now all seven
  // rungs are one chest in seven colours, and the ladder finally reads as a
  // ladder.
  vault: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(-160deg) saturate(1.6) brightness(1.12)",
  },
};

/**
 * Deck skins are to a case what rungs are to a prize.
 *
 * A rung says WHAT you drew, and its colour belongs to the rarity ladder. A skin
 * says WHICH case this is, and lives in exactly two places: on the catalogue
 * card and as the hero on a deck page. It is absent from the roll, because there
 * the contents are shown, and contents have colours of their own.
 *
 * Done the same way as the whole ladder: one chest, a different hue rotation.
 * Measured on the live render: 194 degrees for ours against 333 for the
 * reference, so a rotation of 139. No new picture is needed for this and none
 * will be: the moment a skin becomes a file, so do hosting, moderation and the
 * question "why is that box a different shape".
 */
/** The hue of our chest. Measured on the live file: median 194 degrees. */
const BASE_HUE = 194;

/**
 * Decks with their own artwork.
 *
 * The exception rather than the rule. A player deck is described by a name and a
 * hue, and that is enough, because there is one chest in the game and the rungs
 * differ from it only in colour. But kungfumode arrived as a separate render,
 * and the chest there is DIFFERENT: carved, with cast scrollwork and another lock.
 *
 * I first measured the hue, saw the same shape from the side and said it was the
 * same chest repainted. On screen it became clear it was not: the silhouette is
 * similar, the model is not. Hence a file here rather than a hue rotation.
 *
 * `src` is a picture instead of the base one. `hue` stays, because the colour of
 * the name and the card's border comes from it, so the caption matches the chest.
 */
const NAMED: Record<string, { hue: number; src?: string }> = {
  kungfumode: { hue: 333, src: "/chests/kungfumode.webp" },
};

/**
 * A skin from a deck's metadata.
 *
 * The format is `name:hue`, where the hue is in degrees 0 to 359. There is
 * nothing else in the metadata and nothing else is needed: a name and a colour
 * are all that makes one case look different from another.
 *
 * A colour as a number rather than a file. The moment a skin becomes an uploaded
 * picture, so do hosting, moderation of other people's images and the question
 * "why is that box a different shape", while a rarity ladder reads only as long
 * as exactly one thing changes between cases.
 *
 * `kungfumode` without a colon is the first player deck, cut before the format
 * existed. deckMeta cannot change after a cut, so the old record stays readable
 * forever.
 */
export function skinOf(meta: string | undefined) {
  if (!meta) return undefined;
  const [name, raw] = meta.split(":");
  const own = NAMED[name];
  const hue = raw !== undefined ? Number(raw) : own?.hue;
  if (!name || !Number.isFinite(hue as number)) return undefined;

  const turn = (((Number(hue) - BASE_HUE) % 360) + 360) % 360;
  return {
    name,
    hue: Number(hue),
    src: own?.src,
    // Its own picture is already the right colour, so there is nothing to rotate.
    filter: own?.src ? undefined : `hue-rotate(${turn}deg) saturate(1.35) brightness(1.06)`,
    // The caption's colour: the card's border and its name have to match the
    // chest, otherwise the case looks assembled from two different ones.
    ink: `hsl(${hue} 100% 59%)`,
  };
}

const MASK = "radial-gradient(closest-side, #000 56%, transparent 92%)";

/**
 * A file sized for its display rather than one for every case.
 *
 * Measured: a thumbnail in the contents table is shown at 44 pixels and pulls a
 * 760 pixel file of 128 KB, seventeen times larger than the place it goes into.
 * There are six such thumbnails on a case page, and together they accounted for
 * 377 KB of the page's 441 KB.
 *
 * Three steps, with room for double density: up to 80 displayed take 160, up to
 * 192 take 384, beyond that the original.
 */
function sized(src: string, size: number) {
  if (size <= 80) return src.replace(".webp", "-sm.webp");
  if (size <= 192) return src.replace(".webp", "-md.webp");
  return src;
}

export function Chest({
  rarity = "sealed",
  size = 160,
  drift = false,
  open = false,
  skin,
  art,
  className,
}: {
  rarity?: Rarity;
  size?: number;
  /** A slow bob. For the same object at rest. */
  drift?: boolean;
  /** The lid thrown back, light and tickets inside. The moment of the result. */
  open?: boolean;
  /** The deck's skin. Overrides the rung's colour, but only where the case
  skin?: string;
  /** A picture uploaded by the creator. Overrides the skin too: this is no
  art?: string;
  className?: string;
}) {
  // TESA is not a box but fragments. It is the one rung of the ladder that is
  // NOT a whole thing: five make a ticket, so each is a piece by itself. A chest
  // beside a chest read as "another case, only worse".
  if (rarity === "shard") {
    return (
      <span data-tier="shard" className={className} style={{ display: "block" }}>
        <Shards size={size} style={{ animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined }} />
      </span>
    );
  }

  const tier = ART[rarity];
  const dress = skinOf(skin);
  const glow = "drop-shadow(0 0 calc(var(--glow, 0) * 26px) var(--metal))";
  // The mask is only needed by a baked in background. On a transparent picture
  // it would cut into the chest itself, so it is switched off for those.
  //
  // `&& !open` used to stand here by mistake and it cost dearly. `bare` is a
  // property of the SET rather than of one of its states: both pictures are
  // transparent, closed and open alike. Verified against the files themselves:
  //
  //   sealed-bare.webp   62.9% of pixels fully transparent
  //   sealed-open.webp   49.1%           likewise
  //
  // Because of that condition the mask was applied to the open one, that is, to
  // exactly the frame a player opens a case for. `closest-side` measures from
  // the centre, and everything beyond 56% of the radius faded: the chest lost
  // its corners and sides, and a dark patch stood around it like spilled water.
  // It showed worst on an empty slot, where the chest is already dimmed to 0.72.
  //
  // Baked in backgrounds remain only in the prizes (ticket.webp, vault.webp),
  // where the mask is in place, in its own component.
  const masked = !tier.bare && !art;

  return (
    // Not next/image: the size here is set by whoever places the chest, and
    // across the site it appears from forty pixels in the strip to four hundred
    // in the hero. The three webp files weigh 380 KB together and cache forever.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A deck's own picture overrides the base one, but only while the chest
      // is SEALED. An open one shows the prize, and a prize belongs to its rung.
      src={
        art && !open
          ? art
          : sized(dress?.src && !open ? dress.src : open ? ART[rarity].open : ART[rarity].src, size)
      }
      alt=""
      aria-hidden
      data-tier={rarity}
      data-skin={skin || undefined}
      width={size}
      height={size}
      // A small chest is almost always below the fold: the contents table, the
      // strip, the deck picker. A large one is the hero or the scene, and it is
      // being waited for.
      loading={size <= 192 ? "lazy" : "eager"}
      decoding="async"
      className={className}
      style={{
        display: "block",
        width: size,
        maxWidth: "100%",
        height: "auto",
        // A skin replaces the rung's filter entirely rather than mixing into
        // it: two hue rotations in a row give a third colour nobody ordered.
        filter:
          art || dress?.src
            ? glow
            : dress?.filter
              ? `${dress.filter} ${glow}`
              : tier.filter
                ? `${tier.filter} ${glow}`
                : glow,
        maskImage: masked ? MASK : undefined,
        WebkitMaskImage: masked ? MASK : undefined,
        animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}

/**
 * The chest currently being opened.
 *
 * Two dashed rings turn towards each other and can do so indefinitely. There is
 * no bar here, no percentage and no countdown, and there cannot be: the
 * decryption happens in somebody else's service, we do not know how long it will
 * take, and any progress bar would be a lie about time.
 */
export function ChestWaiting({ size = 260 }: { size?: number }) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Opening, waiting for the covalidators"
    >
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          border: "1.5px dashed color-mix(in oklab, var(--color-accent) 60%, transparent)",
          animation: "wait-rotate 7s linear infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          border: "1px dashed color-mix(in oklab, var(--color-accent-bright) 40%, transparent)",
          animation: "wait-rotate 11s linear infinite reverse",
        }}
      />
      <Chest rarity="sealed" size={size * 0.62} drift />
    </div>
  );
}
