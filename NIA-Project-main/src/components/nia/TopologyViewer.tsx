import { useMemo, useRef, useState } from "react";
import type { Department } from "@/data/departments";
import { useTopologyLayout } from "@/hooks/useTopologyLayout";
import { TOPO_VB_H, TOPO_VB_W, topologyConnectorStyle } from "@/lib/topologyLayout";
import { computeLabelBox, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT, LABEL_PAD_X, LABEL_PAD_Y } from "@/lib/deptLayout";
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

  // Auto-fit: frame the viewBox tightly around whatever is actually placed
  // (devices + labels) instead of always showing the full 3000x1800 editor
  // canvas. This is what makes the diagram appear large and centered the
  // instant the viewer opens, no matter how few devices a department has.
  const fitViewBox = useMemo(() => {
    const nodePoints = layout.nodes.map((n) => ({ minX: n.x, maxX: n.x, minY: n.y, maxY: n.y }));
    // Multi-line labels can be much wider/taller than a device chip, so use
    // each label's actual measured box instead of just its center point —
    // otherwise a wide VLAN/credentials note gets clipped at the edge.
    const labelPoints = layout.labels.map((l) => {
      const box = computeLabelBox(l.text);
      return {
        minX: l.x - box.width / 2, maxX: l.x + box.width / 2,
        minY: l.y - box.height / 2, maxY: l.y + box.height / 2,
      };
    });
    const rects = [...nodePoints, ...labelPoints];
    if (rects.length === 0) return `0 0 ${TOPO_VB_W} ${TOPO_VB_H}`;

    const FIT_PAD = 110; // room for device chips and port dots
    const minX = Math.min(...rects.map((r) => r.minX)) - FIT_PAD;
    const maxX = Math.max(...rects.map((r) => r.maxX)) + FIT_PAD;
    const minY = Math.min(...rects.map((r) => r.minY)) - FIT_PAD;
    const maxY = Math.max(...rects.map((r) => r.maxY)) + FIT_PAD;

    // Keep a sane minimum size so a single device isn't blown up to fill
    // the whole panel at an absurd scale.
    const MIN_SPAN = 420;
    const w = Math.max(MIN_SPAN, maxX - minX);
    const h = Math.max(MIN_SPAN, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  }, [layout.nodes, layout.labels]);

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
            viewBox={fitViewBox}
            className="w-full h-full block"
            preserveAspectRatio="xMidYMid meet"
            style={{ touchAction: "none" }}
          >
            <defs>
              <pattern id={`tgrid-${dept.acronym}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--color-border)" />
              </pattern>
            </defs>

            <rect x={-TOPO_VB_W} y={-TOPO_VB_H} width={TOPO_VB_W * 3} height={TOPO_VB_H * 3} fill={`url(#tgrid-${dept.acronym})`} />

            <g transform={`scale(${zoom})`} style={{ transformOrigin: "center center", transformBox: "fill-box" }}>
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

              {/* Text labels — freeform notes placed in the editor. Support
                  multiple lines (VLAN tables, credentials, etc.), rendered
                  with a light background box so a block of text reads
                  cleanly against the grid instead of floating bare. */}
              {layout.labels.map((l) => {
                const box = computeLabelBox(l.text);
                return (
                  <g key={l.id} transform={`translate(${l.x},${l.y})`} pointerEvents="none">
                    <rect
                      x={-box.width / 2} y={-box.height / 2} width={box.width} height={box.height}
                      rx={3} fill="var(--color-background)" fillOpacity={1}
                      stroke="var(--color-border)" strokeWidth={1}
                    />
                    <text
                      x={-box.width / 2 + LABEL_PAD_X / 2} y={-box.height / 2 + LABEL_PAD_Y / 2}
                      dominantBaseline="hanging"
                      fontFamily="var(--font-mono)" fontSize={LABEL_FONT_SIZE} fontWeight="700"
                      letterSpacing="0.03em" fill="var(--color-ink)"
                    >
                      {box.lines.map((line, i) => (
                        <tspan key={i} x={-box.width / 2 + LABEL_PAD_X / 2} dy={i === 0 ? 0 : LABEL_LINE_HEIGHT}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
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