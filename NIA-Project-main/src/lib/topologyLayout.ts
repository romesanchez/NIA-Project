import type { Department, DeviceType } from "@/data/departments";
import { ConnType, LConn, LLabel, LNode, uid } from "@/lib/deptLayout";

/**
 * The topology canvas is intentionally separate from the floor-plan canvas —
 * it's a schematic (Packet Tracer / GNS3 style) diagram of devices and
 * links, not a scaled drawing of a room. Moving a device here never touches
 * the floor plan, and vice versa.
 *
 * The canvas is deliberately much bigger than any single viewport — like
 * Packet Tracer's workspace, it scrolls instead of squeezing/stretching
 * everything to fit whatever window size happens to be open.
 */
export const TOPO_VB_W = 3000;
export const TOPO_VB_H = 1800;
export const TOPO_PAD = 60;
export const TOPO_LAYOUT_VERSION = 1;

export interface TopoLayout {
  version: number;
  nodes: LNode[];
  connections: LConn[];
  labels: LLabel[];
}

/** Visual language for links on the schematic canvas — solid, direct
 * point-to-point "wires" the way Packet Tracer / GNS3 draw them, instead of
 * the elbowed cable-runs-along-a-wall look used on the floor plan. */
export function topologyConnectorStyle(type: ConnType | undefined) {
  switch (type) {
    case "CROSSOVER":
      return { stroke: "#e8a020", dash: "8 4" as string | undefined, width: 2, cap: "butt" as const, opacity: 1 };
    case "FIBER":
      return { stroke: "#00bcd4", dash: undefined as string | undefined, width: 2.5, cap: "round" as const, opacity: 1 };
    case "SERIAL":
      return { stroke: "#9c27b0", dash: "3 3" as string | undefined, width: 2, cap: "square" as const, opacity: 1 };
    case "USB":
      return { stroke: "var(--color-accent)", dash: "2 4" as string | undefined, width: 1.8, cap: "round" as const, opacity: 0.95 };
    case "WIRELESS":
      return { stroke: "var(--color-muted-foreground)", dash: "1 4" as string | undefined, width: 1.4, cap: "round" as const, opacity: 0.8 };
    case "STRAIGHT":
    default:
      return { stroke: "var(--color-primary)", dash: undefined as string | undefined, width: 2, cap: "round" as const, opacity: 0.95 };
  }
}
const HUB_TYPES: DeviceType[] = ["SWITCH", "ROUTER", "CONTROLLER"];

/**
 * Deterministic hub-and-spoke schematic: hubs (switches/routers/controllers)
 * sit in a row across the top, their leaf devices fan out in ranks beneath
 * them — the classic "network diagram" reading order, top (core) to bottom
 * (endpoints).
 */
export function generateInitialTopology(dept: Department): TopoLayout {
  const flat: DeviceType[] = (Object.entries(dept.devices) as [DeviceType, number][])
    .flatMap(([t, c]) => Array.from({ length: c }, () => t));

  if (flat.length === 0) {
    return { version: TOPO_LAYOUT_VERSION, nodes: [], connections: [], labels: [] };
  }

  const hubTypes = flat.filter((t) => HUB_TYPES.includes(t));
  const leafTypes = flat.filter((t) => !HUB_TYPES.includes(t));

  const innerW = TOPO_VB_W - TOPO_PAD * 2;
  const hubY = TOPO_PAD + 70;

  const hubs: LNode[] = hubTypes.map((t, i) => ({
    id: uid("n"),
    type: t,
    x: TOPO_PAD + ((i + 1) * innerW) / (hubTypes.length + 1),
    y: hubY,
  }));

  // No hubs at all (rare — e.g. a shell department) → simple centered grid.
  if (hubs.length === 0) {
    const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(leafTypes.length))));
    const nodes: LNode[] = leafTypes.map((t, i) => ({
      id: uid("n"),
      type: t,
      x: TOPO_PAD + 60 + (i % cols) * ((innerW - 120) / Math.max(1, cols - 1 || 1)),
      y: TOPO_PAD + 60 + Math.floor(i / cols) * 100,
    }));
    return { version: TOPO_LAYOUT_VERSION, nodes, connections: [], labels: [] };
  }

  // Distribute leaves round-robin across hubs so each hub's fan-out is even.
  const perHub: DeviceType[][] = hubs.map(() => []);
  leafTypes.forEach((t, i) => perHub[i % hubs.length].push(t));

  const nodes: LNode[] = [...hubs];
  const connections: LConn[] = [];
  const rowGap = 92;
  const maxPerRow = 5;

  hubs.forEach((hub, hi) => {
    const leaves = perHub[hi];
    // Give this hub a horizontal lane roughly centered under it, sized to
    // its share of the canvas so lanes for different hubs don't collide.
    const laneW = innerW / hubs.length;
    const laneX = TOPO_PAD + hi * laneW;
    leaves.forEach((t, li) => {
      const row = Math.floor(li / maxPerRow);
      const rowItems = Math.min(maxPerRow, leaves.length - row * maxPerRow);
      const col = li % maxPerRow;
      const cellW = laneW / Math.max(1, rowItems);
      const x = Math.min(
        TOPO_VB_W - TOPO_PAD - 20,
        Math.max(TOPO_PAD + 20, laneX + cellW * (col + 0.5)),
      );
      const y = hubY + 130 + row * rowGap;
      const node: LNode = { id: uid("n"), type: t, x, y };
      nodes.push(node);
      const connType: ConnType =
        hub.type === "ROUTER" && ["AP", "LAPTOP", "SMARTPHONE", "WEBCAM"].includes(t) ? "WIRELESS" : "STRAIGHT"
      connections.push({ id: uid("c"), from: hub.id, to: node.id, connType });
    });
  });

  // Chain the hubs themselves together (core/distribution backbone).
  for (let i = 0; i < hubs.length - 1; i++) {
    connections.push({ id: uid("c"), from: hubs[i].id, to: hubs[i + 1].id, connType: "STRAIGHT" });
  }

  return { version: TOPO_LAYOUT_VERSION, nodes, connections, labels: [] };
}

const KEY = (acr: string) => `nia-topology:v1:${acr}`;
const listeners = new Map<string, Set<() => void>>();

export function loadTopology(dept: Department): TopoLayout {
  if (typeof window === "undefined") return generateInitialTopology(dept);
  try {
    const raw = window.localStorage.getItem(KEY(dept.acronym));
    if (raw) {
      const p = JSON.parse(raw) as TopoLayout;
      // `labels` was added after this key started shipping — backfill it so
      // topologies saved before the text-label feature still load cleanly.
      if (p && p.version === TOPO_LAYOUT_VERSION) return { ...p, labels: p.labels ?? [] };
    }
  } catch { /* noop */ }
  return generateInitialTopology(dept);
}

export function saveTopology(dept: Department, l: TopoLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(dept.acronym), JSON.stringify(l));
    listeners.get(dept.acronym)?.forEach((fn) => fn());
  } catch { /* noop */ }
}

export function subscribeTopology(acronym: string, cb: () => void): () => void {
  let set = listeners.get(acronym);
  if (!set) { set = new Set(); listeners.set(acronym, set); }
  set.add(cb);
  return () => { set!.delete(cb); };
}

export function clearTopology(dept: Department) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(dept.acronym));
  listeners.get(dept.acronym)?.forEach((fn) => fn());
}

/** On-disk shape of an exported topology file — the layout itself plus a
 * little metadata so an imported file can be sanity-checked (right app,
 * right department, not corrupted) before it overwrites the canvas. */
export interface TopologyFile {
  kind: "nia-topology";
  fileVersion: 1;
  deptAcronym: string;
  deptName: string;
  exportedAt: string;
  layout: TopoLayout;
}

function safeFileNamePart(s: string): string {
  return s.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "topology";
}

/**
 * "Save As" — packages the current topology into a downloadable .json file,
 * the same way Packet Tracer writes a .pkt to disk. Triggers a normal
 * browser download; nothing is sent over the network.
 */
export function exportTopologyFile(dept: Department, layout: TopoLayout) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const file: TopologyFile = {
    kind: "nia-topology",
    fileVersion: 1,
    deptAcronym: dept.acronym,
    deptName: dept.name,
    exportedAt: new Date().toISOString(),
    layout,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileNamePart(dept.acronym)}-topology-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Errors thrown by {@link parseTopologyFile}, distinguishable from a plain
 * parse failure so the UI can show a clearer message. */
export class TopologyFileError extends Error {}

/**
 * "Open" — parses a previously-exported file back into a TopoLayout. Throws
 * TopologyFileError with a human-readable reason on anything malformed, so
 * the caller can surface it instead of silently wiping the canvas.
 */
export function parseTopologyFile(raw: string, expectedAcronym?: string): TopoLayout {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TopologyFileError("That file isn't valid JSON.");
  }
  if (!data || typeof data !== "object") {
    throw new TopologyFileError("That file doesn't look like a topology export.");
  }
  const d = data as Partial<TopologyFile> & { layout?: Partial<TopoLayout> };
  if (d.kind !== "nia-topology" || !d.layout) {
    throw new TopologyFileError("That file doesn't look like a topology export.");
  }
  if (expectedAcronym && d.deptAcronym && d.deptAcronym !== expectedAcronym) {
    throw new TopologyFileError(
      `This file was exported from "${d.deptAcronym}", not "${expectedAcronym}". Open it from that department instead.`,
    );
  }
  const l = d.layout;
  if (!Array.isArray(l.nodes) || !Array.isArray(l.connections)) {
    throw new TopologyFileError("This file is missing required topology data.");
  }
  return {
    version: TOPO_LAYOUT_VERSION,
    nodes: l.nodes,
    connections: l.connections,
    labels: Array.isArray(l.labels) ? l.labels : [],
  };
}