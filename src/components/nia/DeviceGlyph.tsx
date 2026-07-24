import type { DeviceType } from "@/data/departments";

export const DEVICE_LABELS: Record<DeviceType, string> = {
  PC: "PC", SERVER: "SRV", SWITCH: "SW", ROUTER: "RTR", PRINTER: "PRN", AP: "AP",
  WEBCAM: "CAM", LAPTOP: "LPT", SMARTPHONE: "PHN", MEDIACONVERTER: "MDC", CONTROLLER: "CTL",
};

/** Full, human-readable device names — used anywhere space allows a real
 * label instead of the compact chip abbreviation above (e.g. the device
 * picker in the floor plan editor). */
export const DEVICE_FULL_LABELS: Record<DeviceType, string> = {
  PC: "PC", SERVER: "Server", SWITCH: "Switch", ROUTER: "Router", PRINTER: "Printer", AP: "Access Point",
  WEBCAM: "Webcam", LAPTOP: "Laptop", SMARTPHONE: "Smartphone", MEDIACONVERTER: "Media Converter", CONTROLLER: "Controller",
};

interface Props {
  type: DeviceType;
  size?: number;
  /** primary "chassis" color */
  body?: string;
  /** highlight / accent (ports, screens, LEDs) */
  accent?: string;
  /** thin edge lines between panels */
  edge?: string;
}

/**
 * Flat, icon-style glyphs for each device type — a dark chassis body with a
 * bright accent for screens/ports/LEDs, drawn on a -s..s coordinate box so
 * they drop straight into the topology canvas at any size.
 */
export function DeviceGlyph({
  type,
  size = 14,
  body = "var(--color-ink)",
  accent = "var(--color-accent)",
  edge = "var(--color-background)",
}: Props) {
  const s = size;

  switch (type) {
    case "PC":
      return (
        <g>
          {/* monitor */}
          <rect x={-s} y={-s * 0.85} width={s * 2} height={s * 1.3} rx={s * 0.12} fill={body} />
          <rect x={-s * 0.82} y={-s * 0.67} width={s * 1.64} height={s * 0.94} fill={accent} opacity={0.9} />
          {/* stand */}
          <rect x={-s * 0.16} y={s * 0.45} width={s * 0.32} height={s * 0.32} fill={body} />
          <rect x={-s * 0.55} y={s * 0.72} width={s * 1.1} height={s * 0.18} rx={s * 0.06} fill={body} />
        </g>
      );

    case "SERVER":
      return (
        <g>
          <rect x={-s * 0.75} y={-s} width={s * 1.5} height={s * 2} rx={s * 0.1} fill={body} />
          {[-0.62, -0.2, 0.22, 0.64].map((k) => (
            <g key={k}>
              <rect x={-s * 0.58} y={s * k - s * 0.1} width={s * 0.86} height={s * 0.2} fill={edge} opacity={0.12} />
              <circle cx={s * 0.45} cy={s * k} r={s * 0.09} fill={accent} />
            </g>
          ))}
        </g>
      );

    case "SWITCH":
      return (
        <g>
          <rect x={-s * 1.35} y={-s * 0.42} width={s * 2.7} height={s * 0.84} rx={s * 0.1} fill={body} />
          {Array.from({ length: 7 }).map((_, i) => (
            <rect
              key={i}
              x={-s * 1.15 + i * s * 0.36}
              y={-s * 0.18}
              width={s * 0.22}
              height={s * 0.36}
              fill={accent}
            />
          ))}
        </g>
      );

    case "ROUTER":
      return (
        <g>
          <rect x={-s * 1.05} y={-s * 0.55} width={s * 2.1} height={s * 1.1} rx={s * 0.22} fill={body} />
          {/* antennas */}
          <line x1={-s * 0.5} y1={-s * 0.55} x2={-s * 0.7} y2={-s * 1.15} stroke={body} strokeWidth={s * 0.16} strokeLinecap="round" />
          <line x1={s * 0.5} y1={-s * 0.55} x2={s * 0.7} y2={-s * 1.15} stroke={body} strokeWidth={s * 0.16} strokeLinecap="round" />
          <circle cx={-s * 0.7} cy={-s * 1.15} r={s * 0.1} fill={accent} />
          <circle cx={s * 0.7} cy={-s * 1.15} r={s * 0.1} fill={accent} />
          {/* status dots */}
          <circle cx={-s * 0.6} cy={0} r={s * 0.1} fill={accent} />
          <circle cx={-s * 0.2} cy={0} r={s * 0.1} fill={accent} opacity={0.6} />
          <circle cx={s * 0.2} cy={0} r={s * 0.1} fill={accent} opacity={0.6} />
          <circle cx={s * 0.6} cy={0} r={s * 0.1} fill={accent} opacity={0.6} />
        </g>
      );

    case "PRINTER":
      return (
        <g>
          <rect x={-s * 0.62} y={-s * 0.95} width={s * 1.24} height={s * 0.42} fill={body} />
          <rect x={-s} y={-s * 0.5} width={s * 2} height={s * 1} rx={s * 0.1} fill={body} />
          <rect x={-s * 0.7} y={-s * 0.14} width={s * 1.4} height={s * 0.2} fill={accent} />
          <rect x={-s * 0.55} y={s * 0.5} width={s * 1.1} height={s * 0.16} fill={body} opacity={0.85} />
        </g>
      );

    case "AP":
      return (
        <g>
          <rect x={-s * 0.85} y={-s * 0.2} width={s * 1.7} height={s * 0.5} rx={s * 0.25} fill={body} />
          <path d={`M ${-s * 0.85} ${-s * 0.35} Q 0 ${-s * 1.15} ${s * 0.85} ${-s * 0.35}`} stroke={accent} strokeWidth={s * 0.14} fill="none" strokeLinecap="round" />
          <path d={`M ${-s * 0.55} ${-s * 0.35} Q 0 ${-s * 0.8} ${s * 0.55} ${-s * 0.35}`} stroke={accent} strokeWidth={s * 0.14} fill="none" strokeLinecap="round" opacity={0.7} />
          <circle cx={0} cy={0} r={s * 0.09} fill={accent} />
        </g>
      );

    case "WEBCAM":
      return (
        <g>
          <circle r={s * 0.62} fill={body} />
          <circle r={s * 0.34} fill={accent} />
          <circle r={s * 0.12} fill={body} />
          <rect x={-s * 0.12} y={s * 0.55} width={s * 0.24} height={s * 0.3} fill={body} />
        </g>
      );

    case "LAPTOP":
      return (
        <g>
          {/* base */}
          <path d={`M ${-s * 0.95} ${s * 0.15} L ${s * 0.95} ${s * 0.15} L ${s * 0.75} ${s * 0.4} L ${-s * 0.75} ${s * 0.4} Z`} fill={body} />
          {/* screen */}
          <rect x={-s * 0.72} y={-s * 0.95} width={s * 1.44} height={s * 1.1} rx={s * 0.08} fill={body} />
          <rect x={-s * 0.58} y={-s * 0.81} width={s * 1.16} height={s * 0.82} fill={accent} opacity={0.9} />
          {/* mini chart on screen */}
          <polyline
            points={`${-s * 0.42},${-s * 0.15} ${-s * 0.16},${-s * 0.45} ${s * 0.08},${-s * 0.28} ${s * 0.4},${-s * 0.58}`}
            fill="none"
            stroke={body}
            strokeWidth={s * 0.09}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case "SMARTPHONE":
      return (
        <g>
          <rect x={-s * 0.42} y={-s * 0.85} width={s * 0.84} height={s * 1.7} rx={s * 0.16} fill={body} />
          <rect x={-s * 0.32} y={-s * 0.68} width={s * 0.64} height={s * 1.22} fill={accent} opacity={0.9} />
          <rect x={-s * 0.14} y={s * 0.62} width={s * 0.28} height={s * 0.06} rx={s * 0.03} fill={edge} opacity={0.6} />
        </g>
      );

    case "MEDIACONVERTER":
      return (
        <g>
          <rect x={-s * 0.95} y={-s * 0.4} width={s * 1.9} height={s * 0.8} rx={s * 0.1} fill={body} />
          <rect x={-s * 0.75} y={-s * 0.14} width={s * 0.4} height={s * 0.28} fill={accent} />
          <rect x={s * 0.35} y={-s * 0.14} width={s * 0.4} height={s * 0.28} fill={accent} />
          <line x1={-s * 0.3} y1={0} x2={s * 0.3} y2={0} stroke={accent} strokeWidth={s * 0.08} opacity={0.6} />
        </g>
      );

    case "CONTROLLER":
      return (
        <g>
          <rect x={-s * 0.85} y={-s * 0.85} width={s * 1.7} height={s * 1.7} rx={s * 0.18} fill={body} />
          <rect x={-s * 0.42} y={-s * 0.42} width={s * 0.84} height={s * 0.84} rx={s * 0.1} fill={accent} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => (
            <circle key={`${dx}-${dy}`} cx={dx * s * 0.68} cy={dy * s * 0.68} r={s * 0.08} fill={accent} />
          ))}
        </g>
      );
  }
}
