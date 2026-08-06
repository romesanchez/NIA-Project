import { useCallback, useEffect, useState } from "react";
import type { Department, DeviceType } from "@/data/departments";
import {
  clearLayout, ConnType, generateInitialLayout, Layout, LWall, loadLayout,
  saveLayout, subscribeLayout, uid,
} from "@/lib/deptLayout";

export function useDeptLayout(dept: Department) {
  const [layout, setLayout] = useState<Layout>(() => loadLayout(dept));

  useEffect(() => {
    setLayout(loadLayout(dept));
    return subscribeLayout(dept.acronym, () => setLayout(loadLayout(dept)));
  }, [dept.acronym]);

  const commit = useCallback((next: Layout) => { saveLayout(dept, next); }, [dept]);

  return {
    layout,
    addNode: (type: DeviceType, x: number, y: number) =>
      commit({ ...layout, nodes: [...layout.nodes, { id: uid("n"), type, x, y }] }),
    moveNode: (id: string, x: number, y: number) =>
      commit({ ...layout, nodes: layout.nodes.map(n => n.id === id ? { ...n, x, y } : n) }),
    removeNode: (id: string) =>
      commit({
        ...layout,
        nodes: layout.nodes.filter(n => n.id !== id),
        connections: layout.connections.filter(c => c.from !== id && c.to !== id),
      }),
    addConnection: (from: string, to: string, connType: ConnType = "LAN") => {
      if (from === to) return;
      if (layout.connections.some(c => (c.from === from && c.to === to) || (c.from === to && c.to === from))) return;
      commit({ ...layout, connections: [...layout.connections, { id: uid("c"), from, to, connType }] });
    },
    removeConnection: (id: string) =>
      commit({ ...layout, connections: layout.connections.filter(c => c.id !== id) }),
    addWall: () =>
      commit({
        ...layout,
        walls: [...layout.walls, { id: uid("w"), x: 400, y: 260, w: 220, h: 140, label: "NEW ROOM" }],
      }),
    updateWall: (id: string, patch: Partial<LWall>) =>
      commit({ ...layout, walls: layout.walls.map(w => w.id === id ? { ...w, ...patch } : w) }),
    removeWall: (id: string) =>
      commit({ ...layout, walls: layout.walls.filter(w => w.id !== id) }),
    reset: () => { clearLayout(dept); saveLayout(dept, generateInitialLayout(dept)); },
  };
}
