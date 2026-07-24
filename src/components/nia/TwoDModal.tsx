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

  useEffect(() => {
    if (dept) setClosing(false);
  }, [dept]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dept) return;
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dept]);

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

        <div className="relative flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          {/* Left: finalized 2D topology — devices + wires, read-only */}
          <div className={"relative min-h-[300px] bg-tint flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-border " + (closing ? "topo-panel-left-out" : "topo-panel-left-in")}>
            <TopologyViewer dept={dept} />
          </div>

          {/* Right: department info card */}
          <div className={"p-8 lg:p-10 flex flex-col gap-4 overflow-y-auto " + (closing ? "topo-panel-right-out" : "topo-panel-right-in")}>
            <h3 className="font-sans font-extrabold uppercase tracking-[-0.02em] text-ink text-[clamp(2.2rem,4.5vw,3.4rem)] leading-[0.95]">
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
