import { useCallback, useEffect, useState } from "react";
import type { Department, DeviceType } from "@/data/departments";
import { ConnType, uid } from "@/lib/deptLayout";
import {
  clearTopology, exportTopologyFile, generateInitialTopology, parseTopologyFile,
  TopoLayout, loadTopology, saveTopology, subscribeTopology,
} from "@/lib/topologyLayout";

export function useTopologyLayout(dept: Department) {
  const [layout, setLayout] = useState<TopoLayout>(() => loadTopology(dept));

  useEffect(() => {
    setLayout(loadTopology(dept));
    return subscribeTopology(dept.acronym, () => setLayout(loadTopology(dept)));
  }, [dept.acronym]);

  const commit = useCallback((next: TopoLayout) => { saveTopology(dept, next); }, [dept]);

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
    addLabel: (x: number, y: number, text = "Label", id?: string) =>
      commit({ ...layout, labels: [...layout.labels, { id: id ?? uid("l"), x, y, text }] }),
    moveLabel: (id: string, x: number, y: number) =>
      commit({ ...layout, labels: layout.labels.map(l => l.id === id ? { ...l, x, y } : l) }),
    editLabel: (id: string, text: string) =>
      commit({ ...layout, labels: layout.labels.map(l => l.id === id ? { ...l, text } : l) }),
    removeLabel: (id: string) =>
      commit({ ...layout, labels: layout.labels.filter(l => l.id !== id) }),
    setDescription: (text: string) =>
      commit({ ...layout, description: text }),
    reset: () => { clearTopology(dept); saveTopology(dept, generateInitialTopology(dept)); },

    /** "Save As" — downloads the current topology as a .json file the user
     * picks a location for via the browser's normal save dialog. */
    exportToFile: () => exportTopologyFile(dept, layout),

    /** "Open" — reads a previously-exported file and replaces the current
     * canvas with it. Rejects (throwing TopologyFileError) instead of
     * silently overwriting the canvas if the file doesn't parse or was
     * exported from a different department. */
    importFromFile: async (file: File) => {
      const text = await file.text();
      const imported = parseTopologyFile(text, dept.acronym);
      commit(imported);
    },
  };
}