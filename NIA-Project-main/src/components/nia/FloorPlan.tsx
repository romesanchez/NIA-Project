import type { Department } from "@/data/departments";
import { useDeptLayout } from "@/hooks/useDeptLayout";
import { VB_H, VB_W, PAD, Layout, elbowPath, elbowVariant, connectorStyle } from "@/lib/deptLayout";
import { DeviceGlyph } from "./DeviceGlyph";

interface Props {
  dept: Department;
  className?: string;
  compact?: boolean;
  layoutOverride?: Layout;
}

export function FloorPlan({ dept, className, compact, layoutOverride }: Props) {
  const { layout: hooked } = useDeptLayout(dept);
  const layout = layoutOverride ?? hooked;

  const innerX = PAD, innerY = PAD, innerW = VB_W - PAD * 2, innerH = VB_H - PAD * 2;
  const nodeById = new Map(layout.nodes.map(n => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{ background: "var(--color-tint)" }}
    >
      <defs>
        <pattern id={`grid-${dept.acronym}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-border)" strokeWidth="0.4" />
        </pattern>
        <pattern id={`hatch-${dept.acronym}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-primary)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={VB_W} height={VB_H} fill={`url(#grid-${dept.acronym})`} />

      <rect x={innerX - 4} y={innerY - 4} width={innerW + 8} height={innerH + 8}
            fill="none" stroke="var(--color-ink)" strokeWidth="2" />

      {layout.walls.map((w, i) => (
        <g key={w.id}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="none" stroke="var(--color-ink)" strokeWidth="0.9" />
          {!compact && (
            <>
              <text x={w.x + 8} y={w.y + 14} fontFamily="var(--font-mono)" fontSize="9"
                    fill="var(--color-muted-foreground)" letterSpacing="1.5">
                R.{String(i + 1).padStart(2, "0")}
              </text>
              <text x={w.x + 8} y={w.y + w.h - 8} fontFamily="var(--font-mono)" fontSize="9"
                    fill="var(--color-ink)" letterSpacing="1.2">
                {w.label}
              </text>
            </>
          )}
        </g>
      ))}

      {/* connections — right-angle cable runs for LAN/USB, straight hop for wireless */}
      {layout.connections.map(c => {
        const a = nodeById.get(c.from); const b = nodeById.get(c.to);
        if (!a || !b) return null;
        const style = connectorStyle(c.connType);
        const d = style.routed
          ? elbowPath(a, b, elbowVariant(c.id), 4)
          : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        return (
          <path key={c.id} d={d} fill="none"
                stroke={style.stroke} strokeWidth={style.width * 0.7} strokeDasharray={style.dash}
                opacity={style.opacity ?? 0.7} strokeLinecap={style.cap} />
        );
      })}

      {/* entry hatch */}
      <g>
        <rect x={innerX + innerW * 0.5 - 24} y={innerY + innerH - 4} width={48} height={8}
              fill={`url(#hatch-${dept.acronym})`} stroke="var(--color-ink)" strokeWidth="0.6" />
        <path d={`M ${innerX + innerW * 0.5 - 24} ${innerY + innerH} A 48 48 0 0 1 ${innerX + innerW * 0.5 + 24} ${innerY + innerH}`}
              fill="none" stroke="var(--color-primary)" strokeWidth="0.5" strokeDasharray="2 2" />
      </g>

      {/* devices */}
      {layout.nodes.map(n => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <DeviceGlyph type={n.type} size={compact ? 6 : 8} />
        </g>
      ))}

      {!compact && (
        <>
          <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-muted-foreground)">
            <line x1={innerX} y1={20} x2={innerX + innerW} y2={20} stroke="var(--color-muted-foreground)" strokeWidth="0.5" />
            <line x1={innerX} y1={14} x2={innerX} y2={26} stroke="var(--color-muted-foreground)" strokeWidth="0.5" />
            <line x1={innerX + innerW} y1={14} x2={innerX + innerW} y2={26} stroke="var(--color-muted-foreground)" strokeWidth="0.5" />
            <text x={innerX + innerW / 2} y={16} textAnchor="middle">{(innerW / 10).toFixed(0)} FT</text>
            <line x1={20} y1={innerY} x2={20} y2={innerY + innerH} stroke="var(--color-muted-foreground)" strokeWidth="0.5" />
            <text x={12} y={innerY + innerH / 2} transform={`rotate(-90 12 ${innerY + innerH / 2})`} textAnchor="middle">
              {(innerH / 10).toFixed(0)} FT
            </text>
          </g>
          <g transform={`translate(${VB_W - 60}, 60)`}>
            <circle r="20" fill="none" stroke="var(--color-ink)" strokeWidth="0.6" />
            <path d="M 0 -16 L 6 12 L 0 6 L -6 12 Z" fill="var(--color-ink)" />
            <text y="-22" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-ink)">N</text>
          </g>
          <g transform={`translate(${VB_W - 260}, ${VB_H - 70})`}>
            <rect width="220" height="50" fill="var(--color-background)" stroke="var(--color-ink)" strokeWidth="0.8" />
            <line x1="0" y1="16" x2="220" y2="16" stroke="var(--color-ink)" strokeWidth="0.4" />
            <line x1="140" y1="0" x2="140" y2="50" stroke="var(--color-ink)" strokeWidth="0.4" />
            <text x="6" y="11" fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-muted-foreground)" letterSpacing="1">
              NIA-TOPOLOGY / FLOOR PLAN
            </text>
            <text x="6" y="32" fontFamily="var(--font-sans)" fontSize="14" fontWeight="600" fill="var(--color-ink)">
              {dept.acronym}
            </text>
            <text x="6" y="44" fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-muted-foreground)">
              {dept.name.toUpperCase()}
            </text>
            <text x="146" y="11" fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-muted-foreground)">SCALE 1:100</text>
            <text x="146" y="26" fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-ink)">DWG {dept.acronym}-A-01</text>
            <text x="146" y="40" fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-muted-foreground)">REV 03 · 07.2026</text>
          </g>
        </>
      )}
    </svg>
  );
}
