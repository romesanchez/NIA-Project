import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ALL_DEPARTMENTS } from "@/data/departments";
import { TopologyEditor } from "@/components/nia/TopologyEditor";

export const Route = createFileRoute("/topology/$acronym")({
  head: ({ params }) => ({
    meta: [{ title: `Edit Topology · ${params.acronym} — NIA-Topology` }],
  }),
  component: EditTopologyPage,
});

function EditTopologyPage() {
  const { acronym } = Route.useParams();
  const navigate = useNavigate();
  const dept = ALL_DEPARTMENTS.find((d) => d.acronym === acronym);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const toggleMaximize = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsMaximized(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsMaximized(false);
    }
  };

  const exitToHome = () => navigate({ to: "/" });

  if (!dept) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background text-ink px-4">
        <p className="font-mono text-[12px] tracking-[0.2em] text-muted-foreground">
          UNKNOWN DEPARTMENT · {acronym}
        </p>
        <Link
          to="/"
          className="font-mono text-[11px] tracking-[0.18em] px-4 py-2 border border-ink hover:bg-ink hover:text-background"
        >
          ← BACK TO TOPOLOGY
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-ink overflow-hidden">
      {/* Page header — separate from the viewer; changes here save instantly
          and become the new finalized diagram shown in VIEW TOPOLOGY. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase shrink-0">
            Edit Topology
          </span>
          <span className="font-mono text-[12px] font-semibold text-ink truncate">{dept.acronym}</span>
          <span className="hidden sm:inline font-mono text-[11px] text-muted-foreground truncate">
            {dept.name}
          </span>
        </div>
        {/* Window controls — minimize returns to the topology directory,
            the middle button toggles fullscreen editing, and close asks to
            confirm first, Packet-Tracer style. */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={exitToHome}
            title="Minimize — back to topology directory"
            aria-label="Minimize"
            className="w-7 h-7 flex items-center justify-center border border-border hover:border-ink hover:bg-ink/5 transition-colors rounded-sm text-ink"
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
          <button
            onClick={toggleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
            className="w-7 h-7 flex items-center justify-center border border-border hover:border-ink hover:bg-ink/5 transition-colors rounded-sm text-ink"
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2.5" y="0.5" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="0.5" y="2.5" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowExitDialog(true)}
            title="Close"
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center border border-border hover:border-destructive hover:bg-destructive hover:text-white transition-colors rounded-sm text-ink"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TopologyEditor dept={dept} />
      </div>

      {/* Exit confirmation — mirrors Packet Tracer's "Exit -- Cisco Packet
          Tracer" dialog. Edits already autosave as they happen, so Yes/No
          both leave safely; Yes just also surfaces the save confirmation
          toast before navigating away. */}
      {showExitDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowExitDialog(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] max-w-[92vw] bg-[#1f1f1f] text-white rounded-md shadow-2xl overflow-hidden border border-black/40"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[#141414] border-b border-white/10">
              <span id="exit-dialog-title" className="font-mono text-[11px] tracking-[0.08em]">
                Exit — {dept.acronym} Topology Editor
              </span>
              <button
                onClick={() => setShowExitDialog(false)}
                aria-label="Close dialog"
                className="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex items-start gap-3 px-5 py-6">
              <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center shrink-0 font-serif italic text-[13px] font-bold">i</div>
              <p className="font-mono text-[12px] leading-relaxed">
                Any unsaved changes will be lost. Do you want to save your work?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                autoFocus
                onClick={() => {
                  toast.success("Topology saved", { description: `${dept.acronym} — changes saved.` });
                  setShowExitDialog(false);
                  exitToHome();
                }}
                className="font-mono text-[11px] tracking-[0.06em] px-4 py-1.5 rounded-sm border border-white/25 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => { setShowExitDialog(false); exitToHome(); }}
                className="font-mono text-[11px] tracking-[0.06em] px-4 py-1.5 rounded-sm border border-white/25 bg-white/10 hover:bg-white/20 transition-colors"
              >
                No
              </button>
              <button
                onClick={() => setShowExitDialog(false)}
                className="font-mono text-[11px] tracking-[0.06em] px-4 py-1.5 rounded-sm border border-white/25 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}