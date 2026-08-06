import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Department } from "@/data/departments";
import { FloorPlanViewer } from "./FloorPlanViewer";

interface Props {
  dept: (Department & { groupLabel: string; index: number }) | null;
  origin: { x: number; y: number } | null;
  onClose: () => void;
}

/**
 * FLOOR PLAN — the physical room layout for a department, with devices
 * placed inside it. Kept separate from VIEW TOPOLOGY so the two never
 * share one "edit" button again: this one's editor is the floor plan
 * editor (/edit/$acronym), that one's is the topology editor (/topology/$acronym).
 */
export function FloorPlanModal({ dept, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();

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

  const openEditor = () => {
    navigate({ to: "/edit/$acronym", params: { acronym: dept.acronym } });
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
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase shrink-0">
              Floor Plan
            </span>
            <span className="font-mono text-[12px] font-semibold text-ink truncate">{dept.acronym}</span>
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
          <div className={"relative min-h-[300px] bg-tint flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-border " + (closing ? "topo-panel-left-out" : "topo-panel-left-in")}>
            <FloorPlanViewer dept={dept} />
          </div>

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
          </div>
        </div>
      </div>
    </div>
  );
}
