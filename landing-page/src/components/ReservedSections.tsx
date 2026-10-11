/**
 * Two sections whose content was removed in the Framer file but whose space and
 * background are still part of the layout. Kept at the same size so the page rhythm
 * matches; fill them in a later phase.
 */
export function PricingSection() {
  // Framer: "Pricing Section", empty white band.
  return <section aria-hidden="true" className="h-[149px] bg-white tab:h-[181px] desk:h-[221px]" />;
}

export function TeamSection() {
  // Framer: "Team Section", empty white-to-sky gradient, 1409px tall on desktop (272px phone, 204px tablet).
  return (
    <section
      aria-hidden="true"
      className="h-[272px] bg-[linear-gradient(180deg,#fff_0%,var(--sky)_100%)] tab:h-[204px] desk:h-[1409px]"
    />
  );
}
