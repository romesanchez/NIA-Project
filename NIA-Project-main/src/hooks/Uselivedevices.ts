import { useEffect, useState } from "react";
import type { DeviceType } from "@/data/departments";
import { loadTopology, subscribeTopology } from "@/lib/topologyLayout";

/**
 * Returns live device counts for a department derived directly from its
 * topology canvas (localStorage). Re-renders automatically whenever the
 * topology is saved — so adding or removing a device in the editor
 * instantly updates the device card on the department slide.
 *
 * Falls back to the static `dept.devices` seed counts only when localStorage
 * has no topology yet for this department (i.e. first load, before the user
 * has opened the editor).
 */
export function useLiveDevices(
  acronym: string,
  seedDevices: Partial<Record<DeviceType, number>>,
): Partial<Record<DeviceType, number>> {
  const [devices, setDevices] = useState<Partial<Record<DeviceType, number>>>(
    () => readDevices(acronym, seedDevices),
  );

  useEffect(() => {
    // Recompute immediately whenever the acronym changes (slide navigation).
    setDevices(readDevices(acronym, seedDevices));

    // Subscribe to topology saves for this department so the card updates
    // in real time while the editor is open in another tab/route.
    const unsub = subscribeTopology(acronym, () => {
      setDevices(readDevices(acronym, seedDevices));
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acronym]);

  return devices;
}

/**
 * Count each DeviceType that appears in the stored topology nodes.
 * If the topology in localStorage is empty (no nodes placed yet), fall back
 * to the static seed counts so the card isn't blank on first visit.
 */
function readDevices(
  acronym: string,
  seed: Partial<Record<DeviceType, number>>,
): Partial<Record<DeviceType, number>> {
  try {
    const key = `nia-topology:v1:${acronym}`;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;

    if (raw) {
      const parsed = JSON.parse(raw);
      const nodes: { type: DeviceType }[] = parsed?.nodes ?? [];

      if (nodes.length > 0) {
        const counts: Partial<Record<DeviceType, number>> = {};
        for (const node of nodes) {
          counts[node.type] = (counts[node.type] ?? 0) + 1;
        }
        return counts;
      }
    }
  } catch {
    // malformed JSON — fall through to seed
  }

  // Nothing in localStorage yet → use the seed from departments.ts so the
  // initial topology generator has something to work with.
  return seed;
}