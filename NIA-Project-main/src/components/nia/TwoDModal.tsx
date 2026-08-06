import { useEffect, useState } from "react";
import type { Department } from "@/data/departments";
import { TopologyViewer } from "./TopologyViewer";

interface Props {
  dept: (Department & { groupLabel: string; index: number }) | null;
  origin: { x: number; y: number } | null;
  onClose: () => void;
}

/**
 * VIEW TOPOLOGY — the finalized, read-only network diagram for a
 * department. Purely a viewer: no edit affordance lives in here at all.
 * The only way to change what's shown is the separate EDIT TOPOLOGY button
 * on the department card, which opens the dedicated editor on its own page;
 * whatever gets saved there is what shows up here next time it's opened.
 */
export function TwoDModal({ dept, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (dept) {
      setClosing(false);
      setInfoOpen(false); // always start with the full topology visible
    }
  }, [dept]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dept) return;
      if (e.key === "Escape") {
        // Escape closes the info panel first if it's open, then the modal.
        if (infoOpen) setInfoOpen(false);
        else close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, infoOpen]);

  if (!dept) return null;

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  return (
    <div
      className={"fixed inset-0 z-50 flex items-center justify-center bg-ink/55 backdrop-blur-sm px-4 " + (closing ? "topo-backdrop-out" : "topo-backdrop-in")}
      onClick={close}
    >
      <div
        className="relative w-full max-w-7xl h-[85vh] max-h-[820px] flex flex-col border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified top bar — title + close only. No edit affordance here. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase shrink-0">
              Network Topology
            </span>
            <span className="font-mono text-[12px] font-semibold text-ink truncate">{dept.acronym}</span>
            <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase shrink-0 border border-border px-2 py-0.5">
              Finalized · Read Only
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={close}
              className="font-mono text-[11px] font-semibold tracking-[0.12em] px-3 py-1.5 border border-border text-ink hover:border-destructive hover:text-destructive transition-colors"
            >
              CLOSE ✕
            </button>
          </div>
        </div>

        {/* Topology now takes the entire window by default — the diagram is
            what you see the instant this opens. Department info lives in a
            slide-in panel, reached via the arrow tab on the right edge. */}
        <div className="relative flex-1 overflow-hidden">
          <div className={"absolute inset-0 bg-tint flex flex-col " + (closing ? "topo-panel-left-out" : "topo-panel-left-in")}>
            <TopologyViewer dept={dept} />
          </div>

          {/* Arrow tab — click to slide the description panel in/out. */}
          <button
            onClick={() => setInfoOpen((v) => !v)}
            title={infoOpen ? "Hide department info" : "Show department info"}
            className={
              "absolute top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 " +
              "bg-primary text-primary-foreground shadow-lg border border-primary/60 " +
              "px-2 py-4 transition-[right] duration-300 ease-out " +
              (infoOpen ? "right-[min(420px,85vw)] rounded-l-md" : "right-0 rounded-l-md")
            }
          >
            <span
              className="font-mono text-[10px] tracking-[0.2em] uppercase [writing-mode:vertical-rl] rotate-180"
            >
              Info
            </span>
            <span className={"text-[13px] leading-none transition-transform " + (infoOpen ? "rotate-180" : "")}>
              ◀
            </span>
          </button>

          {/* Slide-in description panel */}
          <div
            className={
              "absolute top-0 right-0 h-full w-[min(420px,85vw)] bg-background border-l border-border shadow-2xl z-20 " +
              "flex flex-col gap-4 p-8 overflow-y-auto transition-transform duration-300 ease-out " +
              (infoOpen ? "translate-x-0" : "translate-x-full")
            }
          >
            <h3 className="font-sans font-extrabold uppercase tracking-[-0.02em] text-ink text-[clamp(2rem,4vw,2.8rem)] leading-[0.95]">
              {dept.acronym}
            </h3>
            <div className="font-mono text-[13px] text-muted-foreground">{dept.name}</div>

            <span className="inline-flex w-fit items-center gap-1.5 border border-border px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink">{dept.groupLabel}</span>
            </span>

            <p className="text-[14px] leading-relaxed text-muted-foreground">{dept.description}</p>

            <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              To change this diagram, close this view and use EDIT TOPOLOGY on the department card.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}