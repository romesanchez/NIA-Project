import { useNavigate } from "@tanstack/react-router";
import type { Department } from "@/data/departments";
import { useAppMode } from "@/contexts/AppModeContext";

interface Props {
  dept: Department & { groupLabel: string; index: number; groupId: string };
  tinted: boolean;
  onOpen2D: (e: React.MouseEvent) => void;
  onOpen3D: (e: React.MouseEvent) => void;
  onOpenFloorPlan: (e: React.MouseEvent) => void;
}

const DEVICE_ICONS: Record<string, string> = {
  PC: "🖥️", SERVER: "🗄️", SWITCH: "🔀", ROUTER: "📡",
  PRINTER: "🖨️", AP: "📶", WEBCAM: "📷", LAPTOP: "💻",
  SMARTPHONE: "📱", MEDIACONVERTER: "🔌", CONTROLLER: "🎛️",
};

const DEVICE_LABELS: Record<string, string> = {
  PC: "PC", SERVER: "Server", SWITCH: "Switch", ROUTER: "Router",
  PRINTER: "Printer", AP: "Access Point", WEBCAM: "Webcam", LAPTOP: "Laptop",
  SMARTPHONE: "Phone", MEDIACONVERTER: "Media Converter", CONTROLLER: "Controller",
};

const GROUP_ACCENT: Record<string, string> = {
  ro1: "from-emerald-500/10 to-transparent border-emerald-500/20",
  eod: "from-blue-500/10 to-transparent border-blue-500/20",
  rtc: "from-violet-500/10 to-transparent border-violet-500/20",
};

const GROUP_BADGE: Record<string, string> = {
  ro1: "bg-emerald-100 text-emerald-800 border-emerald-200",
  eod: "bg-blue-100 text-blue-800 border-blue-200",
  rtc: "bg-violet-100 text-violet-800 border-violet-200",
};

const GROUP_TAG: Record<string, string> = {
  ro1: "bg-emerald-600",
  eod: "bg-blue-600",
  rtc: "bg-violet-600",
};

export function DepartmentSlide({ dept, tinted, onOpen2D, onOpen3D, onOpenFloorPlan }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useAppMode();

  const deviceEntries = Object.entries(dept.devices ?? {}).filter(([, v]) => v && v > 0);
  const totalDevices = deviceEntries.reduce((s, [, v]) => s + (v ?? 0), 0);

  const len = dept.acronym.length;
  const scale = Math.max(0.32, Math.min(1, 3 / len));
  const acronymMin = Math.max(1.75, 4 * scale);
  const acronymPreferred = 14 * scale;
  const acronymMax = Math.max(3, 13 * scale);

  const accentClass = GROUP_ACCENT[dept.groupId] ?? "from-primary/10 to-transparent border-primary/20";
  const badgeClass = GROUP_BADGE[dept.groupId] ?? "bg-primary/10 text-primary border-primary/20";
  const tagClass = GROUP_TAG[dept.groupId] ?? "bg-primary";

  return (
    <section
      id={`node-${dept.index + 1}`}
      data-slide-index={dept.index + 1}
      className={
        "relative h-screen w-full snap-start flex items-center overflow-hidden " +
        (tinted ? "bg-primary/[0.02]" : "")
      }
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-background/80" />

      <div className="relative mx-auto max-w-[1600px] w-full px-6 lg:px-12 grid grid-cols-12 gap-8 items-center">
        {/* Left spacer */}
        <div className="hidden lg:block lg:col-span-1" />

        {/* Main content */}
        <div className="col-span-12 lg:col-span-7 min-w-0">

          {/* Building badge + breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-[0.15em] px-2.5 py-1 rounded-full border ${badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tagClass}`} />
              {dept.groupLabel.toUpperCase()}
            </span>
            <span className="text-muted-foreground text-[11px] font-mono">/</span>
            <span className="text-[11px] font-mono text-muted-foreground tracking-wider">{dept.acronym}</span>
          </div>

          {/* Acronym heading */}
          <h2
            className="font-sans font-semibold uppercase tracking-[-0.03em] leading-[0.88] text-ink break-words"
            style={{ fontSize: `clamp(${acronymMin}rem, ${acronymPreferred}vw, ${acronymMax}rem)` }}
          >
            {dept.acronym}
          </h2>
          <div className="mt-3 font-mono text-[12px] tracking-[0.22em] uppercase text-primary">
            {dept.name}
          </div>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {dept.description}
          </p>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onOpen2D}
              className="font-mono text-[12px] tracking-[0.18em] px-5 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-sm"
            >
              VIEW TOPOLOGY →
            </button>
            <button
              onClick={onOpen3D}
              className="font-mono text-[12px] tracking-[0.18em] px-5 py-3 border border-ink text-ink hover:bg-ink hover:text-background transition-colors rounded-sm"
            >
              3D VIEW ◆
            </button>
            <button
              onClick={onOpenFloorPlan}
              className="font-mono text-[12px] tracking-[0.18em] px-5 py-3 border border-border text-ink hover:border-ink transition-colors rounded-sm"
            >
              FLOOR PLAN ▦
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate({ to: "/topology/$acronym", params: { acronym: dept.acronym } })}
                className="font-mono text-[12px] tracking-[0.18em] px-5 py-3 border border-dashed border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-colors rounded-sm"
              >
                EDIT TOPOLOGY ✎
              </button>
            )}
          </div>
        </div>

        {/* Right rail — device stats card */}
        <div className="hidden lg:flex lg:col-span-3 flex-col justify-center">
          {deviceEntries.length > 0 ? (
            <div className={`rounded-xl border bg-gradient-to-br ${accentClass} p-5 backdrop-blur-sm`}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Network Devices</span>
                <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full text-white ${tagClass}`}>
                  {totalDevices} total
                </span>
              </div>
              <div className="space-y-2">
                {deviceEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{DEVICE_ICONS[type] ?? "📦"}</span>
                      <span className="text-[12px] text-ink font-medium">{DEVICE_LABELS[type] ?? type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mini bar */}
                      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className={`h-full rounded-full ${tagClass} opacity-70`}
                          style={{ width: `${Math.min(100, ((count ?? 0) / Math.max(...deviceEntries.map(([,v]) => v ?? 0))) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[12px] font-bold text-ink w-4 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border bg-gradient-to-br ${accentClass} p-5 text-center`}>
              <div className="text-2xl mb-2">🏢</div>
              <p className="text-[12px] text-muted-foreground font-mono">Building segment</p>
            </div>
          )}

          {/* Slide counter */}
          <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            <span>{String(dept.index + 1).padStart(2, "0")}</span>
            <span className="text-border">—</span>
            <span>DEPARTMENT</span>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-1" />
      </div>
    </section>
  );
}