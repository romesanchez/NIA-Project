import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { Document, ImageRun, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import type { Department, DeviceType } from "@/data/departments";
import { useTopologyLayout } from "@/hooks/useTopologyLayout";
import { CONN_TYPE_LABELS, ConnType, computeLabelBox, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT, LABEL_PAD_X, LABEL_PAD_Y, uid } from "@/lib/deptLayout";
import { TOPO_PAD, TOPO_VB_H, TOPO_VB_W, topologyConnectorStyle } from "@/lib/topologyLayout";
import { DeviceGlyph, DEVICE_LABELS, DEVICE_FULL_LABELS } from "./DeviceGlyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props { dept: Department }

const DEVICE_TYPES: DeviceType[] = ["PC", "SERVER", "SWITCH", "ROUTER", "PRINTER", "AP", "WEBCAM", "LAPTOP", "SMARTPHONE", "MEDIACONVERTER", "CONTROLLER", "SATELLITE"];
type Tool = "select" | "connect" | "text" | { kind: "place"; type: DeviceType };

const ICON_SIZE = 20;
const CHIP_R = 28;
const PORT_R = 3.5;
const LABEL_PAD_X_HALF = LABEL_PAD_X / 2;
const LABEL_PAD_Y_HALF = LABEL_PAD_Y / 2;

interface DragState { kind: "node" | "label"; id: string; offX: number; offY: number }

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// (no long-press constants — group copy now fires immediately on drag)

// The canvas draws everything with var(--color-*) theme tokens so it matches
// the rest of the app. A print/PDF window is a blank document with none of
// that CSS loaded, so we copy the current computed values of just the
// tokens the topology SVG actually uses into it — otherwise wires, chips,
// and text would render as browser-default black.
const PRINT_CSS_VARS = [
  "--color-background", "--color-ink", "--color-border", "--color-tint",
  "--color-primary", "--color-primary-foreground", "--color-accent",
  "--color-destructive", "--color-muted-foreground", "--font-mono",
];

// Clones the live topology SVG, strips the editor-only grid background and
// dashed canvas-bounds rect (clutter on a printed page/exported file), and
// inlines the current values of every var(--color-*) token it uses — a
// canvas/export context has no app stylesheet, so the raw CSS vars would
// otherwise resolve to nothing and everything would render black.
function cleanSvgForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rects = clone.querySelectorAll(":scope > rect");
  rects.forEach((r, i) => { if (i < 2) r.remove(); }); // grid bg + dashed bounds
  const rootStyle = getComputedStyle(document.documentElement);
  const varsCss = PRINT_CSS_VARS
    .map((v) => `${v}: ${rootStyle.getPropertyValue(v).trim() || "#1a1a1a"};`)
    .join(" ");
  const styleTag = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleTag.textContent = `:root { ${varsCss} } svg { background: ${rootStyle.getPropertyValue("--color-background").trim() || "#fff"}; }`;
  clone.insertBefore(styleTag, clone.firstChild);
  return clone;
}

// Rasterizes the cleaned topology SVG to a PNG data URL at the given scale
// (2x by default for crisp print/PDF output on retina-ish displays).
async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<{ dataUrl: string; width: number; height: number }> {
  const clean = cleanSvgForExport(svg);
  const width = TOPO_VB_W;
  const height = TOPO_VB_H;
  const svgMarkup = new XMLSerializer().serializeToString(clean);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-background").trim() || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png", 1.0), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
    exportToFile, importFromFile,
  } = useTopologyLayout(dept);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [connType, setConnType] = useState<ConnType>("STRAIGHT");
  const [selected, setSelected] = useState<{ kind: "node" | "conn" | "label"; id: string } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  // Marquee (rubber-band) multi-select — click and drag across empty canvas
  // to draw a box; devices inside get highlighted live, the same gesture as
  // dragging across text to select it in Word. Once highlighted, dragging
  // any of them moves the whole group, and holding one down duplicates the
  // whole group (see onNodePointerDown).
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const groupDragRef = useRef<{ startX: number; startY: number; positions: Map<string, { x: number; y: number }> } | null>(null);

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
      // Don't hijack Delete/Backspace/Ctrl+Zoom while the user is typing in
      // a text input on this page.
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "TEXTAREA" || activeTag === "INPUT") return;
      if (e.key === "Escape") {
        if (typeof tool === "object" || tool === "connect" || tool === "text") { setTool("select"); setConnectFrom(null); }
        else { setSelected(null); setMultiSelected(new Set()); }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        if (multiSelected.size > 0) {
          multiSelected.forEach((id) => removeNode(id));
          setMultiSelected(new Set());
        }
        if (selected?.kind === "node") removeNode(selected.id);
        if (selected?.kind === "conn") removeConnection(selected.id);
        if (selected?.kind === "label") removeLabel(selected.id);
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
    // Start a marquee (rubber-band) selection on empty canvas — devices
    // inside the box get highlighted live as you drag, same as dragging
    // across text to select it.
    if (tool === "select") {
      setMultiSelected(new Set());
      setMarquee({ x0: x, y0: y, x1: x, y1: y });
    }
  };

  // Double-click anywhere on empty canvas → drop a note right there and
  // start typing immediately. No need to press ADD TEXT first. Double-
  // clicking a device or an existing note is handled by their own
  // onDoubleClick (which stops propagation), so this only fires on truly
  // empty canvas.
  const onSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (typeof tool === "object" || tool === "connect") return;
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const nx = Math.max(0, Math.min(TOPO_VB_W, x));
    const ny = Math.max(0, Math.min(TOPO_VB_H, y));
    if (editingLabelId) commitLabelEdit();
    const id = uid("l");
    addLabel(nx, ny, "", id);
    setTool("select");
    setSelected({ kind: "label", id });
    setDraftText("");
    setEditingLabelId(id);
  };

  const deleteSelected = () => {
    if (multiSelected.size > 0) {
      multiSelected.forEach((id) => removeNode(id));
      setMultiSelected(new Set());
    }
    if (!selected) return;
    if (selected.kind === "node") removeNode(selected.id);
    if (selected.kind === "conn") removeConnection(selected.id);
    if (selected.kind === "label") removeLabel(selected.id);
    setSelected(null);
  };

  // Every edit already auto-persists to storage the moment it happens
  // (see useTopologyLayout's commit()), so SAVE has nothing new to write —
  // it just gives the person a visible "yes, it's saved" confirmation for
  // the familiar Ctrl+S habit.
  const handleSave = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  };

  // Opens a clean, print-only view of the topology in a new tab and
  // triggers the browser's print dialog. Choosing "Save as PDF" as the
  // destination there is the standard, dependency-free way to get a PDF
  // that exactly matches what's on screen.
  const handlePrint = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clean = cleanSvgForExport(svg);
    const svgMarkup = new XMLSerializer().serializeToString(clean);
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${dept.name} — Topology</title>
<style>
  @page { size: landscape; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: flex; flex-direction: column; align-items: center; font-family: system-ui, sans-serif; padding: 12px 0; }
  h1 { font-size: 14px; margin: 0 0 10px; letter-spacing: 0.05em; text-transform: uppercase; color: #111; }
  svg { width: 100%; height: auto; max-width: 100%; }
</style>
</head>
<body>
  <h1>${dept.name} (${dept.acronym}) — Network Topology</h1>
  ${svgMarkup}
</body>
</html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // Renders the topology to PNG and drops it into a landscape PDF page —
  // a real, directly-downloaded .pdf file (no print dialog step needed).
  const handleSaveAsPdf = async () => {
    const svg = svgRef.current;
    if (!svg || exporting) return;
    setExporting("pdf");
    try {
      const { dataUrl, width, height } = await svgToPngDataUrl(svg, 2);
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [width + 40, height + 70] });
      pdf.setFontSize(12);
      pdf.text(`${dept.name} (${dept.acronym}) — Network Topology`, 20, 28);
      pdf.addImage(dataUrl, "PNG", 20, 45, width, height);
      pdf.save(`${dept.acronym}-topology.pdf`);
    } finally {
      setExporting(null);
    }
  };

  // Renders the topology to PNG and embeds it into a real .docx file.
  const handleSaveAsDocx = async () => {
    const svg = svgRef.current;
    if (!svg || exporting) return;
    setExporting("docx");
    try {
      const { dataUrl, width, height } = await svgToPngDataUrl(svg, 2);
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      // Keep the embedded image within a normal page width regardless of
      // how large the canvas got, preserving its aspect ratio.
      const maxDocxWidthPx = 620;
      const ratio = Math.min(1, maxDocxWidthPx / width);

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              text: `${dept.name} (${dept.acronym})`,
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: "Network Topology",
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: "png",
                  data: bytes,
                  transformation: { width: Math.round(width * ratio), height: Math.round(height * ratio) },
                }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dept.acronym}-topology.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
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

    // Growing the marquee box — recompute which devices fall inside it on
    // every move, so the highlight updates live, the same way a text
    // selection grows as you drag across more words.
    if (marquee) {
      const next = { ...marquee, x1: x, y1: y };
      setMarquee(next);
      const minX = Math.min(next.x0, next.x1), maxX = Math.max(next.x0, next.x1);
      const minY = Math.min(next.y0, next.y1), maxY = Math.max(next.y0, next.y1);
      const inside = new Set<string>();
      layout.nodes.forEach((n) => {
        if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) inside.add(n.id);
      });
      setMultiSelected(inside);
      return;
    }

    // Dragging any device that belongs to the current highlighted group
    // moves the whole group together, preserving everyone's relative
    // position — like dragging selected text moves the whole selection.
    if (groupDragRef.current) {
      const { startX, startY, positions } = groupDragRef.current;
      const dx = x - startX, dy = y - startY;
      positions.forEach((pos, id) => {
        const nx = Math.max(0, Math.min(TOPO_VB_W, pos.x + dx));
        const ny = Math.max(0, Math.min(TOPO_VB_H, pos.y + dy));
        moveNode(id, nx, ny);
      });
      return;
    }

    if (!drag) return;
    // Same free-range clamp as placement — devices/labels can be dragged
    // anywhere across the full canvas, not locked to a small centered box.
    const nx = Math.max(0, Math.min(TOPO_VB_W, x - drag.offX));
    const ny = Math.max(0, Math.min(TOPO_VB_H, y - drag.offY));
    if (drag.kind === "node") moveNode(drag.id, nx, ny);
    else moveLabel(drag.id, nx, ny);
  };

  const endDrag = () => {
    setDrag(null);
    setMarquee(null);
    groupDragRef.current = null;
  };

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
    const { x, y } = clientToSvg(e.clientX, e.clientY);

    // Grabbing any device that's part of the current highlighted group (from
    // a marquee drag) instantly duplicates the WHOLE group, and the drag
    // that follows moves that new copy — no waiting, just highlight then
    // drag. The originals stay exactly where they were.
    if (multiSelected.has(id) && multiSelected.size > 1) {
      const idMap = new Map<string, string>();
      multiSelected.forEach((selId) => idMap.set(selId, uid("n")));
      const newPositions = new Map<string, { x: number; y: number }>();
      multiSelected.forEach((selId) => {
        const src = nodeById.get(selId);
        if (src) {
          addNode(src.type, src.x, src.y, idMap.get(selId));
          newPositions.set(idMap.get(selId)!, { x: src.x, y: src.y });
        }
      });
      const newIds = new Set(Array.from(idMap.values()));
      setMultiSelected(newIds);
      setSelected({ kind: "node", id: idMap.get(id)! });
      groupDragRef.current = { startX: x, startY: y, positions: newPositions };
      return;
    }

    // Normal single-device path — plain move, no copying. Also collapses
    // any stale multi-selection, since grabbing a device outside the
    // highlighted set starts a fresh single selection.
    setMultiSelected(new Set());
    setSelected({ kind: "node", id });
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
           tool === "text" ? "CLICK CANVAS TO PLACE NOTE (SUPPORTS MULTIPLE LINES)" :
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
          <span className="ml-auto">EDITING NOTE · ENTER FOR NEW LINE · CTRL+ENTER TO SAVE · ESC TO CANCEL</span>
        )}
      </div>

      {/* Import error banner — only shown after a failed "Open", dismissible
          so it doesn't linger once the person has read it. */}
      {importError && (
        <div className="px-3 py-1.5 border-b border-destructive/40 bg-destructive/10 font-mono text-[10px] tracking-[0.05em] text-destructive flex items-center gap-3">
          <span className="flex-1">COULDN'T OPEN FILE · {importError}</span>
          <button onClick={() => setImportError(null)} className="hover:underline shrink-0">DISMISS</button>
        </div>
      )}

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
            onDoubleClick={onSvgDoubleClick}
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
              const isMulti = multiSelected.has(n.id);
              return (
                <g key={n.id}>
                  <g transform={`translate(${n.x},${n.y})`}
                     style={{ cursor: tool === "connect" ? "cell" : "grab" }}
                     onPointerDown={onNodePointerDown(n.id)}
                     onDoubleClick={(e) => e.stopPropagation()}>
                    {/* Word-style highlight tint for devices caught inside a
                        marquee (rubber-band) selection. */}
                    {isMulti && (
                      <circle r={CHIP_R + 4} fill="var(--color-accent)" opacity={0.18} />
                    )}
                    <circle r={CHIP_R} fill="none"
                      stroke={isMulti ? "var(--color-accent)" : isConnFrom ? "var(--color-accent)" : isSel ? "var(--color-primary)" : "none"}
                      strokeWidth={isMulti || isSel || isConnFrom ? 1.8 : 1}
                      strokeDasharray={isMulti || isSel || isConnFrom ? "3 2" : undefined} />
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

            {/* Marquee (rubber-band) selection box — translucent while
                actively dragging, same visual language as highlighting text
                by dragging across it. */}
            {marquee && (
              <rect
                x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)}
                width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)}
                fill="var(--color-accent)" opacity={0.12}
                stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3 2"
                pointerEvents="none"
              />
            )}

            {/* Text labels — freeform notes, support multiple lines (VLAN
                tables, credentials, etc.), not just a single word. */}
            {layout.labels.map(l => {
              const isSel = selected?.kind === "label" && selected.id === l.id;
              const isEditing = editingLabelId === l.id;
              const box = computeLabelBox(isEditing ? draftText : l.text);
              return (
                <g key={l.id} transform={`translate(${l.x},${l.y})`}>
                  {isEditing ? (
                    <foreignObject x={-box.width / 2} y={-box.height / 2} width={box.width} height={box.height}>
                      <textarea
                        autoFocus
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          // Enter adds a new line, like a real note. Use
                          // Ctrl/Cmd+Enter to commit without leaving the
                          // keyboard, or click elsewhere / Escape.
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitLabelEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelLabelEdit(); }
                        }}
                        onBlur={() => commitLabelEdit()}
                        style={{
                          width: "100%", height: "100%", boxSizing: "border-box",
                          font: `700 ${LABEL_FONT_SIZE}px var(--font-mono)`, letterSpacing: "0.03em",
                          lineHeight: `${LABEL_LINE_HEIGHT}px`,
                          textAlign: "left", color: "var(--color-ink)",
                          background: "var(--color-background)",
                          border: "1.5px solid var(--color-primary)", outline: "none",
                          resize: "none", overflow: "hidden",
                          padding: "4px 6px",
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <g
                      style={{ cursor: tool === "connect" || typeof tool === "object" || tool === "text" ? cursorStyle : "grab" }}
                      onPointerDown={onLabelPointerDown(l.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); startEditingLabel(l.id); }}
                    >
                      <rect x={-box.width / 2} y={-box.height / 2} width={box.width} height={box.height}
                            rx={3}
                            fill="var(--color-background)"
                            fillOpacity={1}
                            stroke={isSel ? "var(--color-primary)" : "var(--color-border)"}
                            strokeWidth={isSel ? 1.4 : 1} strokeDasharray={isSel ? "3 2" : undefined} />
                      <text x={-box.width / 2 + LABEL_PAD_X_HALF} y={-box.height / 2 + LABEL_PAD_Y_HALF}
                            dominantBaseline="hanging"
                            fontFamily="var(--font-mono)" fontSize={LABEL_FONT_SIZE} fontWeight="700"
                            letterSpacing="0.03em" fill="var(--color-ink)">
                        {box.lines.map((line, i) => (
                          <tspan key={i} x={-box.width / 2 + LABEL_PAD_X_HALF} dy={i === 0 ? 0 : LABEL_LINE_HEIGHT}>
                            {line}
                          </tspan>
                        ))}
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
            title="Add a note (supports multiple lines — e.g. VLAN table, credentials)"
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
            disabled={!selected && multiSelected.size === 0}
            title="Delete selected (Del / Backspace)"
            className={
              "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 border rounded-sm transition-colors " +
              (selected || multiSelected.size > 0
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

          {/* Open — load a previously-exported .json topology file from disk,
              replacing the current canvas (after confirmation). Lives here
              inside the FILE menu below via the "Open…" item; kept close by
              since it drives that hidden input. */}

          {/* FILE menu — Open / Save / Save As / Print / Save as PDF / Save as DOCX,
              all in one place instead of a row of loose buttons. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="File options"
                className="font-mono text-[10px] tracking-[0.12em] px-3 py-1.5 border border-border hover:border-ink transition-colors rounded-sm"
              >
                {savedFlash ? "✓ SAVED" : "FILE"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="font-mono text-[11px] tracking-[0.04em]">
              <DropdownMenuItem
                onClick={() => {
                  if (confirm("Open a topology file? This will replace everything currently on the canvas.")) {
                    fileInputRef.current?.click();
                  }
                }}
              >
                Open…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSave}>
                Save
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToFile()}>
                Save As… (.json)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>
                Print…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSaveAsPdf} disabled={exporting !== null}>
                {exporting === "pdf" ? "Saving PDF…" : "Save as PDF"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSaveAsDocx} disabled={exporting !== null}>
                {exporting === "docx" ? "Saving DOCX…" : "Save as DOCX"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden file input driving "Open" — kept outside the visible
              button so the native file-picker chrome never shows through
              our styled toolbar. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file later
              if (!file) return;
              try {
                await importFromFile(file);
                setImportError(null);
              } catch (err) {
                setImportError(err instanceof Error ? err.message : "Couldn't open that file.");
              }
            }}
          />

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