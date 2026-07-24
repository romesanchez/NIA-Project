import { useMemo, useRef, useState } from "react";
import type { Department } from "@/data/departments";
import { useDeptLayout } from "@/hooks/useDeptLayout";
import { VB_H, VB_W, PAD, elbowPath, elbowVariant, connectorStyle } from "@/lib/deptLayout";
import { DeviceGlyph, DEVICE_LABELS } from "./DeviceGlyph";

interface Props {
  dept: Department;
}

const ICON_SIZE = 20;
const CHIP_R = 28;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const CX = VB_W / 2;
const CY = VB_H / 2;

export function FloorPlanViewer({ dept }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { layout } = useDeptLayout(dept);
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
        <span className="ml-auto flex items-center gap-3 normal-case tracking-normal">
          <LegendSwatch dash="3 2" color="var(--color-primary)" label="LAN" />
          <LegendSwatch dash="1 3" color="var(--color-accent)" label="USB" />
          <LegendSwatch dash="0.5 4" color="var(--color-muted-foreground)" label="Wireless" />
        </span>
      </div>

      {/* SVG Canvas — floor plan rooms with the network layer overlaid */}
      <div className="flex-1 relative overflow-hidden bg-tint">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: "none" }}
        >
          <defs>
            <pattern id={`grid-${dept.acronym}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-border)" strokeWidth="0.4" />
            </pattern>
          </defs>

          {/* Background grid (stays fixed, not scaled) */}
          <rect width={VB_W} height={VB_H} fill={`url(#grid-${dept.acronym})`} />

          {/* Canvas boundary */}
          <rect
            x={PAD - 4}
            y={PAD - 4}
            width={VB_W - PAD * 2 + 8}
            height={VB_H - PAD * 2 + 8}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2"
            pointerEvents="none"
          />

          {/* Zoomable content */}
          <g transform={`translate(${CX} ${CY}) scale(${zoom}) translate(${-CX} ${-CY})`}>
            {/* Floor plan rooms — matches the department's floor plan description */}
            {layout.walls.map((w, i) => (
              <g key={w.id}>
                <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="none" stroke="var(--color-ink)" strokeWidth="0.9" />
                <text x={w.x + 8} y={w.y + 14} fontFamily="var(--font-mono)" fontSize="9"
                      fill="var(--color-muted-foreground)" letterSpacing="1.5">
                  R.{String(i + 1).padStart(2, "0")}
                </text>
                <text x={w.x + 8} y={w.y + w.h - 8} fontFamily="var(--font-mono)" fontSize="9"
                      fill="var(--color-ink)" letterSpacing="1.2">
                  {w.label}
                </text>
              </g>
            ))}

            {/* Links — LAN/USB run as right-angle cable elbows; Wireless
                hops straight through the air with a Wi-Fi glyph at midpoint */}
            {layout.connections.map((c) => {
              const a = nodeById.get(c.from);
              const b = nodeById.get(c.to);
              if (!a || !b) return null;
              const style = connectorStyle(c.connType);
              const d = style.routed ? elbowPath(a, b, elbowVariant(c.id)) : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              return (
                <g key={c.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                    strokeLinecap={style.cap}
                    opacity={style.opacity ?? 0.7}
                  />
                  {c.connType === "WIRELESS" && (
                    <g transform={`translate(${mid.x},${mid.y})`} opacity={0.8}>
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
                <g transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}>
                  {/* Chip backdrop for legibility on the grid */}
                  <circle
                    r={CHIP_R}
                    fill="var(--color-background)"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <DeviceGlyph type={n.type} size={ICON_SIZE} />
                </g>

                {/* Device label */}
                <text
                  x={n.x}
                  y={n.y + CHIP_R + 14}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--color-ink)"
                  pointerEvents="none"
                  letterSpacing="0.3"
                >
                  {DEVICE_LABELS[n.type]}
                </text>
              </g>
            ))}
          </g>
        </svg>

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

function LegendSwatch({ dash, color, label }: { dash: string; color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <svg width="16" height="6" viewBox="0 0 16 6">
        <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="1.4" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
