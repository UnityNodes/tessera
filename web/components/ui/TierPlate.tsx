/**
 * The tier name on a plate in the corner of an item.
 *
 * The shape comes from the design system: 11 pixels, tracked out, upper case,
 * the tier colour on a 9% bed of the same colour. It stands everywhere an item
 * is shown, in the catalogue, on the case page, over a card in a battle, so that
 * the tier is read before the eye reaches the description.
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
      className={`t-label inline-block rounded-[6px] px-2.5 py-1 ${className}`}
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
