// src/components/LoopComponents/CapabilityChildItem.tsx
/**
 * One child sub-capability row inside a CardStackVerticalVariant card.
 *
 * Renders a text label + a divider line that draws in left→right. It does NOT
 * own the animation — the parent CardStackVerticalVariant's GSAP cover-stack
 * drives it via the `data-csv-child-text` / `data-csv-child-line` markers, so
 * each row animates IN and OUT in sync with its card covering / uncovering.
 * The initial hidden/collapsed state is handled by the variant's CSS FOUC-guard
 * (and GSAP's set on init); this component is purely the row's markup.
 *
 * Hydrated with client:visible — the parent timeline queries it from the DOM
 * whether or not it has hydrated, so hydration only matters for future inter.
 */
interface Props {
  title: string;
}

export default function CapabilityChildItem({ title }: Props) {
  return (
    <li
      className="csv-child relative py-2.5 text-sm font-light tracking-tight text-heading"
      data-csv-child
    >
      <span className="csv-child-text inline-block" data-csv-child-text>
        {title}
      </span>
      <span
        className="csv-child-line absolute inset-x-0 bottom-0 h-px origin-left bg-text/12"
        data-csv-child-line
        aria-hidden="true"
      />
    </li>
  );
}
