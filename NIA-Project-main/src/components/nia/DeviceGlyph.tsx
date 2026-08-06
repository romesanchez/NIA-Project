import type { DeviceType } from "@/data/departments";

export const DEVICE_LABELS: Record<DeviceType, string> = {
  PC: "PC", SERVER: "SRV", SWITCH: "SW", ROUTER: "RTR", PRINTER: "PRN", AP: "AP",
  WEBCAM: "CAM", LAPTOP: "LPT", SMARTPHONE: "PHN", MEDIACONVERTER: "MDC", CONTROLLER: "CTL",
  SATELLITE: "SAT",
};

/** Full, human-readable device names — used anywhere space allows a real
 * label instead of the compact chip abbreviation above (e.g. the device
 * picker in the floor plan editor). */
export const DEVICE_FULL_LABELS: Record<DeviceType, string> = {
  PC: "PC", SERVER: "Server", SWITCH: "Switch", ROUTER: "Router", PRINTER: "Printer", AP: "Access Point",
  WEBCAM: "Webcam", LAPTOP: "Laptop", SMARTPHONE: "Smartphone", MEDIACONVERTER: "Media Converter", CONTROLLER: "Controller",
  SATELLITE: "Satellite Transceiver",
};

interface Props {
  type: DeviceType;
  size?: number;
  /** primary "chassis" color — defaults to Cisco-style icon blue */
  body?: string;
  /** highlight / accent (arrows, waves, ports, LEDs) — defaults to white so it
   * reads clearly against the blue chassis, matching classic network-diagram
   * stencil icons (Router / Switch / PC / Server, etc.) */
  accent?: string;
  /** thin edge lines between panels */
  edge?: string;
}

/**
 * Cisco-style network-diagram glyphs — a blue "chassis" silhouette with a
 * white pictogram on top (routing arrows, switch data-flow arrows, wifi
 * waves, drive bays, etc.), the same visual language as the classic
 * Cisco/Visio network stencil icon set. Drawn on a -s..s coordinate box so
 * they drop straight into the topology canvas, floor plan, and 3D labels at
 * any size — every screen that renders <DeviceGlyph> picks this up
 * automatically.
 */
export function DeviceGlyph({
  type,
  size = 14,
  body = "#0D8ECF",
  accent = "#FFFFFF",
  edge = "var(--color-background)",
}: Props) {
  const s = size;

  switch (type) {
    case "PC":
      return (
        <g>
          {/* monitor */}
          <rect x={-s} y={-s * 0.85} width={s * 2} height={s * 1.3} rx={s * 0.12} fill={body} />
          <rect x={-s * 0.82} y={-s * 0.67} width={s * 1.64} height={s * 0.94} fill={accent} opacity={0.92} />
          <rect x={-s * 0.7} y={-s * 0.55} width={s * 1.4} height={s * 0.1} fill={body} opacity={0.35} />
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
              <rect x={-s * 0.58} y={s * k - s * 0.14} width={s * 0.86} height={s * 0.22} rx={s * 0.03} fill={accent} opacity={0.16} />
              <circle cx={s * 0.45} cy={s * k} r={s * 0.08} fill={accent} />
            </g>
          ))}
        </g>
      );

    case "SWITCH":
      // Cisco "workgroup switch" motif: a flattened chassis with two
      // opposing horizontal data-flow arrows running through it.
      return (
        <g>
          <rect x={-s * 1.35} y={-s * 0.5} width={s * 2.7} height={s * 1} rx={s * 0.12} fill={body} />
          <path
            d={`M ${-s * 1.05} ${-s * 0.16} H ${s * 0.75} L ${s * 0.5} ${-s * 0.36} M ${s * 0.75} ${-s * 0.16} L ${s * 0.5} ${s * 0.04}`}
            fill="none" stroke={accent} strokeWidth={s * 0.12} strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d={`M ${s * 1.05} ${s * 0.16} H ${-s * 0.75} L ${-s * 0.5} ${-s * 0.04} M ${-s * 0.75} ${s * 0.16} L ${-s * 0.5} ${s * 0.36}`}
            fill="none" stroke={accent} strokeWidth={s * 0.12} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}
          />
        </g>
      );

    case "ROUTER":
      // Cisco router motif: rounded chassis with a circular routing-flow
      // arrow across the top face instead of literal antennas.
      return (
        <g>
          <rect x={-s * 1.05} y={-s * 0.6} width={s * 2.1} height={s * 1.2} rx={s * 0.3} fill={body} />
          <path
            d={`M ${-s * 0.55} ${-s * 0.02} A ${s * 0.55} ${s * 0.3} 0 1 1 ${s * 0.15} ${-s * 0.28}`}
            fill="none" stroke={accent} strokeWidth={s * 0.13} strokeLinecap="round"
          />
          <polygon points={`${s * 0.15},${-s * 0.28} ${s * 0.32},${-s * 0.34} ${s * 0.22},${-s * 0.12}`} fill={accent} />
          <path
            d={`M ${s * 0.55} ${s * 0.16} A ${s * 0.55} ${s * 0.3} 0 1 1 ${-s * 0.15} ${s * 0.42}`}
            fill="none" stroke={accent} strokeWidth={s * 0.13} strokeLinecap="round" opacity={0.85}
          />
          <polygon points={`${-s * 0.15},${s * 0.42} ${-s * 0.32},${s * 0.48} ${-s * 0.22},${s * 0.26}`} fill={accent} opacity={0.85} />
        </g>
      );

    case "PRINTER":
      return (
        <g>
          <rect x={-s * 0.62} y={-s * 0.95} width={s * 1.24} height={s * 0.42} fill={body} />
          <rect x={-s} y={-s * 0.5} width={s * 2} height={s * 1} rx={s * 0.1} fill={body} />
          <rect x={-s * 0.7} y={-s * 0.14} width={s * 1.4} height={s * 0.2} fill={accent} opacity={0.95} />
          <rect x={-s * 0.55} y={s * 0.5} width={s * 1.1} height={s * 0.16} fill={body} opacity={0.85} />
          <circle cx={s * 0.7} cy={-s * 0.15} r={s * 0.07} fill={accent} />
        </g>
      );

    case "AP":
      // Access-point motif: router-style chassis with two antennas and
      // wifi waves rising above, matching the reference icon.
      return (
        <g>
          {/* wifi waves, offset above and between the antennas */}
          <g transform={`translate(0, ${-s * 1.15})`}>
            <path d={`M ${-s * 0.5} ${-s * 0.02} Q 0 ${-s * 0.62} ${s * 0.5} ${-s * 0.02}`} stroke={accent} strokeWidth={s * 0.16} fill="none" strokeLinecap="round" />
            <path d={`M ${-s * 0.3} ${s * 0.08} Q 0 ${-s * 0.28} ${s * 0.3} ${s * 0.08}`} stroke={accent} strokeWidth={s * 0.16} fill="none" strokeLinecap="round" />
            <circle cx={0} cy={s * 0.28} r={s * 0.11} fill={accent} />
          </g>

          {/* antennas */}
          <rect x={-s * 0.92} y={-s * 0.62} width={s * 0.18} height={s * 0.66} rx={s * 0.09} fill={body} />
          <rect x={s * 0.74} y={-s * 0.62} width={s * 0.18} height={s * 0.66} rx={s * 0.09} fill={body} />

          {/* router chassis */}
          <rect x={-s} y={s * 0.05} width={s * 2} height={s * 0.58} rx={s * 0.12} fill={body} />
          <rect x={-s * 0.78} y={s * 0.16} width={s * 1.56} height={s * 0.36} fill={accent} opacity={0.9} />
          <circle cx={s * 0.42} cy={s * 0.34} r={s * 0.08} fill={body} />
          <circle cx={s * 0.66} cy={s * 0.34} r={s * 0.08} fill={body} />
        </g>
      );

    case "WEBCAM":
      return (
        <g>
          <circle r={s * 0.62} fill={body} />
          <circle r={s * 0.34} fill={accent} opacity={0.95} />
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
          <rect x={-s * 0.58} y={-s * 0.81} width={s * 1.16} height={s * 0.82} fill={accent} opacity={0.92} />
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
          <rect x={-s * 0.32} y={-s * 0.68} width={s * 0.64} height={s * 1.22} fill={accent} opacity={0.92} />
          <rect x={-s * 0.14} y={s * 0.62} width={s * 0.28} height={s * 0.06} rx={s * 0.03} fill={edge} opacity={0.6} />
        </g>
      );

    case "MEDIACONVERTER":
      return (
        <g>
          <rect x={-s * 0.95} y={-s * 0.4} width={s * 1.9} height={s * 0.8} rx={s * 0.1} fill={body} />
          <rect x={-s * 0.75} y={-s * 0.14} width={s * 0.4} height={s * 0.28} fill={accent} />
          <rect x={s * 0.35} y={-s * 0.14} width={s * 0.4} height={s * 0.28} fill={accent} />
          <line x1={-s * 0.3} y1={0} x2={s * 0.3} y2={0} stroke={accent} strokeWidth={s * 0.08} opacity={0.7} />
        </g>
      );

    case "CONTROLLER":
      // Cisco "system controller" motif: a central hub with three managed
      // nodes fanning out, instead of a plain grid of dots.
      return (
        <g>
          <rect x={-s * 0.4} y={-s * 0.4} width={s * 0.8} height={s * 0.8} rx={s * 0.14} fill={body} />
          {[[-1, -0.85], [1, -0.85], [0, 0.95]].map(([dx, dy], i) => (
            <g key={i}>
              <line x1={0} y1={0} x2={dx * s * 0.85} y2={dy * s * 0.72} stroke={body} strokeWidth={s * 0.1} strokeLinecap="round" />
              <circle cx={dx * s * 0.85} cy={dy * s * 0.72} r={s * 0.16} fill={body} />
            </g>
          ))}
          <rect x={-s * 0.16} y={-s * 0.16} width={s * 0.32} height={s * 0.32} rx={s * 0.06} fill={accent} />
        </g>
      );
    case "SATELLITE":
      // Satellite dish / transmitter-receiver motif: parabolic dish on a
      // pedestal stand, with a feed-horn arm and outgoing signal waves —
      // matching the reference glyph (dish + arm + wifi-style arcs).
      return (
        <g>
          {/* stand */}
          <rect x={-s * 0.3} y={s * 0.58} width={s * 0.6} height={s * 0.14} rx={s * 0.04} fill={body} />
          <rect x={-s * 0.09} y={s * 0.16} width={s * 0.18} height={s * 0.44} fill={body} />

          {/* dish (tilted parabolic reflector) */}
          <ellipse
            cx={-s * 0.18} cy={-s * 0.02} rx={s * 0.82} ry={s * 0.48}
            fill={body}
            transform={`rotate(-24 ${-s * 0.18} ${-s * 0.02})`}
          />
          <ellipse
            cx={-s * 0.1} cy={-s * 0.02} rx={s * 0.46} ry={s * 0.24}
            fill={edge} opacity={0.22}
            transform={`rotate(-24 ${-s * 0.1} ${-s * 0.02})`}
          />

          {/* feed arm + horn */}
          <line x1={-s * 0.05} y1={-s * 0.1} x2={s * 0.58} y2={-s * 0.62} stroke={body} strokeWidth={s * 0.1} strokeLinecap="round" />
          <circle cx={s * 0.58} cy={-s * 0.62} r={s * 0.11} fill={body} />

          {/* outgoing signal waves */}
          <path d={`M ${s * 0.68} ${-s * 0.8} Q ${s * 0.92} ${-s * 1.02} ${s * 1.14} ${-s * 0.82}`} stroke={accent} strokeWidth={s * 0.11} fill="none" strokeLinecap="round" />
          <path d={`M ${s * 0.78} ${-s * 0.92} Q ${s * 0.95} ${-s * 1.06} ${s * 1.06} ${-s * 0.96}`} stroke={accent} strokeWidth={s * 0.11} fill="none" strokeLinecap="round" opacity={0.85} />
        </g>
      );
  }
}