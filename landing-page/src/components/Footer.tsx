"use client";

import { asset } from "@/lib/asset";
import { EXTENSION_URL, FEEDBACK_URL, REPO_URL } from "@/lib/links";

// The team's profiles (same as the hero ticker) and the code
const SOCIALS = [
  { label: "Ari Lee", icon: asset("/media/social-linkedin.png"), href: "https://www.linkedin.com/in/moonyoung-lee-565043342/" },
  { label: "Aayush Nakarmi", icon: asset("/media/social-linkedin.png"), href: "https://www.linkedin.com/in/aayush-nakarmi-9809b1290/" },
  { label: "Rylan Begaye", icon: asset("/media/social-linkedin.png"), href: "https://www.linkedin.com/in/rylan-begaye-9a8226432/" },
  { label: "GitHub", icon: asset("/media/logo-mark.svg"), href: REPO_URL },
];

const LINKS = [
  { label: "How It Works", href: "#process" },
  { label: "Solution", href: "#solution" },
  { label: "Technology", href: "#technology" },
  { label: "Source code", href: REPO_URL },
];



export function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-sky px-5 pt-20 tab:px-10 desk:px-20">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={asset("/media/footer-bg.mp4")}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div
        // Palette tint over the background video: Sky Glow where the section above ends,
        // deepening to Deep Steel Blue so the white footer text stays readable
        className="absolute inset-0 bg-[linear-gradient(180deg,#a9dfff_0%,rgba(169,223,255,0.7)_22%,rgba(62,83,111,0.7)_68%,#3e536f_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1280px]">
        {/* Feedback card */}
        <div className="mx-auto flex max-w-[680px] flex-col items-center rounded-[64px] bg-[linear-gradient(180deg,rgba(62,83,111,0.5)_0%,rgba(174,196,255,0.18)_100%)] px-5 pb-20 pt-10 text-center shadow-[inset_0_0_4px_0_rgba(255,255,255,0.8),inset_0_0_40px_0_#fff] backdrop-blur-[20px] tab:rounded-[120px] tab:px-[60px]">
          {/* Placeholder badge from the Framer template */}
          <img src={asset("/media/cta-badge.png")} alt="" className="size-20" />
          <h2 className="mt-6 text-[32px] font-medium leading-[1.1] tracking-[-0.03em] text-white">
            Stop Clicking.
            <br />
            Start Asking.
          </h2>
          <p className="mt-4 max-w-[400px] text-[18px] leading-[1.35] text-white/60">
            VOYA is open source. Set it up in a few minutes, or tell us how you browse today and what VOYA should do next.
          </p>

          <div className="mt-10 flex w-full flex-col items-center gap-3 tab:flex-row tab:justify-center">
            <a
              href={EXTENSION_URL}
              className="flex h-14 items-center rounded-full bg-ink px-8 text-[16px] font-medium leading-[1.35] text-white transition-transform hover:scale-[1.03]"
            >
              Set up VOYA
            </a>
            <a
              href={FEEDBACK_URL}
              className="flex h-14 items-center rounded-full bg-white/30 px-8 text-[16px] font-medium leading-[1.35] text-white shadow-[inset_0_0_16px_0_rgba(255,255,255,0.6)] transition-transform hover:scale-[1.03]"
            >
              Share feedback on GitHub
            </a>
          </div>
        </div>

        {/* Socials */}
        <ul className="mt-20 grid grid-cols-2 gap-4 border-b border-white/20 pb-6 tab:flex tab:justify-between">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a href={s.href} className="group flex items-center gap-2 text-[16px] font-medium leading-[1.35] text-white">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/40 shadow-[inset_0_0_12px_0_#fff]">
                  <img src={s.icon} alt="" className="size-5" />
                </span>
                {s.label}
                <img
                  src={asset("/media/arrow-up-right.png")}
                  alt=""
                  className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </a>
            </li>
          ))}
        </ul>

        <ul className="grid grid-cols-2 gap-4 pt-6 text-[16px] leading-[1.35] text-white tab:flex tab:justify-between">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a href={l.href} className="hover:opacity-70">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex flex-col items-start gap-4 pb-6 text-[14px] leading-[1.35] tab:flex-row tab:items-end tab:justify-between desk:mt-[105px]">
          <p className="order-2 text-white/60 tab:order-none tab:w-[240px]">© VOYA 2026</p>
          <div className="order-1 flex h-20 items-center gap-3 tab:order-none" aria-label="VOYA">
            <img src={asset("/media/logo-mark.svg")} alt="" className="size-12 opacity-80" />
            <span className="bg-[linear-gradient(180deg,#fff_30%,rgba(255,255,255,0.2)_100%)] bg-clip-text text-[26px] font-semibold leading-none tracking-[-0.06em] text-transparent tab:text-[40px]">
              VOYA
            </span>
          </div>
          <p className="order-3 text-white/60 tab:w-[240px] tab:text-right">Created by Ari Lee, Aayush Nakarmi &amp; Rylan Begaye at Hack Midwest 2026</p>
        </div>
      </div>
    </footer>
  );
}
