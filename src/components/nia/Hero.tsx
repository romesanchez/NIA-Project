import { useState } from "react";
import { TOTAL } from "@/data/departments";

interface Props {
  onBrowse: () => void;
}

const VISION = "NIA is a professional and efficient irrigation agency contributing to the inclusive growth of the country and in the improvement of the farmers' quality of life.";
const MISSION = "To construct, operate and maintain irrigation systems consistent with integrated water resource management principles to improve agricultural productivity and increase farmers' income.";

export function Hero({ onBrowse }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative h-screen w-full snap-start flex items-center overflow-hidden">

      {/* Overlay backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={
          "absolute inset-0 z-10 bg-black/30 backdrop-blur-sm transition-opacity duration-500 " +
          (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
      />

      {/* Vision panel — slides in from LEFT */}
      <div
        className={
          "absolute top-0 left-0 z-20 w-1/2 h-full bg-primary flex flex-col justify-center px-12 lg:px-20 " +
          "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        {/* Decorative circles */}
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-px h-32 bg-white/10 pointer-events-none" />

        <span className="font-mono text-[11px] tracking-[0.35em] text-primary-foreground/50 mb-5 uppercase">
          01 · Vision
        </span>
        <h2 className="font-poppins font-extrabold text-[clamp(2.5rem,5vw,5rem)] text-primary-foreground uppercase leading-[0.85] mb-6 tracking-[-0.02em]">
          Our<br />Vision
        </h2>
        <div className="w-16 h-[3px] bg-primary-foreground/30 mb-8 rounded-full" />
       <p className="text-primary-foreground text-[20px] leading-[1.9] max-w-sm font-semibold tracking-wide">
         {VISION}
       </p>
      </div>

      {/* Mission panel — slides in from RIGHT */}
      <div
        className={
          "absolute top-0 right-0 z-20 w-1/2 h-full bg-background flex flex-col justify-center px-12 lg:px-20 border-l border-border " +
          "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-75 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        {/* Decorative */}
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-primary/5 pointer-events-none" />
        <div className="absolute top-16 left-0 w-px h-32 bg-border pointer-events-none" />

        <span className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-5 uppercase">
          02 · Mission
        </span>
        <h2 className="font-poppins font-extrabold text-[clamp(2.5rem,5vw,5rem)] text-ink uppercase leading-[0.85] mb-6 tracking-[-0.02em]">
          Our<br />Mission
        </h2>
        <div className="w-16 h-[3px] bg-primary mb-8 rounded-full" />
        <p className="text-ink text-[20px] leading-[1.9] max-w-sm font-semibold tracking-wide">
          {MISSION}
       </p>
      </div>

      {/* Back button — appears when open */}
      <div
        className={
          "absolute bottom-10 left-1/2 -translate-x-1/2 z-30 transition-all duration-500 " +
          (open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none")
        }
      >
        <button
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 font-mono text-[11px] tracking-[0.25em] px-6 py-3 bg-background border border-border text-ink hover:bg-ink hover:text-background transition-colors rounded-full shadow-lg"
        >
          ← BACK
        </button>
      </div>

      {/* Main hero content */}
      <div
        className={
          "relative mx-auto max-w-[1600px] px-6 lg:px-12 w-full flex flex-col items-center text-center " +
          "transition-all duration-500 " +
          (open ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100")
        }
      >
        {/* Main hero copy */}
        <div className="max-w-3xl flex flex-col items-center">
          <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5 mb-8 rounded-full">
            <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
              SYSTEM · NETWORK ARCHITECTURE & INFRASTRUCTURE
            </span>
          </div>

          <h1 className="font-poppins font-extrabold tracking-[-0.04em] text-ink leading-[0.92] text-[clamp(2rem,5vw,6rem)]">
            A Blueprint of the <span className="text-primary">Network</span>
          </h1>

          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-muted-foreground bg-background/60 backdrop-blur-sm px-3 py-2 rounded-lg">
            Explore every department, floor plan, and device connection across {TOTAL} nodes in the NIA Regional Office network.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onBrowse}
              className="font-mono text-[12px] tracking-[0.18em] px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-sm"
            >
              BROWSE DEPARTMENTS →
            </button>
            <button
              onClick={() => setOpen(true)}
              className="font-mono text-[12px] tracking-[0.18em] px-6 py-3 border border-border text-ink hover:border-ink hover:bg-ink hover:text-background transition-colors rounded-sm"
            >
              VISION & MISSION
            </button>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className={
        "absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-300 " +
        (open ? "opacity-0" : "opacity-100")
      }>
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">SCROLL TO EXPLORE</span>
        <span className="animate-bob font-mono text-primary text-xl">↓</span>
      </div>
    </section>
  );
}