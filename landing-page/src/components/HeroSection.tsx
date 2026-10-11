import { SPLINE_BACKDROP } from "@/lib/spline";
import { SplineScene } from "./SplineScene";
import { Marquee } from "./ui/Marquee";
import { PrimaryButton } from "./ui/PrimaryButton";

// Team members shown in the hero ticker. Leave linkedin empty to show the name without a link.
const teamMembers = [
  { name: "Ari Lee", linkedin: "https://www.linkedin.com/in/moonyoung-lee-565043342/" },
  { name: "Aayush Nakarmi", linkedin: "https://www.linkedin.com/in/aayush-nakarmi-9809b1290/" },
  { name: "Rylan Begaye", linkedin: "https://www.linkedin.com/in/rylan-begaye-9a8226432/" },
];

// The list is repeated so one pass is wider than the strip and the loop stays seamless
const TICKER_REPEATS = 3;

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative h-[calc(100svh+88px)] min-h-[688px] overflow-hidden"
      style={{ backgroundColor: SPLINE_BACKDROP }}
    >
      {/* Interactive 3D assistant (Spline). Sits behind the copy and receives hover/click. */}
      <SplineScene className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none relative flex h-[calc(100%-88px)] flex-col items-center justify-center px-5 pt-20 text-center tab:px-10 desk:px-20">
        <h1 className="text-[48px] font-semibold leading-none tracking-[-0.06em] text-ink tab:text-[64px] desk:text-[80px]">
          You say the goal.
          <br />
          VOYA does the clicks.
        </h1>
        <p className="mt-6 text-[18px] leading-[1.35] text-muted">
          VOYA is a voice-first browser agent for people who can&apos;t easily use a mouse or keyboard. Just ask.
        </p>
        <div className="pointer-events-auto mt-20 flex flex-col items-center gap-2 tab:flex-row">
          <PrimaryButton href="#get-extension">Get the extension</PrimaryButton>
          <a
            href="#solution"
            className="flex h-[49px] items-center rounded-full bg-white/40 px-6 text-[16px] font-semibold leading-[1.35] text-ink shadow-[inset_0_0_16px_0_#fff] transition-colors hover:bg-white/60"
          >
            Explore Features ↓
          </a>
        </div>
      </div>

      {/* Team strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[88px] items-center">
        <Marquee duration={30} pauseOnHover className="pointer-events-auto w-full desk:mx-20">
          {Array.from({ length: TICKER_REPEATS }, (_, r) =>
            teamMembers.map((member) => {
              const repeat = r > 0;
              const className =
                "mr-20 block h-8 shrink-0 whitespace-nowrap text-[20px] font-semibold leading-8 tracking-[-0.02em] text-muted/60";
              return member.linkedin ? (
                <a
                  key={`${r}-${member.name}`}
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  aria-hidden={repeat || undefined}
                  tabIndex={repeat ? -1 : undefined}
                >
                  {member.name}
                </a>
              ) : (
                <span key={`${r}-${member.name}`} className={className} aria-hidden={repeat || undefined}>
                  {member.name}
                </span>
              );
            }),
          )}
        </Marquee>
      </div>
    </section>
  );
}
