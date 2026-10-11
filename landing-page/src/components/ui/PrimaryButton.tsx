import { ArrowRight } from "./icons";

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/** Black pill with a thin rainbow rim and a sliding arrow, used for the main CTAs. */
export function PrimaryButton({ href, children, className = "" }: PrimaryButtonProps) {
  return (
    <a
      href={href}
      className={`group relative inline-flex h-14 items-center rounded-full bg-rainbow-90 p-[2px] ${className}`}
    >
      <span className="flex h-[52px] items-center gap-2 rounded-full bg-ink pl-6 pr-[14px] text-[16px] font-semibold leading-[1.35] text-white shadow-[inset_0_0_16px_0_rgba(255,255,255,0.5)]">
        {children}
        <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full bg-white/20">
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-6" />
          <ArrowRight className="absolute size-4 -translate-x-6 transition-transform duration-300 group-hover:translate-x-0" />
        </span>
      </span>
    </a>
  );
}
