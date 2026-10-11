import { Reveal } from "./Reveal";
import { SectionBadge } from "./SectionBadge";

type SectionHeaderProps = {
  index: string;
  label: string;
  title: string;
  subtitle?: string;
};

/** Badge + large heading + optional subtitle, centred. Shared by most sections. */
export function SectionHeader({ index, label, title, subtitle }: SectionHeaderProps) {
  return (
    <Reveal className="flex flex-col items-center text-center">
      <SectionBadge index={index} label={label} />
      <h2 className="mt-6 text-[40px] font-medium leading-[1.1] tracking-[-0.05em] text-heading tab:text-[48px] desk:text-[72px]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-[640px] text-[18px] leading-[1.35] text-muted">{subtitle}</p>
      )}
    </Reveal>
  );
}
