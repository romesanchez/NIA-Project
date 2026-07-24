import type { Department, DeviceType } from "@/data/departments";

export const VB_W = 1000;
export const VB_H = 640;
export const PAD = 40;
export const LAYOUT_VERSION = 1;

export interface LNode { id: string; type: DeviceType; x: number; y: number }
export interface LWall { id: string; x: number; y: number; w: number; h: number; label: string }
/** A door opening cut into one side of a room's wall. `side` is which edge
 * of the wall rect it sits on, `t` is where along that edge (0..1 from the
 * edge's start corner), and `width` is the opening's width in layout units. */
export interface LDoor { id: string; wallId: string; side: "N" | "S" | "E" | "W"; t: number; width: number }
/** Freeform text annotation — a label the user can drop anywhere on a canvas
 * to identify a rack, room, segment, VLAN, etc. Not tied to any device. */
export interface LLabel { id: string; x: number; y: number; text: string }

/** Physical/logical medium of a connection. */
export type ConnType = "STRAIGHT" | "CROSSOVER" | "FIBER" | "SERIAL" | "USB" | "WIRELESS";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
export interface LConn { id: string; from: string; to: string; connType?: ConnType }
export interface Layout { version: number; nodes: LNode[]; walls: LWall[]; doors: LDoor[]; connections: LConn[] }

export const CONN_TYPE_LABELS: Record<ConnType, string> = {
  STRAIGHT:  "Straight-Through",
  CROSSOVER: "Crossover",
  FIBER:     "Fiber Optic",
  SERIAL:    "Serial DCE/DTE",
  USB:       "USB Cable",
  WIRELESS:  "Wireless",
};

/** Visual styling for each connector medium. Wireless links are NOT routed
 * along walls like a physical cable — they're drawn as a short straight,
 * faint dotted hop, the way wireless coverage is usually sketched. */
export function connectorStyle(type: ConnType | undefined) {
  switch (type) {
    case "CROSSOVER":
      return { stroke: "#e8a020", dash: "6 3", width: 1.4, routed: true, cap: "butt" as const, opacity: 1 };
    case "FIBER":
      return { stroke: "#00bcd4", dash: undefined as string | undefined, width: 2, routed: true, cap: "round" as const, opacity: 1 };
    case "SERIAL":
      return { stroke: "#9c27b0", dash: "2 2", width: 1.6, routed: true, cap: "square" as const, opacity: 1 };
    case "USB":
      return { stroke: "var(--color-accent)", dash: "1 3", width: 1.4, routed: true, cap: "round" as const, opacity: 1 };
    case "WIRELESS":
      return { stroke: "var(--color-muted-foreground)", dash: "0.5 4", width: 1.2, routed: false, cap: "round" as const, opacity: 0.75 };
    case "STRAIGHT":
    default:
      return { stroke: "var(--color-primary)", dash: undefined as string | undefined, width: 1.6, routed: true, cap: "butt" as const, opacity: 1 };
  }
}

/**
 * Deterministic 0/1 "variant" derived from a connection id — decides whether
 * an elbow connector turns horizontal-first or vertical-first, so cable runs
 * on the same floor plan don't all bend the same way and stack on top of
 * each other.
 */
export function elbowVariant(id: string): 0 | 1 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1) as 0 | 1;
}

/**
 * Builds an orthogonal "L" (or "Z" when perfectly straight isn't possible)
 * cable path between two device positions, with a small rounded corner —
 * the way a real floor-plan cable run turns at a right angle instead of
 * cutting diagonally through walls.
 */
export function elbowPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  variant: 0 | 1 = 0,
  radius = 9,
): string {
  // Already straight (same row/column) — no turn needed.
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const corner = variant === 0 ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  const d1x = corner.x - a.x, d1y = corner.y - a.y;
  const d2x = b.x - corner.x, d2y = b.y - corner.y;
  const len1 = Math.hypot(d1x, d1y) || 1;
  const len2 = Math.hypot(d2x, d2y) || 1;
  const r = Math.min(radius, len1 / 2, len2 / 2);
  const p1 = { x: corner.x - (d1x / len1) * r, y: corner.y - (d1y / len1) * r };
  const p2 = { x: corner.x + (d2x / len2) * r, y: corner.y + (d2y / len2) * r };
  return `M ${a.x} ${a.y} L ${p1.x} ${p1.y} Q ${corner.x} ${corner.y} ${p2.x} ${p2.y} L ${b.x} ${b.y}`;
}

const ROOM_NAMES = [
  "OPEN OFFICE", "WORKSTATIONS", "MEETING", "SERVER RM", "STORAGE",
  "LOBBY", "OPS FLOOR", "LAB", "ARCHIVE", "BREAK RM",
];

function seedFrom(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

interface Rect { x: number; y: number; w: number; h: number }
function subdivide(r: Rect, n: number, rand: () => number): Rect[] {
  if (n <= 1) return [r];
  const vert = r.w >= r.h;
  const ratio = 0.35 + rand() * 0.3;
  const left = Math.max(1, Math.round(n / 2));
  const right = n - left;
  if (vert) {
    const sw = Math.round(r.w * ratio);
    return [
      ...subdivide({ x: r.x, y: r.y, w: sw, h: r.h }, left, rand),
      ...subdivide({ x: r.x + sw, y: r.y, w: r.w - sw, h: r.h }, right, rand),
    ];
  }
  const sh = Math.round(r.h * ratio);
  return [
    ...subdivide({ x: r.x, y: r.y, w: r.w, h: sh }, left, rand),
    ...subdivide({ x: r.x, y: r.y + sh, w: r.w, h: r.h - sh }, right, rand),
  ];
}

export function generateInitialLayout(dept: Department): Layout {
  const rand = seedFrom(dept.acronym);
  const innerW = VB_W - PAD * 2;
  const innerH = VB_H - PAD * 2;
  const flat: DeviceType[] = (Object.entries(dept.devices) as [DeviceType, number][])
    .flatMap(([t, c]) => Array.from({ length: c }, () => t));
  const roomCount = Math.max(3, Math.min(7, Math.round(flat.length / 6) + 2));
  const rects = subdivide({ x: PAD, y: PAD, w: innerW, h: innerH }, roomCount, rand);
  const labels = [...ROOM_NAMES].sort(() => rand() - 0.5);
  const walls: LWall[] = rects.map((r, i) => ({ id: uid("w"), ...r, label: labels[i % labels.length] }));

  const nodes: LNode[] = [];
  const fill: number[] = walls.map(() => 0);
  flat.forEach((t, idx) => {
    const wi = idx % walls.length;
    const w = walls[wi];
    const used = fill[wi]++;
    const cols = Math.max(2, Math.floor(w.w / 34));
    const cx = w.x + 18 + (used % cols) * ((w.w - 36) / Math.max(1, cols - 1));
    const cy = w.y + 24 + Math.floor(used / cols) * 26;
    nodes.push({
      id: uid("n"),
      type: t,
      x: Math.min(cx, w.x + w.w - 14),
      y: Math.min(cy, w.y + w.h - 14),
    });
  });

  // Give every room a door on whichever side has the most clearance, so
  // freshly generated floor plans already read as walkable rooms.
  const doors: LDoor[] = walls.map(w => {
    const wider = w.w >= w.h;
    const side: LDoor["side"] = wider ? "S" : "E";
    return { id: uid("d"), wallId: w.id, side, t: 0.5, width: Math.min(46, (wider ? w.w : w.h) * 0.3) };
  });

  const connections: LConn[] = [];
  const WIRELESS_CAPABLE: DeviceType[] = ["AP", "LAPTOP", "SMARTPHONE", "WEBCAM"];
  const hubs = nodes.filter(n => n.type === "SWITCH" || n.type === "ROUTER");
  const leaves = nodes.filter(n => !hubs.includes(n));
  hubs.forEach(h => {
    leaves
      .slice()
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
      .slice(0, 3)
      .forEach(l => {
        const connType: ConnType =
          h.type === "ROUTER" && WIRELESS_CAPABLE.includes(l.type) ? "WIRELESS" : "STRAIGHT";
        connections.push({ id: uid("c"), from: h.id, to: l.id, connType });
      });
  });

  return { version: LAYOUT_VERSION, nodes, walls, doors, connections };
}

const KEY = (acr: string) => `nia-layout:v1:${acr}`;
const listeners = new Map<string, Set<() => void>>();

export function loadLayout(dept: Department): Layout {
  if (typeof window === "undefined") return generateInitialLayout(dept);
  try {
    const raw = window.localStorage.getItem(KEY(dept.acronym));
    if (raw) {
      const p = JSON.parse(raw) as Layout;
      // `doors` is a newer field — default it for layouts saved before it
      // existed instead of forcing a full regeneration.
      if (p && p.version === LAYOUT_VERSION) return { ...p, doors: p.doors ?? [] };
    }
  } catch { /* noop */ }
  return generateInitialLayout(dept);
}

export function saveLayout(dept: Department, l: Layout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(dept.acronym), JSON.stringify(l));
    listeners.get(dept.acronym)?.forEach(fn => fn());
  } catch { /* noop */ }
}

export function subscribeLayout(acronym: string, cb: () => void): () => void {
  let set = listeners.get(acronym);
  if (!set) { set = new Set(); listeners.set(acronym, set); }
  set.add(cb);
  return () => { set!.delete(cb); };
}

export function clearLayout(dept: Department) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(dept.acronym));
  listeners.get(dept.acronym)?.forEach(fn => fn());
}