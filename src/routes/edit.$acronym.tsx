import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ALL_DEPARTMENTS } from "@/data/departments";
import { FloorPlanEditor } from "@/components/nia/FloorPlanEditor";

export const Route = createFileRoute("/edit/$acronym")({
  head: ({ params }) => ({
    meta: [{ title: `Edit ${params.acronym} — NIA-Topology` }],
  }),
  component: EditPage,
});

function EditPage() {
  const { acronym } = Route.useParams();
  const navigate = useNavigate();
  const dept = ALL_DEPARTMENTS.find((d) => d.acronym === acronym);

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
          and show up back in the topology view/2D modal when you return. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase shrink-0">
            Edit Mode
          </span>
          <span className="font-mono text-[12px] font-semibold text-ink truncate">{dept.acronym}</span>
          <span className="hidden sm:inline font-mono text-[11px] text-muted-foreground truncate">
            {dept.name}
          </span>
        </div>
        <button
          onClick={() => navigate({ to: "/" })}
          className="font-mono text-[11px] font-semibold tracking-[0.12em] px-3 py-1.5 border border-ink bg-ink text-background hover:bg-ink/85 transition-colors shrink-0"
        >
          DONE · VIEW TOPOLOGY
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <FloorPlanEditor dept={dept} />
      </div>
    </div>
  );
}
