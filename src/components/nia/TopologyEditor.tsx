import { useEffect, useMemo, useRef, useState } from "react";
import type { Department, DeviceType } from "@/data/departments";
import { useTopologyLayout } from "@/hooks/useTopologyLayout";
import { CONN_TYPE_LABELS, ConnType, uid } from "@/lib/deptLayout";
import { TOPO_PAD, TOPO_VB_H, TOPO_VB_W, topologyConnectorStyle } from "@/lib/topologyLayout";
import { DeviceGlyph, DEVICE_LABELS, DEVICE_FULL_LABELS } from "./DeviceGlyph";

interface Props { dept: Department }

const DEVICE_TYPES: DeviceType[] = ["PC", "SERVER", "SWITCH", "ROUTER", "PRINTER", "AP", "WEBCAM", "LAPTOP", "SMARTPHONE", "MEDIACONVERTER", "CONTROLLER"];
type Tool = "select" | "connect" | "text" | { kind: "place"; type: DeviceType };

const ICON_SIZE = 20;
const CHIP_R = 28;
const PORT_R = 3.5;
const LABEL_BOX_W = 160;
const LABEL_BOX_H = 26;

interface DragState { kind: "node" | "label"; id: string; offX: number; offY: number }

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

const WIRE_TYPES: { type: ConnType; color: string; dash?: string; label: string; shortLabel: string }[] = [
  { type: "STRAIGHT",  color: "#1a7a3f", dash: undefined, label: "Straight-Through", shortLabel: "ST" },
  { type: "CROSSOVER", color: "#e8a020", dash: "8 4",     label: "Crossover",        shortLabel: "CO" },
  { type: "FIBER",     color: "#00bcd4", dash: undefined, label: "Fiber Optic",       shortLabel: "FO" },
  { type: "SERIAL",    color: "#9c27b0", dash: "3 3",     label: "Serial DCE/DTE",   shortLabel: "SE" },
  { type: "USB",       color: "#e53935", dash: "2 4",     label: "USB Cable",         shortLabel: "USB" },
  { type: "WIRELESS",  color: "#607d8b", dash: "1 4",     label: "Wireless",          shortLabel: "WL" },
];

export function TopologyEditor({ dept }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    layout, addNode, moveNode, removeNode,
    addConnection, removeConnection, reset,
    addLabel, moveLabel, editLabel, removeLabel,
  } = useTopologyLayout(dept);

  const [tool, setTool] = useState<Tool>("select");
  const [connType, setConnType] = useState<ConnType>("STRAIGHT");
  const [selected, setSelected] = useState<{ kind: "node" | "conn" | "label"; id: string } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [zoom, setZoom] = useState(1);

  const nodeById = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);
  const labelById = useMemo(() => new Map(layout.labels.map(l => [l.id, l])), [layout.labels]);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingLabelId) return;
      if (e.key === "Escape") {
        if (typeof tool === "object" || tool === "connect" || tool === "text") { setTool("select"); setConnectFrom(null); }
        else setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        if (selected.kind === "node") removeNode(selected.id);
        if (selected.kind === "conn") removeConnection(selected.id);
        if (selected.kind === "label") removeLabel(selected.id);
        setSelected(null);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(z => clampZoom(z + ZOOM_STEP));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        setZoom(z => clampZoom(z - ZOOM_STEP));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selected, editingLabelId, removeNode, removeConnection, removeLabel]);

  // Ctrl/Cmd + scroll wheel to zoom, like most diagram editors. React's
  // onWheel handler is attached as a passive listener by default, so
  // preventDefault() inside it is silently ignored — this needs a real
  // addEventListener with { passive: false } to actually stop the browser
  // page from zooming/scrolling instead.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(z => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    if (typeof tool === "object" && tool.kind === "place") {
      // Free placement across the whole canvas — only keep it from landing
      // fully off the edge, instead of squeezing it into a small inset box.
      const nx = Math.max(0, Math.min(TOPO_VB_W, x));
      const ny = Math.max(0, Math.min(TOPO_VB_H, y));
      addNode(tool.type, nx, ny);
      setTool("select");
      return;
    }
    if (tool === "text") {
      const nx = Math.max(0, Math.min(TOPO_VB_W, x));
      const ny = Math.max(0, Math.min(TOPO_VB_H, y));
      const id = uid("l");
      addLabel(nx, ny, "Label", id);
      setTool("select");
      setSelected({ kind: "label", id });
      setDraftText("Label");
      setEditingLabelId(id);
      return;
    }
    if (editingLabelId) commitLabelEdit();
    setSelected(null);
    setConnectFrom(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === "node") removeNode(selected.id);
    if (selected.kind === "conn") removeConnection(selected.id);
    if (selected.kind === "label") removeLabel(selected.id);
    setSelected(null);
  };

  const startEditingLabel = (id: string) => {
    const l = labelById.get(id); if (!l) return;
    setSelected({ kind: "label", id });
    setDraftText(l.text);
    setEditingLabelId(id);
  };

  const commitLabelEdit = () => {
    if (!editingLabelId) return;
    const text = draftText.trim();
    if (text) editLabel(editingLabelId, text);
    else removeLabel(editingLabelId);
    setEditingLabelId(null);
  };

  const cancelLabelEdit = () => {
    if (!editingLabelId) return;
    const l = labelById.get(editingLabelId);
    if (l && !l.text.trim()) removeLabel(editingLabelId);
    setEditingLabelId(null);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setCursor({ x, y });
    if (!drag) return;
    // Same free-range clamp as placement — devices/labels can be dragged
    // anywhere across the full canvas, not locked to a small centered box.
    const nx = Math.max(0, Math.min(TOPO_VB_W, x - drag.offX));
    const ny = Math.max(0, Math.min(TOPO_VB_H, y - drag.offY));
    if (drag.kind === "node") moveNode(drag.id, nx, ny);
    else moveLabel(drag.id, nx, ny);
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
    if (editingLabelId) commitLabelEdit();
    setSelected({ kind: "node", id });
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setDrag({ kind: "node", id, offX: x - node.x, offY: y - node.y });
  };

  const onLabelPointerDown = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (tool === "connect" || typeof tool === "object" || tool === "text") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const label = labelById.get(id); if (!label) return;
    if (editingLabelId && editingLabelId !== id) commitLabelEdit();
    setSelected({ kind: "label", id });
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setDrag({ kind: "label", id, offX: x - label.x, offY: y - label.y });
  };

  const cursorStyle =
    typeof tool === "object" ? "crosshair" :
    tool === "connect" ? "cell" :
    tool === "text" ? "text" :
    drag ? "grabbing" : "default";

  const activeWire = WIRE_TYPES.find(w => w.type === connType)!;

  return (
    <div className="w-full h-full flex flex-col">

      {/* Status bar — top */}
      <div className="px-3 py-1 border-b border-border font-mono text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-4 bg-background/80">
        <span>
          MODE ·{" "}
          {tool === "select" ? "SELECT / DRAG" :
           tool === "connect" ? `ADD WIRE (${CONN_TYPE_LABELS[connType]}) · ${connectFrom ? "CLICK 2ND DEVICE" : "CLICK 1ST DEVICE"}` :
           tool === "text" ? "CLICK CANVAS TO PLACE TEXT LABEL" :
           `CLICK CANVAS TO PLACE ${DEVICE_FULL_LABELS[(tool as { kind: "place"; type: DeviceType }).type]}`}
        </span>
        <span>DEVICES {layout.nodes.length}</span>
        <span>WIRES {layout.connections.length}</span>
        <span>LABELS {layout.labels.length}</span>
        {selected && !editingLabelId && (
          <span className="ml-auto text-destructive">
            {selected.kind.toUpperCase()} SELECTED · DEL to remove
          </span>
        )}
        {editingLabelId && (
          <span className="ml-auto">EDITING LABEL · ENTER TO SAVE · ESC TO CANCEL</span>
        )}
      </div>

      {/* Scoped scrollbar styling — thin, dark, Packet-Tracer-ish, instead of
          the browser default. Scoped to .topo-scroll so it doesn't leak out
          to the rest of the app. */}
      <style>{`
        .topo-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) var(--color-tint);
        }
        .topo-scroll::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        .topo-scroll::-webkit-scrollbar-track {
          background: var(--color-tint);
        }
        .topo-scroll::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border: 3px solid var(--color-tint);
          border-radius: 8px;
        }
        .topo-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--color-ink);
        }
        .topo-scroll::-webkit-scrollbar-corner {
          background: var(--color-tint);
        }
      `}</style>

      {/* Canvas — overflow-auto (not hidden) + a fixed pixel-size SVG below
          is what gives the Packet-Tracer feel: the canvas never
          squeezes/stretches to fit the window, it just scrolls, so device
          positions stay exactly where you dropped them regardless of
          viewport size. The zoom controls live in an outer non-scrolling
          wrapper so they stay put in the corner instead of scrolling away
          with the content. */}
      <div className="flex-1 relative min-h-0 overflow-hidden bg-tint">
        <div ref={scrollRef} className="w-full h-full overflow-auto topo-scroll">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${TOPO_VB_W} ${TOPO_VB_H}`}
            width={TOPO_VB_W * zoom}
            height={TOPO_VB_H * zoom}
            className="block"
            style={{ cursor: cursorStyle, touchAction: "none" }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
          >
            <defs>
              <pattern id={`etgrid-${dept.acronym}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--color-border)" />
              </pattern>
            </defs>
            <rect width={TOPO_VB_W} height={TOPO_VB_H} fill={`url(#etgrid-${dept.acronym})`} />
            <rect x={TOPO_PAD - 8} y={TOPO_PAD - 8}
                  width={TOPO_VB_W - (TOPO_PAD - 8) * 2} height={TOPO_VB_H - (TOPO_PAD - 8) * 2}
                  fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" pointerEvents="none" />

            {/* Wires */}
            {layout.connections.map(c => {
              const a = nodeById.get(c.from); const b = nodeById.get(c.to);
              if (!a || !b) return null;
              const sel = selected?.kind === "conn" && selected.id === c.id;
              const style = topologyConnectorStyle(c.connType);
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const wdef = WIRE_TYPES.find(w => w.type === c.connType);
              return (
                <g key={c.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={sel ? "var(--color-destructive)" : style.stroke}
                        strokeWidth={sel ? 2.8 : style.width}
                        strokeDasharray={sel ? undefined : style.dash}
                        opacity={sel ? 1 : style.opacity}
                        strokeLinecap={style.cap} />
                  <circle cx={a.x} cy={a.y} r={PORT_R} fill={sel ? "var(--color-destructive)" : style.stroke} />
                  <circle cx={b.x} cy={b.y} r={PORT_R} fill={sel ? "var(--color-destructive)" : style.stroke} />

                  {/* Wire type badge (non-straight wires only) */}
                  {wdef && c.connType !== "STRAIGHT" && (
                    <g transform={`translate(${mid.x},${mid.y})`} pointerEvents="none">
                      <rect x={-14} y={-8} width={28} height={16} rx={4} fill={wdef.color} opacity={0.9} />
                      <text textAnchor="middle" dominantBaseline="middle"
                            fontFamily="var(--font-mono)" fontSize="7" fontWeight="800"
                            fill="white" letterSpacing="0.05em">
                        {wdef.shortLabel}
                      </text>
                    </g>
                  )}

                  {/* Wireless arc icon */}
                  {c.connType === "WIRELESS" && (
                    <g transform={`translate(${mid.x},${mid.y - 12})`} opacity={0.85} pointerEvents="none">
                      <path d="M -5 2 Q 0 -5 5 2" fill="none" stroke={sel ? "var(--color-destructive)" : style.stroke} strokeWidth={1} strokeLinecap="round" />
                      <path d="M -3 2 Q 0 -1.5 3 2" fill="none" stroke={sel ? "var(--color-destructive)" : style.stroke} strokeWidth={1} strokeLinecap="round" />
                      <circle cy={2} r={0.9} fill={sel ? "var(--color-destructive)" : style.stroke} />
                    </g>
                  )}

                  {/* Fat invisible hit area */}
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="transparent" strokeWidth={14}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => { e.stopPropagation(); setSelected({ kind: "conn", id: c.id }); }} />
                </g>
              );
            })}

            {/* Pending wire preview */}
            {tool === "connect" && connectFrom && cursor && nodeById.get(connectFrom) && (
              <line
                x1={nodeById.get(connectFrom)!.x} y1={nodeById.get(connectFrom)!.y}
                x2={cursor.x} y2={cursor.y}
                stroke={activeWire.color} strokeWidth={1.6} strokeDasharray="4 3" pointerEvents="none"
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
                    <circle r={CHIP_R} fill="var(--color-background)"
                      stroke={isConnFrom ? "var(--color-accent)" : isSel ? "var(--color-primary)" : "var(--color-border)"}
                      strokeWidth={isSel || isConnFrom ? 1.8 : 1}
                      strokeDasharray={isSel || isConnFrom ? "3 2" : undefined} />
                    <DeviceGlyph type={n.type} size={ICON_SIZE} />
                  </g>
                  <text x={n.x} y={n.y + CHIP_R + 13}
                    textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700"
                    fill="var(--color-ink)" letterSpacing="0.3" pointerEvents="none">
                    {DEVICE_LABELS[n.type]}
                  </text>
                </g>
              );
            })}

            {/* Text labels */}
            {layout.labels.map(l => {
              const isSel = selected?.kind === "label" && selected.id === l.id;
              const isEditing = editingLabelId === l.id;
              return (
                <g key={l.id} transform={`translate(${l.x},${l.y})`}>
                  {isEditing ? (
                    <foreignObject x={-LABEL_BOX_W / 2} y={-LABEL_BOX_H / 2} width={LABEL_BOX_W} height={LABEL_BOX_H}>
                      <input
                        autoFocus
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") { e.preventDefault(); commitLabelEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelLabelEdit(); }
                        }}
                        onBlur={() => commitLabelEdit()}
                        style={{
                          width: "100%", height: "100%", boxSizing: "border-box",
                          font: "700 12px var(--font-mono)", letterSpacing: "0.03em",
                          textAlign: "center", color: "var(--color-ink)",
                          background: "var(--color-background)",
                          border: "1.5px solid var(--color-primary)", outline: "none",
                          padding: "2px 4px",
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <g
                      style={{ cursor: tool === "connect" || typeof tool === "object" || tool === "text" ? cursorStyle : "grab" }}
                      onPointerDown={onLabelPointerDown(l.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); startEditingLabel(l.id); }}
                    >
                      <rect x={-LABEL_BOX_W / 2} y={-LABEL_BOX_H / 2} width={LABEL_BOX_W} height={LABEL_BOX_H}
                            fill="transparent"
                            stroke={isSel ? "var(--color-primary)" : "transparent"}
                            strokeWidth={1.4} strokeDasharray={isSel ? "3 2" : undefined} />
                      <text textAnchor="middle" dominantBaseline="middle"
                            fontFamily="var(--font-mono)" fontSize="12" fontWeight="700"
                            letterSpacing="0.03em" fill="var(--color-ink)">
                        {l.text}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Ghost preview when placing device */}
            {typeof tool === "object" && tool.kind === "place" && cursor && (
              <g transform={`translate(${cursor.x},${cursor.y})`} opacity={0.55} pointerEvents="none">
                <circle r={CHIP_R} fill="var(--color-background)" stroke="var(--color-primary)" strokeWidth={1} strokeDasharray="3 2" />
                <DeviceGlyph type={tool.type} size={ICON_SIZE} />
              </g>
            )}
          </svg>
        </div>

        {/* Floating zoom controls — Packet-Tracer style, bottom-right, stays
            put regardless of scroll position since it lives outside the
            scrolling div. */}
        <div className="absolute bottom-3 right-3 flex items-center gap-0.5 bg-background/95 border border-border rounded-sm px-1 py-1 backdrop-blur shadow-sm z-10">
          <button
            onClick={() => setZoom(z => clampZoom(z - ZOOM_STEP))}
            title="Zoom out (Ctrl/Cmd + Scroll or Ctrl/Cmd + −)"
            className="font-mono text-[13px] leading-none w-6 h-6 flex items-center justify-center border border-transparent hover:border-ink rounded-sm"
          >
            −
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Reset zoom (Ctrl/Cmd + 0)"
            className="font-mono text-[10px] tracking-[0.04em] w-12 h-6 flex items-center justify-center hover:bg-ink/5 rounded-sm select-none"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(z => clampZoom(z + ZOOM_STEP))}
            title="Zoom in (Ctrl/Cmd + Scroll or Ctrl/Cmd + +)"
            className="font-mono text-[13px] leading-none w-6 h-6 flex items-center justify-center border border-transparent hover:border-ink rounded-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* ── BOTTOM TOOLBAR ── Packet Tracer style ── */}
      <div className="border-t border-border bg-background shrink-0">

        {/* Row 1 — Wire types + action buttons */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mr-2 shrink-0">WIRE TYPE</span>

          {WIRE_TYPES.map(w => {
            const isActive = tool === "connect" && connType === w.type;
            return (
              <button
                key={w.type}
                onClick={() => { setConnType(w.type); setTool("connect"); setConnectFrom(null); }}
                title={w.label}
                className={
                  "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] px-2.5 py-1.5 border rounded-sm transition-all " +
                  (isActive
                    ? "border-transparent text-white shadow-sm"
                    : "border-border text-ink hover:border-ink bg-background")
                }
                style={isActive ? { backgroundColor: w.color, borderColor: w.color } : {}}
              >
                <svg width={22} height={10} className="shrink-0">
                  <line x1={1} y1={5} x2={21} y2={5}
                    stroke={isActive ? "white" : w.color}
                    strokeWidth={2}
                    strokeDasharray={w.dash}
                    strokeLinecap="round" />
                </svg>
                {w.label}
              </button>
            );
          })}

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          {/* Add Text */}
          <button
            onClick={() => { if (editingLabelId) commitLabelEdit(); setTool("text"); setConnectFrom(null); }}
            title="Add a text label"
            className={
              "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 border rounded-sm transition-colors " +
              (tool === "text" ? "border-ink bg-ink text-background" : "border-border hover:border-ink")
            }
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <text x={1} y={11} fontFamily="monospace" fontSize={11} fontWeight="bold" fill="currentColor">T</text>
            </svg>
            ADD TEXT
          </button>

          {/* Delete */}
          <button
            onClick={deleteSelected}
            disabled={!selected}
            title="Delete selected (Del / Backspace)"
            className={
              "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 border rounded-sm transition-colors " +
              (selected
                ? "border-destructive text-destructive hover:bg-destructive hover:text-white"
                : "border-border text-muted-foreground opacity-40 cursor-not-allowed")
            }
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            DELETE
          </button>

          <div className="flex-1" />

          {/* Reset */}
          <button
            onClick={() => { if (confirm("Reset this topology to the generated layout?")) reset(); }}
            className="font-mono text-[10px] tracking-[0.12em] px-3 py-1.5 border border-border hover:border-destructive hover:text-destructive transition-colors rounded-sm"
          >
            RESET
          </button>

          {/* Select */}
          <button
            onClick={() => { if (editingLabelId) commitLabelEdit(); setTool("select"); setConnectFrom(null); }}
            className={
              "font-mono text-[10px] tracking-[0.12em] px-3 py-1.5 border rounded-sm transition-colors " +
              (tool === "select" || typeof tool === "object"
                ? "border-ink bg-ink text-background"
                : "border-border hover:border-ink")
            }
          >
            SELECT / DRAG
          </button>
        </div>

        {/* Row 2 — Device palette */}
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2">
          <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mr-1 shrink-0">DEVICES</span>
          {DEVICE_TYPES.map(t => {
            const active = typeof tool === "object" && tool.type === t;
            return (
              <button
                key={t}
                onClick={() => { if (editingLabelId) commitLabelEdit(); setTool({ kind: "place", type: t }); }}
                title={`Place ${DEVICE_FULL_LABELS[t]}`}
                className={
                  "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] pl-1.5 pr-2.5 py-1 border rounded-sm transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-ink bg-background")
                }
              >
                <svg viewBox="-16 -16 32 32" width={16} height={16} className="shrink-0">
                  <DeviceGlyph
                    type={t} size={12}
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
      </div>
    </div>
  );
}