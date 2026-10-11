type SectionBadgeProps = { index: string; label: string };

/** Small "001 • THE PROBLEM" pill that sits above each section heading. */
export function SectionBadge({ index, label }: SectionBadgeProps) {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full bg-ice/60 px-3 text-[12px] font-medium uppercase leading-[1.35]">
      <span className="text-muted">{index}</span>
      <span className="size-[6px] rounded-full bg-lavender" aria-hidden="true" />
      <span className="text-ink">{label}</span>
    </div>
  );
}
