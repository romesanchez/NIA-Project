import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Department, DeviceType } from "@/data/departments";
import { useDeptLayout } from "@/hooks/useDeptLayout";
import { VB_H, VB_W, LNode, LWall, LDoor } from "@/lib/deptLayout";
import { DEVICE_LABELS } from "./DeviceGlyph";

interface Props {
  dept: (Department & { groupLabel: string; index: number }) | null;
  origin: { x: number; y: number } | null;
  onClose: () => void;
  /** Presentation/viewer mode: no toolbar, no drag/select/place/connect —
      just camera orbit and zoom. Defaults to false (full editor) so
      existing callers that don't pass it keep today's behavior. */
  readOnly?: boolean;
}

const DEVICE_TYPES: DeviceType[] = ["PC", "SERVER", "SWITCH", "ROUTER", "PRINTER", "AP", "WEBCAM", "LAPTOP", "SMARTPHONE", "MEDIACONVERTER", "CONTROLLER"];

const DEVICE_COLORS: Record<DeviceType, string> = {
  PC: "#22c55e", SERVER: "#16213e", SWITCH: "#f2f3f5", ROUTER: "#f2f3f5",
  PRINTER: "#8bb4a0", AP: "#22c55e",
  WEBCAM: "#5a8a72", LAPTOP: "#c4c8cc", SMARTPHONE: "#a3d9b8",
  MEDIACONVERTER: "#f2f3f5", CONTROLLER: "#16213e",
};

const WORLD_W = 16;
const WORLD_D = 10;
// Layout (VB_W x VB_H) <-> world unit conversion factors, reused by the
// room/door editing geometry below.
const SCALE_X = WORLD_W / VB_W;
const SCALE_Z = WORLD_D / VB_H;
const layoutToWorld = (x: number, y: number): [number, number, number] => [
  ((x - VB_W / 2) / VB_W) * WORLD_W,
  0,
  ((y - VB_H / 2) / VB_H) * WORLD_D,
];
const worldToLayout = (x: number, z: number): [number, number] => [
  x / WORLD_W * VB_W + VB_W / 2,
  z / WORLD_D * VB_H + VB_H / 2,
];

type Tool3D = "select" | "connect" | { kind: "place"; type: DeviceType } | "room" | "door";
const MODEL_PATHS: Partial<Record<DeviceType, string>> = {
  SERVER: "/models/server.glb",
  CONTROLLER: "/models/server.glb",
  ROUTER: "/models/router.glb",
  SWITCH: "/models/router.glb",
  MEDIACONVERTER: "/models/router.glb",
  LAPTOP: "/models/laptop.glb",
  PC: "/models/pc.glb",
  PRINTER: "/models/printer.glb",
  AP: "/models/ap.glb",
  WEBCAM: "/models/webcam.glb",
  SMARTPHONE: "/models/smartphone.glb",
};

function GLTFDevice({ path, scale = 1 }: { path: string; scale?: number }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} scale={scale} />;
}

Object.values(MODEL_PATHS).forEach((p) => p && useGLTF.preload(p));

// Proper React error boundary — a plain try/catch around JSX cannot catch
// errors thrown by hooks (like useGLTF) during render/suspense resolution.
// Without this, a missing/broken .glb file throws an UNCAUGHT error that
// can crash the whole <Canvas>, which is why the 3D view can go blank.
class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("3D model failed to load, using fallback mesh:", error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function DeviceMesh({ type }: { type: DeviceType }) {
  const color = DEVICE_COLORS[type];
  const modelPath = MODEL_PATHS[type];

  if (modelPath) {
    return (
      <ModelErrorBoundary fallback={<FallbackMesh type={type} color={color} />}>
        <Suspense fallback={<FallbackMesh type={type} color={color} />}>
          <GLTFDevice path={modelPath} scale={0.3} />
        </Suspense>
      </ModelErrorBoundary>
    );
  }
  return <FallbackMesh type={type} color={color} />;
}

// Three concentric rings that expand and fade outward from the AP, like a
// wifi/radar broadcast pulse — a quick visual cue that this device talks
// over the air instead of through a cable.
function APWifiRings() {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.forEach((ref, i) => {
      const mesh = ref.current;
      if (!mesh) return;
      const phase = (t * 0.4 + i * 0.333) % 1;
      const scale = 0.5 + phase * 2.2;
      mesh.scale.set(scale, scale, scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.55 * (1 - phase));
    });
  });
  return (
    <>
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.245, 32]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function FallbackMesh({ type, color }: { type: DeviceType; color: string }) {
  switch (type) {
    case "PC":
      return (
        <group>
          {/* monitor stand */}
          <mesh position={[0, 0.32, -0.15]}><boxGeometry args={[0.04, 0.14, 0.04]} /><meshStandardMaterial color="#2b2b35" /></mesh>
          <mesh position={[0, 0.26, -0.15]}><boxGeometry args={[0.22, 0.02, 0.14]} /><meshStandardMaterial color="#2b2b35" /></mesh>
          <mesh position={[0, 0.5, -0.16]}><boxGeometry args={[0.48, 0.32, 0.03]} /><meshStandardMaterial color="#1d1d26" /></mesh>
          {/* screen: windows-style desktop instead of a flat green panel */}
          <mesh position={[0, 0.5, -0.144]}><boxGeometry args={[0.42, 0.26, 0.005]} /><meshStandardMaterial color="#0a2647" emissive="#1668c1" emissiveIntensity={0.55} /></mesh>
          {/* taskbar */}
          <mesh position={[0, 0.384, -0.1436]}><boxGeometry args={[0.42, 0.028, 0.002]} /><meshStandardMaterial color="#111318" emissive="#111318" emissiveIntensity={0.3} /></mesh>
          <mesh position={[-0.18, 0.384, -0.1437]}><boxGeometry args={[0.035, 0.022, 0.002]} /><meshStandardMaterial color="#4cc2ff" emissive="#4cc2ff" emissiveIntensity={1.4} /></mesh>
          {/* desktop icons */}
          <mesh position={[-0.17, 0.6, -0.1437]}><boxGeometry args={[0.022, 0.02, 0.002]} /><meshStandardMaterial color="#dceeff" emissive="#dceeff" emissiveIntensity={0.5} /></mesh>
          <mesh position={[-0.17, 0.55, -0.1437]}><boxGeometry args={[0.022, 0.02, 0.002]} /><meshStandardMaterial color="#dceeff" emissive="#dceeff" emissiveIntensity={0.5} /></mesh>
          {/* tower */}
          <mesh position={[0.32, 0.17, 0]}><boxGeometry args={[0.16, 0.34, 0.4]} /><meshStandardMaterial color="#2b2b35" /></mesh>
          <mesh position={[0.32, 0.3, 0.205]}><boxGeometry args={[0.02, 0.02, 0.01]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} /></mesh>

          {/* desk under the monitor */}
          <mesh position={[-0.1, 0.235, 0]}><boxGeometry args={[0.6, 0.03, 0.6]} /><meshStandardMaterial color="#b98a52" /></mesh>
          {[[0.17, -0.27], [0.17, 0.27], [-0.37, -0.27], [-0.37, 0.27]].map(([lx, lz], i) => (
            <mesh key={`desk-leg-${i}`} position={[lx, 0.11, lz]}><boxGeometry args={[0.03, 0.22, 0.03]} /><meshStandardMaterial color="#2d2d33" /></mesh>
          ))}

          {/* chair facing the monitor */}
          <mesh position={[-0.1, 0.2, 0.55]}><boxGeometry args={[0.28, 0.03, 0.28]} /><meshStandardMaterial color="#3f3f46" /></mesh>
          <mesh position={[-0.1, 0.35, 0.68]}><boxGeometry args={[0.28, 0.3, 0.03]} /><meshStandardMaterial color="#3f3f46" /></mesh>
          {[[-0.22, 0.43], [-0.22, 0.67], [0.02, 0.43], [0.02, 0.67]].map(([lx, lz], i) => (
            <mesh key={`chair-leg-${i}`} position={[lx, 0.0925, lz]}><boxGeometry args={[0.025, 0.185, 0.025]} /><meshStandardMaterial color="#26262b" /></mesh>
          ))}
        </group>
      );
    case "SMARTPHONE":
      return (
        <group>
          <mesh position={[0, 0.25, 0]}><boxGeometry args={[0.18, 0.4, 0.035]} /><meshStandardMaterial color="#1d1d26" /></mesh>
          <mesh position={[0, 0.25, 0.019]}><boxGeometry args={[0.15, 0.35, 0.005]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} /></mesh>
          <mesh position={[0, 0.44, 0.02]}><circleGeometry args={[0.01, 12]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
        </group>
      );
    case "LAPTOP":
      return (
        <group>
          <mesh position={[0, 0.05, 0.12]}><boxGeometry args={[0.55, 0.04, 0.38]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 0.075, 0.2]}><boxGeometry args={[0.15, 0.005, 0.1]} /><meshStandardMaterial color="#9aa0a6" /></mesh>
          <mesh position={[0, 0.27, -0.06]} rotation={[-0.35, 0, 0]}><boxGeometry args={[0.55, 0.35, 0.02]} /><meshStandardMaterial color="#dcdfe2" /></mesh>
          <mesh position={[0, 0.27, -0.045]} rotation={[-0.35, 0, 0]}><boxGeometry args={[0.48, 0.28, 0.005]} /><meshStandardMaterial color="#1a1a2e" emissive="#4f46e5" emissiveIntensity={0.6} /></mesh>
        </group>
      );
    case "SERVER":
    case "CONTROLLER":
      return (
        <group>
          <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.5, 1, 0.5]} /><meshStandardMaterial color={color} /></mesh>
          {[-0.15, -0.05, 0.05, 0.15].map((vx, i) => (
            <mesh key={i} position={[vx, 1.005, -0.1]}><boxGeometry args={[0.03, 0.02, 0.2]} /><meshStandardMaterial color="#0a0f1e" /></mesh>
          ))}
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((uy, i) => (
            <group key={i} position={[0, uy, 0.255]}>
              <mesh><boxGeometry args={[0.44, 0.1, 0.01]} /><meshStandardMaterial color="#0d1b2a" /></mesh>
              <mesh position={[-0.16, 0, 0.006]}><boxGeometry args={[0.03, 0.03, 0.005]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} /></mesh>
            </group>
          ))}
        </group>
      );
    case "SWITCH":
      return (
        <group>
          {/* metal chassis */}
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.8, 0.22, 0.42]} /><meshStandardMaterial color="#26282e" metalness={0.5} roughness={0.45} /></mesh>
          {/* front face plate, slightly recessed */}
          <mesh position={[0, 0.11, 0.19]}><boxGeometry args={[0.78, 0.16, 0.02]} /><meshStandardMaterial color="#1a1b20" metalness={0.4} roughness={0.5} /></mesh>
          {/* generic brand accent stripe — not a reproduced third-party logo */}
          <mesh position={[0, 0.205, 0.201]}><boxGeometry args={[0.8, 0.018, 0.004]} /><meshStandardMaterial color="#7ac943" emissive="#7ac943" emissiveIntensity={0.35} /></mesh>
          {/* blank label plate */}
          <mesh position={[-0.31, 0.205, 0.201]}><boxGeometry args={[0.13, 0.05, 0.003]} /><meshStandardMaterial color="#e9ebee" /></mesh>
          {/* RJ45 port bank with per-port link/activity LEDs */}
          {Array.from({ length: 8 }).map((_, i) => (
            <group key={i} position={[-0.31 + i * 0.088, 0.1, 0.2]}>
              <mesh><boxGeometry args={[0.06, 0.05, 0.03]} /><meshStandardMaterial color="#0c0d10" /></mesh>
              <mesh position={[-0.015, 0.033, 0.012]}>
                <boxGeometry args={[0.012, 0.008, 0.004]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} />
              </mesh>
              <mesh position={[0.015, 0.033, 0.012]}>
                <boxGeometry args={[0.012, 0.008, 0.004]} />
                <meshStandardMaterial color={i % 3 === 0 ? "#facc15" : "#3b3f46"} emissive={i % 3 === 0 ? "#facc15" : "#000000"} emissiveIntensity={i % 3 === 0 ? 1.4 : 0} />
              </mesh>
            </group>
          ))}
          {/* side vents */}
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={`vent-${i}`} position={[0.29, 0.12, -0.12 + i * 0.06]}>
              <boxGeometry args={[0.02, 0.14, 0.012]} />
              <meshStandardMaterial color="#0d0e11" />
            </mesh>
          ))}
        </group>
      );
    case "MEDIACONVERTER":
    case "ROUTER":
      return (
        <group>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.8, 0.2, 0.45]} /><meshStandardMaterial color={color} /></mesh>
          {Array.from({ length: 8 }).map((_, i) => {
            const ledColors = ["#facc15", "#22c55e", "#3b82f6", "#a855f7"];
            const c = ledColors[i % ledColors.length];
            return <mesh key={i} position={[-0.32 + i * 0.09, 0.14, 0.2]}><boxGeometry args={[0.04, 0.02, 0.02]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.5} /></mesh>;
          })}
        </group>
      );
    case "PRINTER":
      return (
        <group>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.7, 0.32, 0.5]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 0.36, 0.02]}><boxGeometry args={[0.5, 0.04, 0.4]} /><meshStandardMaterial color="#e8ece9" /></mesh>
          <mesh position={[0.22, 0.36, 0.2]}><boxGeometry args={[0.04, 0.01, 0.04]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={1.5} /></mesh>
          <mesh position={[0, 0.05, 0.26]}><boxGeometry args={[0.55, 0.02, 0.02]} /><meshStandardMaterial color="#0d1b2a" /></mesh>
        </group>
      );
    case "AP":
      return (
        <group>
          {/* flush mounting plate — sits directly on the ceiling/wall, no cable stub */}
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.22, 28]} /><meshStandardMaterial color="#e7e9ec" /></mesh>
          {/* rounded body */}
          <mesh position={[0, 0.075, 0]}><cylinderGeometry args={[0.19, 0.21, 0.09, 28]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.19, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {/* status LED */}
          <mesh position={[0, 0.155, 0]}><sphereGeometry args={[0.018, 10, 10]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} /></mesh>
          {/* animated wifi rings broadcasting outward — makes the connection read as wireless */}
          <APWifiRings />
        </group>
      );
    case "WEBCAM":
      return (
        <group>
          <mesh position={[0, 0.28, 0]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color="#1d1d26" /></mesh>
          <mesh position={[0, 0.28, 0.1]}><circleGeometry args={[0.07, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} /></mesh>
          <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.06, 0.16, 0.04]} /><meshStandardMaterial color="#1d1d26" /></mesh>
          <mesh position={[0.09, 0.35, 0.06]}><sphereGeometry args={[0.015, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} /></mesh>
        </group>
      );
    default:
      return null;
  }
}

function EditableDevice({
  node, onMove, onSelectPointer, isSelected, isConnectFrom, setOrbitEnabled, connectMode, locked = false,
}: {
  node: LNode;
  onMove: (x: number, y: number) => void;
  onSelectPointer: () => void;
  isSelected: boolean;
  isConnectFrom: boolean;
  setOrbitEnabled: (v: boolean) => void;
  connectMode: boolean;
  locked?: boolean;
}) {
  const [pos, setPos] = useState<[number, number, number]>(() => layoutToWorld(node.x, node.y));
  const dragging = useRef(false);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const moved = useRef(false);

  useEffect(() => setPos(layoutToWorld(node.x, node.y)), [node.x, node.y]);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (connectMode) { onSelectPointer(); return; }
    dragging.current = true; moved.current = false;
    setOrbitEnabled(false);
  };
  const onMovePtr = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    setPos([hit.x, 0, hit.z]);
    moved.current = true;
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setOrbitEnabled(true);
    if (moved.current) {
      const [nx, ny] = worldToLayout(pos[0], pos[2]);
      onMove(nx, ny);
    } else {
      onSelectPointer();
    }
    e.stopPropagation();
  };

  // Read-only viewer mode: don't attach any pointer handlers at all, so a
  // click on a device just passes straight through to OrbitControls (rotate
  // the camera) exactly like clicking empty space would — no drag, no
  // selection ring, nothing to accidentally rearrange.
  return (
    <group
      position={pos}
      onPointerDown={locked ? undefined : onDown}
      onPointerMove={locked ? undefined : onMovePtr}
      onPointerUp={locked ? undefined : onUp}
      onPointerCancel={locked ? undefined : onUp}
    >
      {(isSelected || isConnectFrom) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial color={isConnectFrom ? "#facc15" : "#22c55e"} />
        </mesh>
      )}
      <DeviceMesh type={node.type} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Obstacle-aware cable routing.
// Instead of a fixed jog pattern, wires are routed on a coarse grid using
// A* pathfinding, treating every OTHER device's footprint as a blocked
// region. This means a cable automatically re-routes around whatever
// devices happen to be sitting between its two endpoints, no matter where
// the person drags them.
// ---------------------------------------------------------------------------

const GRID_COLS = 48;
const GRID_ROWS = 30;
const CELL_W = WORLD_W / GRID_COLS;
const CELL_D = WORLD_D / GRID_ROWS;
const CABLE_GROUND_Y = 0.06;

function worldToCell(x: number, z: number): [number, number] {
  const col = Math.round((x + WORLD_W / 2) / CELL_W);
  const row = Math.round((z + WORLD_D / 2) / CELL_D);
  return [
    Math.min(Math.max(col, 0), GRID_COLS - 1),
    Math.min(Math.max(row, 0), GRID_ROWS - 1),
  ];
}
function cellToWorld(col: number, row: number): [number, number] {
  return [col * CELL_W - WORLD_W / 2, row * CELL_D - WORLD_D / 2];
}

function buildObstacleGrid(nodes: LNode[], excludeIds: Set<string>, clearanceCells = 1): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
  for (const n of nodes) {
    if (excludeIds.has(n.id)) continue;
    const [wx, , wz] = layoutToWorld(n.x, n.y);
    const [col, row] = worldToCell(wx, wz);
    for (let dr = -clearanceCells; dr <= clearanceCells; dr++) {
      for (let dc = -clearanceCells; dc <= clearanceCells; dc++) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) grid[r][c] = true;
      }
    }
  }
  return grid;
}

type AStarNode = { c: number; r: number; g: number; f: number; parent: string | null };

function aStarPath(grid: boolean[][], start: [number, number], goal: [number, number]): [number, number][] | null {
  const key = (c: number, r: number) => `${c},${r}`;
  const [sc, sr] = start;
  const [gc, gr] = goal;
  const heuristic = (c1: number, r1: number, c2: number, r2: number) => Math.abs(c1 - c2) + Math.abs(r1 - r2);

  const open = new Map<string, AStarNode>();
  const closed = new Set<string>();
  const startKey = key(sc, sr);
  open.set(startKey, { c: sc, r: sr, g: 0, f: heuristic(sc, sr, gc, gr), parent: null });
  const frontier: string[] = [startKey];

  const maxIterations = GRID_COLS * GRID_ROWS * 4;
  let iterations = 0;

  while (frontier.length > 0 && iterations < maxIterations) {
    iterations++;
    let bestIdx = 0;
    let bestF = Infinity;
    for (let i = 0; i < frontier.length; i++) {
      const node = open.get(frontier[i])!;
      if (node.f < bestF) { bestF = node.f; bestIdx = i; }
    }
    const currentKey = frontier.splice(bestIdx, 1)[0];
    const current = open.get(currentKey)!;

    if (current.c === gc && current.r === gr) {
      const path: [number, number][] = [];
      let k: string | null = currentKey;
      while (k) {
        const node = open.get(k)!;
        path.push([node.c, node.r]);
        k = node.parent;
      }
      path.reverse();
      return path;
    }
    closed.add(currentKey);

    const neighbors: [number, number][] = [
      [current.c + 1, current.r], [current.c - 1, current.r],
      [current.c, current.r + 1], [current.c, current.r - 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
      const nKey = key(nc, nr);
      if (closed.has(nKey)) continue;
      const isEndpoint = (nc === gc && nr === gr) || (nc === sc && nr === sr);
      if (grid[nr][nc] && !isEndpoint) continue;
      const tentativeG = current.g + 1;
      const existing = open.get(nKey);
      if (!existing || tentativeG < existing.g) {
        open.set(nKey, { c: nc, r: nr, g: tentativeG, f: tentativeG + heuristic(nc, nr, gc, gr), parent: currentKey });
        if (!existing) frontier.push(nKey);
      }
    }
  }
  return null;
}

// Merge consecutive grid steps that continue in the same direction so the
// tube geometry only bends where the path actually turns a corner.
function simplifyCellPath(cells: [number, number][]): [number, number][] {
  if (cells.length < 3) return cells;
  const simplified: [number, number][] = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const [pc, pr] = simplified[simplified.length - 1];
    const [cc, cr] = cells[i];
    const [nc, nr] = cells[i + 1];
    if (cc - pc !== nc - cc || cr - pr !== nr - cr) simplified.push(cells[i]);
  }
  simplified.push(cells[cells.length - 1]);
  return simplified;
}

function Cable({ path }: { path: [number, number, number][] }) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const pts = path.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    if (pts.length < 2) pts.push(pts[0].clone());
    // Low tension keeps corners softly rounded, like the reference diagram,
    // instead of perfectly sharp right angles.
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
  }, [path]);
  const geom = useMemo(
    () => new THREE.TubeGeometry(curve, Math.max(32, path.length * 16), 0.02, 6, false),
    [curve, path.length]
  );
  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const t = (clock.elapsedTime * 0.2) % 1;
      const p = curve.getPoint(t);
      pulseRef.current.position.copy(p);
    }
  });
  return (
    <group>
      <mesh geometry={geom}><meshStandardMaterial color="#0e4a30" /></mesh>
      <mesh ref={pulseRef}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} /></mesh>
    </group>
  );
}

// Distance from a point to a line segment (used for line-of-sight checks).
function pointToSegmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax, abz = bz - az;
  const apx = px - ax, apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  let t = abLenSq === 0 ? 0 : (apx * abx + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t, cz = az + abz * t;
  const dx = px - cx, dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz);
}

// True if a straight line between two points doesn't pass too close to any
// OTHER device. Used so cables stay straight by default, and only bend
// when a device actually happens to be sitting in the way.
function hasClearLineOfSight(
  a: THREE.Vector3, b: THREE.Vector3,
  obstacles: LNode[], excludeIds: Set<string>,
  clearanceRadius = 0.45
): boolean {
  for (const n of obstacles) {
    if (excludeIds.has(n.id)) continue;
    const [ox, , oz] = layoutToWorld(n.x, n.y);
    if (pointToSegmentDistance(ox, oz, a.x, a.z, b.x, b.z) < clearanceRadius) return false;
  }
  return true;
}

// Computes the automatic route between two devices (straight line if clear,
// A*-routed around obstacles otherwise).
function computeAutoPath(a: LNode, b: LNode, obstacles: LNode[]): [number, number, number][] {
  const [awx, , awz] = layoutToWorld(a.x, a.y);
  const [bwx, , bwz] = layoutToWorld(b.x, b.y);
  const av = new THREE.Vector3(awx, CABLE_GROUND_Y, awz);
  const bv = new THREE.Vector3(bwx, CABLE_GROUND_Y, bwz);
  const excludeIds = new Set([a.id, b.id]);

  if (hasClearLineOfSight(av, bv, obstacles, excludeIds)) {
    return [[awx, CABLE_GROUND_Y, awz], [bwx, CABLE_GROUND_Y, bwz]];
  }

  const grid = buildObstacleGrid(obstacles, excludeIds, 1);
  const cellPath = aStarPath(grid, worldToCell(awx, awz), worldToCell(bwx, bwz));

  let pts: [number, number, number][];
  if (cellPath && cellPath.length > 1) {
    pts = simplifyCellPath(cellPath).map(([col, row]) => {
      const [wx, wz] = cellToWorld(col, row);
      return [wx, CABLE_GROUND_Y, wz] as [number, number, number];
    });
  } else {
    pts = [[awx, CABLE_GROUND_Y, awz], [bwx, CABLE_GROUND_Y, bwz]];
  }
  pts[0] = [awx, CABLE_GROUND_Y, awz];
  pts[pts.length - 1] = [bwx, CABLE_GROUND_Y, bwz];
  return pts;
}

// A draggable bend the person placed manually. Drag to reposition; a plain
// click (no movement) removes it — same click-vs-drag pattern as devices.
function WaypointHandle({
  position, index, onMoveTo, onDelete, setOrbitEnabled,
}: {
  position: [number, number, number];
  index: number;
  onMoveTo: (index: number, x: number, z: number) => void;
  onDelete: (index: number) => void;
  setOrbitEnabled: (v: boolean) => void;
}) {
  const dragging = useRef(false);
  const moved = useRef(false);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -CABLE_GROUND_Y), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true; moved.current = false;
    setOrbitEnabled(false);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    moved.current = true;
    onMoveTo(index, hit.x, hit.z);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setOrbitEnabled(true);
    if (!moved.current) onDelete(index);
    e.stopPropagation();
  };

  return (
    <mesh position={position} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <sphereGeometry args={[0.065, 12, 12]} />
      <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.3} />
    </mesh>
  );
}

// A faint "grab here to bend the wire" point shown at the midpoint of every
// current segment. Dragging it far enough turns it into a real waypoint.
function AddPointGhost({
  position, segmentIndex, onInsertAndDrag, setOrbitEnabled,
}: {
  position: [number, number, number];
  segmentIndex: number;
  onInsertAndDrag: (segmentIndex: number, initial: [number, number]) => (x: number, z: number) => void;
  setOrbitEnabled: (v: boolean) => void;
}) {
  const dragging = useRef(false);
  const moved = useRef(false);
  const startXZ = useRef<[number, number]>([position[0], position[2]]);
  const updaterRef = useRef<((x: number, z: number) => void) | null>(null);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -CABLE_GROUND_Y), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true; moved.current = false; updaterRef.current = null;
    startXZ.current = [position[0], position[2]];
    setOrbitEnabled(false);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    const dx = hit.x - startXZ.current[0];
    const dz = hit.z - startXZ.current[1];
    if (!moved.current && Math.hypot(dx, dz) > 0.08) {
      moved.current = true;
      updaterRef.current = onInsertAndDrag(segmentIndex, startXZ.current);
    }
    if (moved.current) updaterRef.current?.(hit.x, hit.z);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setOrbitEnabled(true);
    e.stopPropagation();
  };

  return (
    <mesh position={position} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <sphereGeometry args={[0.045, 10, 10]} />
      <meshStandardMaterial color="#9aa0a6" transparent opacity={0.55} />
    </mesh>
  );
}

// Renders a connection's cable. Uses the automatic route (straight line,
// bending around obstacles only when needed) until the person manually
// drags a bend into it — from then on that connection is fully
// hand-routed and stays exactly where they put it, regardless of what the
// automatic router would otherwise choose.
function EditableRoute({
  connId, a, b, obstacles, wireWaypoints, setWireWaypoints, editable, setOrbitEnabled,
}: {
  connId: string;
  a: LNode;
  b: LNode;
  obstacles: LNode[];
  wireWaypoints: Record<string, [number, number][]>;
  setWireWaypoints: React.Dispatch<React.SetStateAction<Record<string, [number, number][]>>>;
  editable: boolean;
  setOrbitEnabled: (v: boolean) => void;
}) {
  const custom = wireWaypoints[connId] ?? [];

  const autoPath = useMemo(
    () => computeAutoPath(a, b, obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.x, a.y, b.x, b.y, obstacles]
  );

  const [awx, , awz] = layoutToWorld(a.x, a.y);
  const [bwx, , bwz] = layoutToWorld(b.x, b.y);

  const path: [number, number, number][] = useMemo(() => {
    if (custom.length === 0) return autoPath;
    return [
      [awx, CABLE_GROUND_Y, awz],
      ...custom.map(([x, z]) => [x, CABLE_GROUND_Y, z] as [number, number, number]),
      [bwx, CABLE_GROUND_Y, bwz],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom, awx, awz, bwx, bwz, autoPath]);

  const updatePoint = (index: number, x: number, z: number) => {
    setWireWaypoints(prev => {
      const arr = [...(prev[connId] ?? [])];
      arr[index] = [x, z];
      return { ...prev, [connId]: arr };
    });
  };
  const deletePoint = (index: number) => {
    setWireWaypoints(prev => {
      const arr = [...(prev[connId] ?? [])];
      arr.splice(index, 1);
      return { ...prev, [connId]: arr };
    });
  };
  // First drag on any segment seeds the manual array with whatever route is
  // currently showing (so switching to manual mode doesn't visually snap
  // the rest of the wire back to a straight line), then inserts the new
  // point at the exact spot grabbed.
  const insertAndGetUpdater = (segmentIndex: number, initial: [number, number]) => {
    setWireWaypoints(prev => {
      const base = prev[connId] ?? autoPath.slice(1, -1).map(([x, , z]) => [x, z] as [number, number]);
      const arr = [...base];
      arr.splice(segmentIndex, 0, initial);
      return { ...prev, [connId]: arr };
    });
    return (x: number, z: number) => updatePoint(segmentIndex, x, z);
  };

  return (
    <group>
      <Cable path={path} />
      {editable && custom.map((p, i) => (
        <WaypointHandle
          key={i}
          index={i}
          position={[p[0], CABLE_GROUND_Y, p[1]]}
          onMoveTo={updatePoint}
          onDelete={deletePoint}
          setOrbitEnabled={setOrbitEnabled}
        />
      ))}
      {editable && path.slice(0, -1).map((p, i) => {
        const q = path[i + 1];
        const mid: [number, number, number] = [(p[0] + q[0]) / 2, CABLE_GROUND_Y, (p[2] + q[2]) / 2];
        return (
          <AddPointGhost
            key={i}
            position={mid}
            segmentIndex={i}
            onInsertAndDrag={insertAndGetUpdater}
            setOrbitEnabled={setOrbitEnabled}
          />
        );
      })}
    </group>
  );
}

// Renders a connection to/from an AP as a wireless link: a string of small
// pulsing dashes traveling along the auto-routed path, instead of a solid
// cable tube. No waypoint handles — wireless links aren't hand-routed,
// since there's no physical wire to bend around anything.
function WirelessLink({ a, b, obstacles }: { a: LNode; b: LNode; obstacles: LNode[] }) {
  const path = useMemo(
    () => computeAutoPath(a, b, obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.x, a.y, b.x, b.y, obstacles]
  );
  const curve = useMemo(() => {
    const pts = path.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    if (pts.length < 2) pts.push(pts[0].clone());
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
  }, [path]);

  const DASH_COUNT = 12;
  const dashPositions = useMemo(
    () => Array.from({ length: DASH_COUNT }, (_, i) => curve.getPoint(i / (DASH_COUNT - 1))),
    [curve]
  );
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const phase = (clock.elapsedTime * 0.7 + i * (1 / DASH_COUNT)) % 1;
      mat.opacity = Math.sin(phase * Math.PI) * 0.9;
    });
  });

  return (
    <group ref={groupRef}>
      {dashPositions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.026, 8, 8]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.6} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Room (wall) + door editing.
// Rooms are drawn from layout-space rects (LWall) and are draggable/resizable
// in the "select" tool. Doors are openings attached to one side of a room's
// wall; rather than boolean-cutting the wall geometry (fragile, expensive),
// a door is drawn as a frame + an open swinging leaf sitting right at the
// opening — reads clearly as "there's a door here" without touching the
// wall mesh itself.
// ---------------------------------------------------------------------------

const MIN_ROOM_W = 60;
const MIN_ROOM_H = 60;
const WALL_H = 0.5;
const DOOR_POST_H = 0.4;

type Rect = { x: number; y: number; w: number; h: number };

function doorSideVectors(side: LDoor["side"]): { tangent: [number, number]; interior: [number, number] } {
  switch (side) {
    case "N": return { tangent: [1, 0], interior: [0, 1] };
    case "S": return { tangent: [1, 0], interior: [0, -1] };
    case "W": return { tangent: [0, 1], interior: [1, 0] };
    case "E": return { tangent: [0, 1], interior: [-1, 0] };
  }
}

function doorEdgeLayoutPoints(wall: Rect, side: LDoor["side"]): { start: [number, number]; end: [number, number] } {
  switch (side) {
    case "N": return { start: [wall.x, wall.y], end: [wall.x + wall.w, wall.y] };
    case "S": return { start: [wall.x, wall.y + wall.h], end: [wall.x + wall.w, wall.y + wall.h] };
    case "W": return { start: [wall.x, wall.y], end: [wall.x, wall.y + wall.h] };
    case "E": return { start: [wall.x + wall.w, wall.y], end: [wall.x + wall.w, wall.y + wall.h] };
  }
}

// Finds the closest room-wall edge to a clicked layout point, so the "door"
// tool can snap a click anywhere near a wall onto that wall's edge. Returns
// null if nothing is close enough.
function findNearestWallEdge(
  px: number, py: number, walls: LWall[], threshold = 28
): { wallId: string; side: LDoor["side"]; t: number; dist: number } | null {
  let best: { wallId: string; side: LDoor["side"]; t: number; dist: number } | null = null;
  for (const w of walls) {
    const edges: { side: LDoor["side"]; a: [number, number]; b: [number, number] }[] = [
      { side: "N", a: [w.x, w.y], b: [w.x + w.w, w.y] },
      { side: "S", a: [w.x, w.y + w.h], b: [w.x + w.w, w.y + w.h] },
      { side: "W", a: [w.x, w.y], b: [w.x, w.y + w.h] },
      { side: "E", a: [w.x + w.w, w.y], b: [w.x + w.w, w.y + w.h] },
    ];
    for (const edge of edges) {
      const [ax, ay] = edge.a, [bx, by] = edge.b;
      const abx = bx - ax, aby = by - ay;
      const abLenSq = abx * abx + aby * aby || 1;
      let t = ((px - ax) * abx + (py - ay) * aby) / abLenSq;
      t = Math.max(0.08, Math.min(0.92, t)); // keep doors away from corners
      const cx = ax + abx * t, cy = ay + aby * t;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < threshold && (!best || dist < best.dist)) {
        best = { wallId: w.id, side: edge.side, t, dist };
      }
    }
  }
  return best;
}

function Door({
  wall, door, isSelected, editable, onSelect,
}: {
  wall: Rect;
  door: LDoor;
  isSelected: boolean;
  editable: boolean;
  onSelect: () => void;
}) {
  const { start, end } = doorEdgeLayoutPoints(wall, door.side);
  const halfWidthLayout = door.width / 2;
  const centerLayout: [number, number] = [
    start[0] + (end[0] - start[0]) * door.t,
    start[1] + (end[1] - start[1]) * door.t,
  ];
  const { tangent, interior } = doorSideVectors(door.side);
  const isVertical = door.side === "W" || door.side === "E";
  const worldHalfWidth = isVertical ? halfWidthLayout * SCALE_Z : halfWidthLayout * SCALE_X;

  const hingeLayout: [number, number] = [
    centerLayout[0] - tangent[0] * halfWidthLayout,
    centerLayout[1] - tangent[1] * halfWidthLayout,
  ];
  const farLayout: [number, number] = [
    centerLayout[0] + tangent[0] * halfWidthLayout,
    centerLayout[1] + tangent[1] * halfWidthLayout,
  ];
  const [hx, , hz] = layoutToWorld(hingeLayout[0], hingeLayout[1]);
  const [fx, , fz] = layoutToWorld(farLayout[0], farLayout[1]);

  // Leaf swings open ~62° from the wall line toward the room interior.
  const theta = (62 * Math.PI) / 180;
  const tanWorld: [number, number] = isVertical ? [0, tangent[1]] : [tangent[0], 0];
  const dirX = tanWorld[0] * Math.cos(theta) + interior[0] * Math.sin(theta);
  const dirZ = tanWorld[1] * Math.cos(theta) + interior[1] * Math.sin(theta);
  const leafLen = worldHalfWidth * 2 * 0.92;
  const leafAngle = Math.atan2(-dirZ, dirX);
  const leafCenter: [number, number] = [hx + dirX * (leafLen / 2), hz + dirZ * (leafLen / 2)];

  return (
    <group
      onPointerDown={editable ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect(); } : undefined}
    >
      {/* frame posts */}
      <mesh position={[hx, DOOR_POST_H / 2, hz]}><boxGeometry args={[0.035, DOOR_POST_H, 0.035]} /><meshStandardMaterial color={isSelected ? "#facc15" : "#7c4a2d"} /></mesh>
      <mesh position={[fx, DOOR_POST_H / 2, fz]}><boxGeometry args={[0.035, DOOR_POST_H, 0.035]} /><meshStandardMaterial color={isSelected ? "#facc15" : "#7c4a2d"} /></mesh>
      {/* open door leaf */}
      <mesh position={[leafCenter[0], DOOR_POST_H * 0.46, leafCenter[1]]} rotation={[0, leafAngle, 0]}>
        <boxGeometry args={[leafLen, DOOR_POST_H * 0.85, 0.025]} />
        <meshStandardMaterial color={isSelected ? "#fde68a" : "#a9784f"} />
      </mesh>
    </group>
  );
}

type Corner = "nw" | "ne" | "sw" | "se";
function cornerLayoutPoint(wall: Rect, corner: Corner): [number, number] {
  switch (corner) {
    case "nw": return [wall.x, wall.y];
    case "ne": return [wall.x + wall.w, wall.y];
    case "sw": return [wall.x, wall.y + wall.h];
    case "se": return [wall.x + wall.w, wall.y + wall.h];
  }
}

// A small draggable cube at one corner of a room. Dragging resizes the room,
// keeping the OPPOSITE corner anchored in place (the usual "resize handle"
// behavior), clamped to a minimum room size.
function WallCornerHandle({
  wall, corner, onDrag, onDragEnd, setOrbitEnabled,
}: {
  wall: Rect;
  corner: Corner;
  onDrag: (x: number, y: number, w: number, h: number) => void;
  onDragEnd: () => void;
  setOrbitEnabled: (v: boolean) => void;
}) {
  const [lx, ly] = cornerLayoutPoint(wall, corner);
  const [hx, , hz] = layoutToWorld(lx, ly);
  const dragging = useRef(false);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    setOrbitEnabled(false);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const [nlx, nly] = worldToLayout(e.point.x, e.point.z);
    const { x: ox, y: oy, w: ow, h: oh } = wall;
    let x = ox, y = oy, w = ow, h = oh;
    if (corner === "nw") {
      const x1 = ox + ow, y1 = oy + oh;
      x = Math.min(nlx, x1 - MIN_ROOM_W);
      y = Math.min(nly, y1 - MIN_ROOM_H);
      w = x1 - x; h = y1 - y;
    } else if (corner === "ne") {
      const y1 = oy + oh;
      const x1 = Math.max(nlx, ox + MIN_ROOM_W);
      y = Math.min(nly, y1 - MIN_ROOM_H);
      w = x1 - ox; h = y1 - y;
    } else if (corner === "sw") {
      const x1 = ox + ow;
      x = Math.min(nlx, x1 - MIN_ROOM_W);
      const y1 = Math.max(nly, oy + MIN_ROOM_H);
      w = x1 - x; h = y1 - oy;
    } else if (corner === "se") {
      const x1 = Math.max(nlx, ox + MIN_ROOM_W);
      const y1 = Math.max(nly, oy + MIN_ROOM_H);
      w = x1 - ox; h = y1 - oy;
    }
    onDrag(x, y, w, h);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setOrbitEnabled(true);
    onDragEnd();
    e.stopPropagation();
  };

  return (
    <mesh position={[hx, 0.03, hz]} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <boxGeometry args={[0.09, 0.09, 0.09]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} />
    </mesh>
  );
}

function Room({
  wall, doors, isSelected, editable, selectedDoorId,
  onSelect, onMove, onResize, onDoorSelect, setOrbitEnabled,
}: {
  wall: LWall;
  doors: LDoor[];
  isSelected: boolean;
  editable: boolean;
  selectedDoorId: string | null;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (x: number, y: number, w: number, h: number) => void;
  onDoorSelect: (id: string) => void;
  setOrbitEnabled: (v: boolean) => void;
}) {
  // Local rect mirrors the committed wall but updates instantly during drag,
  // so resizing/moving feels smooth instead of round-tripping through
  // localStorage on every pointer-move event. Only the final position is
  // committed upstream (see onFloorUp / commitResize).
  const [rect, setRect] = useState<Rect>({ x: wall.x, y: wall.y, w: wall.w, h: wall.h });
  useEffect(() => setRect({ x: wall.x, y: wall.y, w: wall.w, h: wall.h }), [wall.x, wall.y, wall.w, wall.h]);

  const { x, y, w, h } = rect;
  const [wx, , wz] = layoutToWorld(x + w / 2, y + h / 2);
  const sx = w * SCALE_X;
  const sz = h * SCALE_Z;

  const draggingFloor = useRef(false);
  const movedFloor = useRef(false);
  const floorStartWorld = useRef<[number, number]>([0, 0]);
  const floorOrigin = useRef<{ x: number; y: number }>({ x, y });

  const onFloorDown = (e: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingFloor.current = true; movedFloor.current = false;
    floorStartWorld.current = [e.point.x, e.point.z];
    floorOrigin.current = { x: rect.x, y: rect.y };
    setOrbitEnabled(false);
  };
  const onFloorMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingFloor.current) return;
    const dx = e.point.x - floorStartWorld.current[0];
    const dz = e.point.z - floorStartWorld.current[1];
    if (Math.hypot(dx, dz) > 0.03) movedFloor.current = true;
    if (!movedFloor.current) return;
    setRect(r => ({ ...r, x: floorOrigin.current.x + dx / SCALE_X, y: floorOrigin.current.y + dz / SCALE_Z }));
  };
  const onFloorUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingFloor.current) return;
    draggingFloor.current = false;
    setOrbitEnabled(true);
    if (movedFloor.current) onMove(rect.x, rect.y);
    else onSelect();
    e.stopPropagation();
  };

  const handleResizeDrag = (nx: number, ny: number, nw: number, nh: number) => setRect({ x: nx, y: ny, w: nw, h: nh });
  const commitResize = () => onResize(rect.x, rect.y, rect.w, rect.h);

  return (
    <group>
      {/* floor */}
      <mesh
        position={[wx, 0.001, wz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onFloorDown}
        onPointerMove={onFloorMove}
        onPointerUp={onFloorUp}
        onPointerCancel={onFloorUp}
      >
        <planeGeometry args={[sx, sz]} />
        <meshStandardMaterial color={isSelected ? "#cfe9da" : "#e6efe9"} transparent opacity={isSelected ? 0.55 : 0.4} />
      </mesh>

      {/* wall frame — kept as one solid translucent box per side; door
          openings are indicated by a distinct frame+leaf drawn on top
          rather than a geometric cutout. */}
      <mesh position={[-sx / 2, WALL_H / 2, 0]}><boxGeometry args={[0.05, WALL_H, sz]} /><meshStandardMaterial color="#0e4a30" transparent opacity={0.55} /></mesh>
      <mesh position={[sx / 2, WALL_H / 2, 0]}><boxGeometry args={[0.05, WALL_H, sz]} /><meshStandardMaterial color="#0e4a30" transparent opacity={0.55} /></mesh>
      <mesh position={[0, WALL_H / 2, -sz / 2]}><boxGeometry args={[sx, WALL_H, 0.05]} /><meshStandardMaterial color="#0e4a30" transparent opacity={0.55} /></mesh>
      <mesh position={[0, WALL_H / 2, sz / 2]}><boxGeometry args={[sx, WALL_H, 0.05]} /><meshStandardMaterial color="#0e4a30" transparent opacity={0.55} /></mesh>

      {doors.map(d => (
        <Door
          key={d.id}
          wall={rect}
          door={d}
          isSelected={selectedDoorId === d.id}
          editable={editable}
          onSelect={() => onDoorSelect(d.id)}
        />
      ))}

      {isSelected && editable && (
        <>
          <WallCornerHandle wall={rect} corner="nw" onDrag={handleResizeDrag} onDragEnd={commitResize} setOrbitEnabled={setOrbitEnabled} />
          <WallCornerHandle wall={rect} corner="ne" onDrag={handleResizeDrag} onDragEnd={commitResize} setOrbitEnabled={setOrbitEnabled} />
          <WallCornerHandle wall={rect} corner="sw" onDrag={handleResizeDrag} onDragEnd={commitResize} setOrbitEnabled={setOrbitEnabled} />
          <WallCornerHandle wall={rect} corner="se" onDrag={handleResizeDrag} onDragEnd={commitResize} setOrbitEnabled={setOrbitEnabled} />
        </>
      )}
    </group>
  );
}

function Scene({
  dept, tool, connectFrom, selected,
  onGroundClick, onNodeSelect, onNodeMove, setOrbitEnabled, orbitEnabled,
  wireWaypoints, setWireWaypoints,
  selectedWall, selectedDoor, onWallSelect, onWallMove, onWallResize,
  onDoorSelect, onAddWall, onAddDoor, onDeselectAll, readOnly,
}: {
  dept: Department;
  tool: Tool3D;
  connectFrom: string | null;
  selected: string | null;
  onGroundClick: (x: number, y: number) => void;
  onNodeSelect: (id: string) => void;
  onNodeMove: (id: string, x: number, y: number) => void;
  setOrbitEnabled: (v: boolean) => void;
  orbitEnabled: boolean;
  wireWaypoints: Record<string, [number, number][]>;
  setWireWaypoints: React.Dispatch<React.SetStateAction<Record<string, [number, number][]>>>;
  selectedWall: string | null;
  selectedDoor: string | null;
  onWallSelect: (id: string) => void;
  onWallMove: (id: string, x: number, y: number) => void;
  onWallResize: (id: string, x: number, y: number, w: number, h: number) => void;
  onDoorSelect: (id: string) => void;
  onAddWall: (rect: Rect) => void;
  onAddDoor: (wallId: string, side: LDoor["side"], t: number) => void;
  onDeselectAll: () => void;
  readOnly: boolean;
}) {
  const { layout } = useDeptLayout(dept);
  const nodeById = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);

  const [roomDraft, setRoomDraft] = useState<{ start: [number, number]; current: [number, number] } | null>(null);

  const onGroundDown = (e: ThreeEvent<PointerEvent>) => {
    // Presentation/viewer mode: the ground plane has nothing to do —
    // clicks just fall through to OrbitControls for camera rotation.
    if (readOnly) return;
    e.stopPropagation();
    const [nx, ny] = worldToLayout(e.point.x, e.point.z);
    if (typeof tool === "object" && tool.kind === "place") {
      onGroundClick(nx, ny);
      return;
    }
    if (tool === "room") {
      setRoomDraft({ start: [nx, ny], current: [nx, ny] });
      return;
    }
    if (tool === "door") {
      const hit = findNearestWallEdge(nx, ny, layout.walls);
      if (hit) onAddDoor(hit.wallId, hit.side, hit.t);
      return;
    }
    if (tool === "select") {
      onDeselectAll();
    }
  };
  const onGroundMove = (e: ThreeEvent<PointerEvent>) => {
    if (readOnly || !roomDraft) return;
    const [nx, ny] = worldToLayout(e.point.x, e.point.z);
    setRoomDraft(d => (d ? { ...d, current: [nx, ny] } : d));
  };
  const onGroundUp = () => {
    if (readOnly || !roomDraft) return;
    const [sx0, sy0] = roomDraft.start;
    const [cx0, cy0] = roomDraft.current;
    const x = Math.min(sx0, cx0), y = Math.min(sy0, cy0);
    const w = Math.max(MIN_ROOM_W, Math.abs(cx0 - sx0));
    const h = Math.max(MIN_ROOM_H, Math.abs(cy0 - sy0));
    setRoomDraft(null);
    onAddWall({ x, y, w, h });
  };

  const draftRect = useMemo(() => {
    if (!roomDraft) return null;
    const x = Math.min(roomDraft.start[0], roomDraft.current[0]);
    const y = Math.min(roomDraft.start[1], roomDraft.current[1]);
    const w = Math.abs(roomDraft.current[0] - roomDraft.start[0]);
    const h = Math.abs(roomDraft.current[1] - roomDraft.start[1]);
    return { x, y, w, h };
  }, [roomDraft]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={0.9} castShadow />
      <hemisphereLight args={["#ffffff", "#c8d6cd", 0.4]} />

      {/* ground click plane — handles device placement, room drag-to-draw,
          door snapping, and deselect-on-empty-click, depending on tool.
          All a no-op in read-only mode, so clicks just orbit the camera. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onGroundDown}
        onPointerMove={onGroundMove}
        onPointerUp={onGroundUp}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#f5faf7" />
      </mesh>
      <gridHelper args={[40, 40, "#0e4a30", "#c8d6cd"]} position={[0, 0.005, 0]} />

      {layout.walls.map(w => (
        <Room
          key={w.id}
          wall={w}
          doors={layout.doors.filter(d => d.wallId === w.id)}
          isSelected={selectedWall === w.id}
          editable={!readOnly && tool === "select"}
          selectedDoorId={selectedDoor}
          onSelect={() => onWallSelect(w.id)}
          onMove={(x, y) => onWallMove(w.id, x, y)}
          onResize={(x, y, ww, hh) => onWallResize(w.id, x, y, ww, hh)}
          onDoorSelect={onDoorSelect}
          setOrbitEnabled={setOrbitEnabled}
        />
      ))}

      {draftRect && draftRect.w > 0.5 && draftRect.h > 0.5 && (() => {
        const [pwx, , pwz] = layoutToWorld(draftRect.x + draftRect.w / 2, draftRect.y + draftRect.h / 2);
        return (
          <mesh position={[pwx, 0.012, pwz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.max(draftRect.w * SCALE_X, 0.02), Math.max(draftRect.h * SCALE_Z, 0.02)]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.35} />
          </mesh>
        );
      })()}

      {layout.connections.map(c => {
        const a = nodeById.get(c.from); const b = nodeById.get(c.to);
        if (!a || !b) return null;
        if (a.type === "AP" || b.type === "AP") {
          return <WirelessLink key={c.id} a={a} b={b} obstacles={layout.nodes} />;
        }
        return (
          <EditableRoute
            key={c.id}
            connId={c.id}
            a={a}
            b={b}
            obstacles={layout.nodes}
            wireWaypoints={wireWaypoints}
            setWireWaypoints={setWireWaypoints}
            editable={!readOnly && tool === "select"}
            setOrbitEnabled={setOrbitEnabled}
          />
        );
      })}

      {layout.nodes.map(n => (
        <EditableDevice
          key={n.id}
          node={n}
          onMove={(x, y) => onNodeMove(n.id, x, y)}
          onSelectPointer={() => onNodeSelect(n.id)}
          isSelected={selected === n.id}
          isConnectFrom={connectFrom === n.id}
          setOrbitEnabled={setOrbitEnabled}
          connectMode={tool === "connect"}
          locked={readOnly}
        />
      ))}

      <OrbitControls
        enabled={orbitEnabled}
        enablePan={false}
        minDistance={6}
        maxDistance={22}
      />
    </>
  );
}

export function ThreeDModal({ dept, origin, onClose, readOnly = false }: Props) {
  const [closing, setClosing] = useState(false);
  const [tool, setTool] = useState<Tool3D>("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  // Manual cable bends per connection id, e.g. { "conn-1": [[x1,z1], [x2,z2]] }.
  // Empty/missing entry means "use the automatic route" for that connection.
  const [wireWaypoints, setWireWaypoints] = useState<Record<string, [number, number][]>>({});
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(null);

  useEffect(() => {
    if (dept) {
      setClosing(false);
      setTool("select");
      setConnectFrom(null);
      setSelected(null);
      setWireWaypoints({});
      setSelectedWall(null);
      setSelectedDoor(null);
    }
  }, [dept?.acronym]);

  // hooks conditional: only call when we have a dept — but rules: keep unconditional.
  const hook = useDeptLayout(dept ?? ({ acronym: "__none__", devices: {} } as unknown as Department));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dept) return;
      if (e.key === "Escape") {
        if (!readOnly && tool !== "select") { setTool("select"); setConnectFrom(null); }
        else close();
      }
      if (readOnly) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) {
          e.preventDefault();
          hook.removeNode(selected);
          setSelected(null);
        } else if (selectedDoor) {
          e.preventDefault();
          hook.removeDoor(selectedDoor);
          setSelectedDoor(null);
        } else if (selectedWall) {
          e.preventDefault();
          hook.removeWall(selectedWall);
          setSelectedWall(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!dept) return null;
  const rx = origin ? `${(origin.x / window.innerWidth) * 100}%` : "50%";
  const ry = origin ? `${(origin.y / window.innerHeight) * 100}%` : "50%";
  const close = () => { setClosing(true); setTimeout(onClose, 380); };

  const handleGroundClick = (x: number, y: number) => {
    if (typeof tool === "object" && tool.kind === "place") {
      hook.addNode(tool.type, x, y);
      setTool("select");
    }
  };

  const handleNodeSelect = (id: string) => {
    if (tool === "connect") {
      if (!connectFrom) setConnectFrom(id);
      else { hook.addConnection(connectFrom, id); setConnectFrom(null); setTool("select"); }
      return;
    }
    setSelected(id);
    setSelectedWall(null);
    setSelectedDoor(null);
  };

  const handleWallSelect = (id: string) => {
    setSelectedWall(id);
    setSelectedDoor(null);
    setSelected(null);
  };

  const handleDoorSelect = (id: string) => {
    setSelectedDoor(id);
    setSelectedWall(null);
    setSelected(null);
  };

  const handleDeselectAll = () => {
    setSelectedWall(null);
    setSelectedDoor(null);
    setSelected(null);
  };

  return (
    <div
      className={"fixed inset-0 z-50 bg-tint " + (closing ? "reveal-out" : "reveal-in")}
      style={{ ["--rx" as never]: rx, ["--ry" as never]: ry }}
    >
      <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
      <div className="relative h-full w-full flex flex-col">
        <div className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border bg-background/70 backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
            <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground">
              3D PORTAL · {dept.acronym} · {dept.name.toUpperCase()}
            </span>
          </div>
          <button
            onClick={close}
            className="font-mono text-[12px] tracking-[0.18em] px-4 py-2 border border-ink text-ink hover:bg-ink hover:text-background"
          >
            CLOSE ✕
          </button>
        </div>

        {/* Toolbar — hidden entirely in read-only/presentation mode, since
            there's nothing to select/place/connect/edit. */}
        {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-border bg-background/70 backdrop-blur">
          <ToolBtn active={tool === "select"} onClick={() => { setTool("select"); setConnectFrom(null); }}>SELECT / DRAG</ToolBtn>
          <ToolBtn active={tool === "connect"} onClick={() => { setTool("connect"); setConnectFrom(null); }}>CONNECT</ToolBtn>
          <ToolBtn active={tool === "room"} onClick={() => { setTool("room"); setConnectFrom(null); }}>ROOM</ToolBtn>
          <ToolBtn active={tool === "door"} onClick={() => { setTool("door"); setConnectFrom(null); }}>DOOR</ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mr-1">PLACE</span>
          {DEVICE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTool({ kind: "place", type: t })}
              className={
                "font-mono text-[10px] tracking-[0.14em] px-2 py-1 border " +
                (typeof tool === "object" && tool.type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-ink")
              }
            >
              {DEVICE_LABELS[t]}
            </button>
          ))}
          <div className="flex-1" />
          {selected && (
            <button onClick={() => { hook.removeNode(selected); setSelected(null); }}
                    className="font-mono text-[10px] tracking-[0.18em] px-2 py-1 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              DELETE NODE
            </button>
          )}
          {selectedWall && (
            <button onClick={() => { hook.removeWall(selectedWall); setSelectedWall(null); }}
                    className="font-mono text-[10px] tracking-[0.18em] px-2 py-1 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              DELETE ROOM
            </button>
          )}
          {selectedDoor && (
            <button onClick={() => { hook.removeDoor(selectedDoor); setSelectedDoor(null); }}
                    className="font-mono text-[10px] tracking-[0.18em] px-2 py-1 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              DELETE DOOR
            </button>
          )}
          <button
            onClick={() => {
              if (confirm("Reset this scene to the generated layout?")) {
                hook.reset();
                setWireWaypoints({});
                setSelectedWall(null);
                setSelectedDoor(null);
                setSelected(null);
              }
            }}
            className="font-mono text-[10px] tracking-[0.18em] px-2 py-1 border border-border hover:border-destructive hover:text-destructive"
          >
            RESET
          </button>
        </div>
        )}

        <div className="relative flex-1">
          <Canvas shadows camera={{ position: [10, 9, 10], fov: 45 }}>
            <Suspense fallback={null}>
              <Scene
                dept={dept}
                tool={tool}
                connectFrom={connectFrom}
                selected={selected}
                onGroundClick={handleGroundClick}
                onNodeSelect={handleNodeSelect}
                onNodeMove={(id, x, y) => hook.moveNode(id, x, y)}
                setOrbitEnabled={setOrbitEnabled}
                orbitEnabled={orbitEnabled}
                wireWaypoints={wireWaypoints}
                setWireWaypoints={setWireWaypoints}
                selectedWall={selectedWall}
                selectedDoor={selectedDoor}
                onWallSelect={handleWallSelect}
                onWallMove={(id, x, y) => hook.updateWall(id, { x, y })}
                onWallResize={(id, x, y, w, h) => hook.updateWall(id, { x, y, w, h })}
                onDoorSelect={handleDoorSelect}
                onAddWall={(rect) => hook.addWall(rect)}
                onAddDoor={(wallId, side, t) => hook.addDoor(wallId, side, t)}
                onDeselectAll={handleDeselectAll}
                readOnly={readOnly}
              />
            </Suspense>
          </Canvas>

          <div className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
            {readOnly ? (
              "VIEW MODE · DRAG TO ORBIT · SCROLL TO ZOOM"
            ) : (
              <>
                MODE ·{" "}
                {tool === "select" ? "DRAG DEVICES/ROOMS · DRAG YELLOW HANDLES · CLICK EMPTY TO DESELECT" :
                 tool === "connect" ? (connectFrom ? "PICK TARGET NODE" : "PICK SOURCE NODE") :
                 tool === "room" ? "DRAG ON THE GROUND TO DRAW A ROOM" :
                 tool === "door" ? "CLICK A WALL EDGE TO ADD A DOOR" :
                 `CLICK GROUND TO PLACE ${DEVICE_LABELS[tool.type]}`}
              </>
            )}
          </div>
          <div className="absolute bottom-4 right-4 font-mono text-[10px] tracking-[0.22em] text-muted-foreground text-right">
            {readOnly ? (
              <>
                <div>DRAG · ORBIT</div>
                <div>SCROLL · ZOOM</div>
                <div>ESC · CLOSE</div>
              </>
            ) : (
              <>
                <div>RIGHT-DRAG · ORBIT</div>
                <div>SCROLL · ZOOM</div>
                <div>DEL · REMOVE SELECTED</div>
                <div>CLICK BEND · REMOVE BEND</div>
                <div>ESC · EXIT MODE</div>
              </>
            )}
          </div>
        </div>
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