import { useEffect, useMemo, useRef, useState } from "react";
import type { Department, DeviceType } from "@/data/departments";
import { useDeptLayout } from "@/hooks/useDeptLayout";
import { VB_H, VB_W, PAD, elbowPath, elbowVariant, connectorStyle, CONN_TYPE_LABELS, ConnType } from "@/lib/deptLayout";
import { DeviceGlyph, DEVICE_LABELS, DEVICE_FULL_LABELS } from "./DeviceGlyph";

interface Props { dept: Department }

const DEVICE_TYPES: DeviceType[] = ["PC", "SERVER", "SWITCH", "ROUTER", "PRINTER", "AP", "WEBCAM", "LAPTOP", "SMARTPHONE", "MEDIACONVERTER", "CONTROLLER"];
type Tool = "select" | "connect" | { kind: "place"; type: DeviceType };

const ICON_SIZE = 20;
const CHIP_R = 28;

interface DragState {
  kind: "node";
  id: string;
  offX: number; offY: number;
}

export function FloorPlanEditor({ dept }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const {
    layout, addNode, moveNode, removeNode,
    addConnection, removeConnection,
    reset,
  } = useDeptLayout(dept);

  const [tool, setTool] = useState<Tool>("select");
  const [connType, setConnType] = useState<ConnType>("LAN");
  const [selected, setSelected] = useState<{ kind: "node" | "conn"; id: string } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const nodeById = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);

  // convert client → svg coords
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  };

  // global keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (typeof tool === "object" || tool === "connect") { setTool("select"); setConnectFrom(null); }
        else setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        if (selected.kind === "node") removeNode(selected.id);
        if (selected.kind === "conn") removeConnection(selected.id);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selected, removeNode, removeConnection]);

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Clicks on devices/connections call stopPropagation in their own handlers,
    // so anything that reaches here is a click on empty floor-plan/grid space.
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    if (typeof tool === "object" && tool.kind === "place") {
      const nx = Math.max(PAD, Math.min(VB_W - PAD, x));
      const ny = Math.max(PAD, Math.min(VB_H - PAD, y));
      addNode(tool.type, nx, ny);
      setTool("select");
      return;
    }
    setSelected(null);
    setConnectFrom(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === "node") removeNode(selected.id);
    if (selected.kind === "conn") removeConnection(selected.id);
    setSelected(null);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setCursor({ x, y });
    if (!drag) return;
    const nx = Math.max(PAD, Math.min(VB_W - PAD, x - drag.offX));
    const ny = Math.max(PAD, Math.min(VB_H - PAD, y - drag.offY));
    moveNode(drag.id, nx, ny);
  };

  const endDrag = () => setDrag(null);

  const onNodePointerDown = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const node = nodeById.get(id); if (!node) return;
    if (tool === "connect") {
      if (!connectFrom) setConnectFrom(id);
      else { addConnection(connectFrom, id, connType); setConnectFrom(null); setTool("select"); }
      return;
    }
    setSelected({ kind: "node", id });
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setDrag({ kind: "node", id, offX: x - node.x, offY: y - node.y });
  };

  const cursorStyle =
    typeof tool === "object" ? "crosshair" :
    tool === "connect" ? "cell" :
    drag ? "grabbing" : "default";

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-border bg-background/60 backdrop-blur">
        <ToolBtn active={tool === "select"} onClick={() => { setTool("select"); setConnectFrom(null); }}>SELECT</ToolBtn>
        <ToolBtn active={tool === "connect"} onClick={() => { setTool("connect"); setConnectFrom(null); }}>CONNECT</ToolBtn>
        {tool === "connect" && (
          <div className="flex items-center gap-1 pl-1">
            {(["LAN", "USB", "WIRELESS"] as ConnType[]).map(ct => (
              <button
                key={ct}
                onClick={() => setConnType(ct)}
                title={`New links use ${CONN_TYPE_LABELS[ct]}`}
                className={
                  "font-mono text-[9px] tracking-[0.1em] px-2 py-1 border " +
                  (connType === ct
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-ink hover:text-ink")
                }
              >
                {CONN_TYPE_LABELS[ct].toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={deleteSelected}
          disabled={!selected}
          title="Delete selected (Del / Backspace)"
          className={
            "font-mono text-[10px] tracking-[0.18em] px-3 py-1 border " +
            (selected
              ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              : "border-border text-muted-foreground opacity-40 cursor-not-allowed")
          }
        >
          DELETE
        </button>
        <div className="flex-1" />
        <button
          onClick={() => { if (confirm("Reset this topology to the generated layout?")) reset(); }}
          className="font-mono text-[10px] tracking-[0.18em] px-2 py-1 border border-border hover:border-destructive hover:text-destructive"
        >
          RESET
        </button>
      </div>

      {/* Device palette — icon + full name, so it's obvious what each option is */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-border bg-background/40">
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mr-1 shrink-0">PLACE DEVICE</span>
        {DEVICE_TYPES.map(t => {
          const active = typeof tool === "object" && tool.type === t;
          return (
            <button
              key={t}
              onClick={() => setTool({ kind: "place", type: t })}
              title={`Place ${DEVICE_FULL_LABELS[t]}`}
              className={
                "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] pl-1.5 pr-2.5 py-1 border " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-ink")
              }
            >
              <svg viewBox="-16 -16 32 32" width={16} height={16} className="shrink-0">
                <DeviceGlyph
                  type={t}
                  size={12}
                  body={active ? "var(--color-primary-foreground)" : "var(--color-ink)"}
                  accent={active ? "var(--color-primary)" : "var(--color-accent)"}
                  edge={active ? "var(--color-primary)" : "var(--color-background)"}
                />
              </svg>
              {DEVICE_FULL_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Status */}
      <div className="px-3 py-1 border-b border-border font-mono text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-4">
        <span>
          MODE ·{" "}
          {tool === "select" ? "SELECT" :
           tool === "connect" ? `${connectFrom ? "PICK TARGET" : "PICK SOURCE"} (${CONN_TYPE_LABELS[connType]})` :
           `PLACE ${DEVICE_FULL_LABELS[tool.type]}`}
        </span>
        <span>DEVICES {layout.nodes.length}</span>
        <span>LINKS {layout.connections.length}</span>
        {selected && (
          <span className="ml-auto">
            {selected.kind.toUpperCase()} SELECTED · DEL or press DELETE to remove
          </span>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden bg-tint">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
          style={{ cursor: cursorStyle, touchAction: "none" }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          <defs>
            <pattern id={`egrid-${dept.acronym}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-border)" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width={VB_W} height={VB_H} fill={`url(#egrid-${dept.acronym})`} />
          <rect x={PAD - 4} y={PAD - 4} width={VB_W - PAD * 2 + 8} height={VB_H - PAD * 2 + 8}
                fill="none" stroke="var(--color-ink)" strokeWidth="2" pointerEvents="none" />

          {/* Floor plan rooms — the actual layout devices are placed inside */}
          {layout.walls.map((w, i) => (
            <g key={w.id} pointerEvents="none">
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

          {/* Connections — LAN/USB run as right-angle cable elbows; Wireless
              hops straight through the air with a Wi-Fi glyph at midpoint */}
          {layout.connections.map(c => {
            const a = nodeById.get(c.from); const b = nodeById.get(c.to);
            if (!a || !b) return null;
            const sel = selected?.kind === "conn" && selected.id === c.id;
            const style = connectorStyle(c.connType);
            const d = style.routed ? elbowPath(a, b, elbowVariant(c.id)) : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            return (
              <g key={c.id}>
                <path d={d} fill="none"
                      stroke={sel ? "var(--color-destructive)" : style.stroke}
                      strokeWidth={sel ? 1.8 : style.width} strokeDasharray={style.dash}
                      opacity={sel ? 0.95 : style.opacity ?? 0.85} strokeLinecap={style.cap} />
                {c.connType === "WIRELESS" && (
                  <g transform={`translate(${mid.x},${mid.y})`} opacity={0.8} pointerEvents="none">
                    <path d="M -5 2 Q 0 -5 5 2" fill="none" stroke={sel ? "var(--color-destructive)" : style.stroke} strokeWidth={1} strokeLinecap="round" />
                    <path d="M -3 2 Q 0 -1.5 3 2" fill="none" stroke={sel ? "var(--color-destructive)" : style.stroke} strokeWidth={1} strokeLinecap="round" />
                    <circle cy={2} r={0.9} fill={sel ? "var(--color-destructive)" : style.stroke} />
                  </g>
                )}
                <path d={d} fill="none"
                      stroke="transparent" strokeWidth={10}
                      style={{ cursor: "pointer" }}
                      onPointerDown={(e) => { e.stopPropagation(); setSelected({ kind: "conn", id: c.id }); }} />
              </g>
            );
          })}

          {/* pending connect preview */}
          {tool === "connect" && connectFrom && cursor && nodeById.get(connectFrom) && (
            <line
              x1={nodeById.get(connectFrom)!.x} y1={nodeById.get(connectFrom)!.y}
              x2={cursor.x} y2={cursor.y}
              stroke={connectorStyle(connType).stroke} strokeWidth={1} strokeDasharray="2 3" pointerEvents="none"
            />
          )}

          {/* Devices */}
          {layout.nodes.map(n => {
            const isSel = selected?.kind === "node" && selected.id === n.id;
            const isConnFrom = connectFrom === n.id;
            return (
              <g key={n.id}>
                <g transform={`translate(${n.x},${n.y})`}
                   style={{ cursor: tool === "connect" ? "cell" : "grab" }}
                   onPointerDown={onNodePointerDown(n.id)}>
                  <circle
                    r={CHIP_R}
                    fill="var(--color-background)"
                    stroke={isConnFrom ? "var(--color-accent)" : isSel ? "var(--color-primary)" : "var(--color-border)"}
                    strokeWidth={isSel || isConnFrom ? 1.8 : 1}
                    strokeDasharray={isSel || isConnFrom ? "3 2" : undefined}
                  />
                  <DeviceGlyph type={n.type} size={ICON_SIZE} />
                </g>
                <text
                  x={n.x} y={n.y + CHIP_R + 13}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize="9" fontWeight="700"
                  fill="var(--color-ink)" letterSpacing="0.3" pointerEvents="none"
                >
                  {DEVICE_LABELS[n.type]}
                </text>
              </g>
            );
          })}

          {/* place-mode ghost */}
          {typeof tool === "object" && tool.kind === "place" && cursor && (
            <g transform={`translate(${cursor.x},${cursor.y})`} opacity={0.55} pointerEvents="none">
              <circle r={CHIP_R} fill="var(--color-background)" stroke="var(--color-primary)" strokeWidth={1} strokeDasharray="3 2" />
              <DeviceGlyph type={tool.type} size={ICON_SIZE} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "font-mono text-[10px] tracking-[0.18em] px-3 py-1 border " +
        (active ? "border-ink bg-ink text-background" : "border-border hover:border-ink")
      }
    >
      {children}
    </button>
  );
}
