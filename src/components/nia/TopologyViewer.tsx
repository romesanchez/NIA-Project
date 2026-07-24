import { useMemo, useRef, useState } from "react";
import type { Department } from "@/data/departments";
import { useTopologyLayout } from "@/hooks/useTopologyLayout";
import { TOPO_VB_H, TOPO_VB_W, topologyConnectorStyle } from "@/lib/topologyLayout";
import { DeviceGlyph, DEVICE_LABELS } from "./DeviceGlyph";

interface Props {
  dept: Department;
}

const ICON_SIZE = 20;
const CHIP_R = 28;
const PORT_R = 3;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const CX = TOPO_VB_W / 2;
const CY = TOPO_VB_H / 2;

/**
 * Finalized, read-only network diagram — devices + wires only, arranged like
 * a Packet Tracer / GNS3 topology sketch. This is what "VIEW TOPOLOGY"
 * shows; it always renders whatever was last saved from the topology editor.
 */
export function TopologyViewer({ dept }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { layout } = useTopologyLayout(dept);
  const [zoom, setZoom] = useState(1);

  const nodeById = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  return (
    <div className="w-full h-full bg-tint flex flex-col">
      {/* Toolbar - Info */}
      <div className="px-3 py-2 border-b border-border bg-background/60 backdrop-blur font-mono text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-4 flex-wrap">
        <span>📍 DEVICES {layout.nodes.length}</span>
        <span>🔗 LINKS {layout.connections.length}</span>
        <span>🏷 LABELS {layout.labels.length}</span>
        <span className="ml-auto flex items-center gap-3 normal-case tracking-normal">
          <LegendSwatch dash={undefined} color="var(--color-primary)" label="LAN" />
          <LegendSwatch dash={undefined} color="var(--color-accent)" label="USB" />
          <LegendSwatch dash="1 4" color="var(--color-muted-foreground)" label="Wireless" />
        </span>
      </div>

      {/* SVG Canvas — finalized topology only, no floor plan / rooms */}
      <div className="flex-1 relative overflow-hidden bg-tint">
        {layout.nodes.length === 0 && layout.labels.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center font-mono text-[11px] tracking-[0.15em] text-muted-foreground text-center px-6">
            NO DEVICES YET · USE EDIT TOPOLOGY TO ADD SOME
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${TOPO_VB_W} ${TOPO_VB_H}`}
            className="w-full h-full block"
            preserveAspectRatio="xMidYMid meet"
            style={{ touchAction: "none" }}
          >
            <defs>
              <pattern id={`tgrid-${dept.acronym}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--color-border)" />
              </pattern>
            </defs>

            <rect width={TOPO_VB_W} height={TOPO_VB_H} fill={`url(#tgrid-${dept.acronym})`} />

            <g transform={`translate(${CX} ${CY}) scale(${zoom}) translate(${-CX} ${-CY})`}>
              {/* Wires — direct point-to-point links, Packet Tracer style */}
              {layout.connections.map((c) => {
                const a = nodeById.get(c.from);
                const b = nodeById.get(c.to);
                if (!a || !b) return null;
                const style = topologyConnectorStyle(c.connType);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                return (
                  <g key={c.id}>
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={style.stroke}
                      strokeWidth={style.width}
                      strokeDasharray={style.dash}
                      strokeLinecap={style.cap}
                      opacity={style.opacity}
                    />
                    {/* port markers at each end, like a patch-cable connector */}
                    <circle cx={a.x} cy={a.y} r={PORT_R} fill={style.stroke} opacity={style.opacity} />
                    <circle cx={b.x} cy={b.y} r={PORT_R} fill={style.stroke} opacity={style.opacity} />
                    {c.connType === "WIRELESS" && (
                      <g transform={`translate(${mid.x},${mid.y})`} opacity={0.85}>
                        <path d="M -5 2 Q 0 -5 5 2" fill="none" stroke={style.stroke} strokeWidth={1} strokeLinecap="round" />
                        <path d="M -3 2 Q 0 -1.5 3 2" fill="none" stroke={style.stroke} strokeWidth={1} strokeLinecap="round" />
                        <circle cy={2} r={0.9} fill={style.stroke} />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Devices */}
              {layout.nodes.map((n) => (
                <g key={n.id}>
                  <g transform={`translate(${n.x},${n.y})`}>
                    <circle r={CHIP_R} fill="var(--color-background)" stroke="var(--color-border)" strokeWidth="1" />
                    <DeviceGlyph type={n.type} size={ICON_SIZE} />
                  </g>
                  <text
                    x={n.x} y={n.y + CHIP_R + 14}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)" fontSize="9" fontWeight="700"
                    fill="var(--color-ink)" pointerEvents="none" letterSpacing="0.3"
                  >
                    {DEVICE_LABELS[n.type]}
                  </text>
                </g>
              ))}

              {/* Text labels — freeform annotations placed in the editor */}
              {layout.labels.map((l) => (
                <text
                  key={l.id}
                  x={l.x} y={l.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily="var(--font-mono)" fontSize="12" fontWeight="700"
                  letterSpacing="0.03em" fill="var(--color-ink)" pointerEvents="none"
                >
                  {l.text}
                </text>
              ))}
            </g>
          </svg>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-px border border-border bg-background/90 backdrop-blur shadow-sm">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-8 h-8 flex items-center justify-center font-mono text-[14px] text-ink hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent border-r border-border"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={zoomReset}
            className="px-2 h-8 flex items-center justify-center font-mono text-[10px] tracking-[0.1em] text-muted-foreground hover:bg-tint hover:text-ink border-r border-border min-w-[46px]"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-8 h-8 flex items-center justify-center font-mono text-[14px] text-ink hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ dash, color, label }: { dash?: string; color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <svg width="16" height="6" viewBox="0 0 16 6">
        <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="1.6" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
