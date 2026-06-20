// src/components/AnimatedExamples/BrandingDemo.tsx
import { motion } from "framer-motion";
import ExampleFrame from "./ExampleFrame";

const BLUE_ACCENT = "#0ea5e9";
const SKY_BLUE = "#38bdf8";

// Concentric circle radii for the Brand Core network
const concentricRadii = [35, 55, 75, 95, 115];

// Connection paths between peripheral capsules and the center core (180, 130)
const PATH_VISUAL = "M 96,85 C 96,120 130,130 180,130";
const PATH_MESSAGING = "M 180,185 C 180,165 180,150 180,130";
const PATH_POSITIONING = "M 264,85 C 264,120 230,130 180,130";

// Structured Concentric & Radial Dot Network (Deterministic for hydration safety)
interface NetworkDot {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

const RINGS = [
  { r: 35, count: 18, dotSize: 0.9, baseOpacity: 0.55 },
  { r: 55, count: 32, dotSize: 1.1, baseOpacity: 0.45 },
  { r: 75, count: 48, dotSize: 0.9, baseOpacity: 0.35 },
  { r: 95, count: 64, dotSize: 0.7, baseOpacity: 0.25 },
  { r: 115, count: 80, dotSize: 0.6, baseOpacity: 0.15 },
];

const ORBIT_DOTS: NetworkDot[] = RINGS.flatMap((ring, ringIdx) => {
  return Array.from({ length: ring.count }, (_, idx) => {
    const angle = (idx / ring.count) * Math.PI * 2;
    // Introduce deterministic noise based on math to keep the network organic
    const seed = ringIdx * 13 + idx * 7.7;
    const noise = Math.sin(seed) * 0.015;
    const cx = 180 + Math.cos(angle + noise) * ring.r;
    const cy = 130 + Math.sin(angle + noise) * ring.r;
    return {
      cx,
      cy,
      r: ring.dotSize + (Math.abs(Math.sin(seed * 2)) * 0.3),
      opacity: ring.baseOpacity + (Math.abs(Math.cos(seed * 3)) * 0.1),
    };
  });
});

// Structural grid lines to connect adjacent dots on the inner rings
interface ConstellationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

const CONSTELLATION_LINES: ConstellationLine[] = [];

RINGS.forEach((ring, ringIdx) => {
  if (ringIdx > 3) return; // Only interconnect inner rings to preserve clean density
  // Connect every 4th dot to form a structural web outline
  for (let i = 0; i < ring.count; i += 4) {
    const angle1 = (i / ring.count) * Math.PI * 2;
    const angle2 = (((i + 4) % ring.count) / ring.count) * Math.PI * 2;

    const x1 = 180 + Math.cos(angle1) * ring.r;
    const y1 = 130 + Math.sin(angle1) * ring.r;
    const x2 = 180 + Math.cos(angle2) * ring.r;
    const y2 = 130 + Math.sin(angle2) * ring.r;

    CONSTELLATION_LINES.push({
      x1,
      y1,
      x2,
      y2,
      opacity: (0.6 - ringIdx * 0.12) * 0.16, // fading out on outer rings
    });
  }
});

// Radial axes / spokes connecting the center to the edge of the network
const RADIAL_SPOKES = Array.from({ length: 8 }, (_, idx) => {
  const angle = (idx / 8) * Math.PI * 2;
  const x1 = 180 + Math.cos(angle) * 20;
  const y1 = 130 + Math.sin(angle) * 20;
  const x2 = 180 + Math.cos(angle) * 125;
  const y2 = 130 + Math.sin(angle) * 125;
  return { x1, y1, x2, y2 };
});

interface Props {
  className?: string;
}

export default function BrandingDemo({ className = "" }: Props) {
  return (
    <ExampleFrame label="Animation: High-performance Brand Core visual system" className={className}>
      {/* Background with multiple cyan/electric blue radial glows and a rich dark navy base */}
      <div
        className="absolute inset-0 bg-[#060814]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 180px 130px, rgba(14, 165, 233, 0.32) 0%, rgba(2, 132, 199, 0.12) 50%, rgba(6, 8, 20, 0) 85%),
            radial-gradient(circle at 80px 80px, rgba(6, 182, 212, 0.16) 0%, rgba(6, 182, 212, 0) 60%),
            radial-gradient(circle at 280px 180px, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0) 60%)
          `,
        }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Faint grid pattern */}
          <pattern id="br-blueprint-grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.8" />
          </pattern>
          
          {/* Intense glow for pulsing nodes and light particles */}
          <filter id="br-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Technical Grid Overlay */}
        <rect width="360" height="260" fill="url(#br-blueprint-grid)" />

        {/* Central Core Crosshairs */}
        <g stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.8">
          {/* Horizontal axis */}
          <line x1="20" y1="130" x2="340" y2="130" strokeDasharray="3 9" />
          {/* Vertical axis */}
          <line x1="180" y1="20" x2="180" y2="240" strokeDasharray="3 9" />
        </g>

        {/* --- Rotating Brand System Dot & Constellation Mesh (Background Layer) --- */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 75, repeat: Infinity, ease: "linear" }}
          style={{ originX: "180px", originY: "130px" }}
        >
          {/* Concentric rings guidelines */}
          {concentricRadii.map((r, idx) => (
            <circle
              key={`ring-line-${idx}`}
              cx="180"
              cy="130"
              r={r}
              fill="none"
              stroke={SKY_BLUE}
              strokeWidth="0.8"
              strokeOpacity={0.12 - idx * 0.02}
              strokeDasharray={idx % 2 === 1 ? "3 6" : undefined}
            />
          ))}

          {/* Radial Spokes / Alignment guides */}
          {RADIAL_SPOKES.map((spoke, idx) => (
            <line
              key={`spoke-${idx}`}
              x1={spoke.x1}
              y1={spoke.y1}
              x2={spoke.x2}
              y2={spoke.y2}
              stroke={SKY_BLUE}
              strokeWidth="0.6"
              strokeOpacity="0.08"
              strokeDasharray="2 5"
            />
          ))}

          {/* Blueprint Constellation lines */}
          {CONSTELLATION_LINES.map((line, idx) => (
            <line
              key={`c-line-${idx}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={SKY_BLUE}
              strokeWidth="0.6"
              strokeOpacity={line.opacity}
            />
          ))}

          {/* Dense Dot Cloud */}
          {ORBIT_DOTS.map((dot, idx) => (
            <circle
              key={`dot-${idx}`}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={SKY_BLUE}
              fillOpacity={dot.opacity}
            />
          ))}
        </motion.g>

        {/* --- Intelligent connection paths (Foreground Layer, Static) --- */}
        <g>
          {/* Background paths for depth */}
          <path d={PATH_VISUAL} fill="none" stroke={BLUE_ACCENT} strokeWidth="1.6" strokeOpacity="0.08" />
          <path d={PATH_MESSAGING} fill="none" stroke={BLUE_ACCENT} strokeWidth="1.6" strokeOpacity="0.08" />
          <path d={PATH_POSITIONING} fill="none" stroke={BLUE_ACCENT} strokeWidth="1.6" strokeOpacity="0.08" />

          {/* High contrast dashed paths */}
          <path d={PATH_VISUAL} fill="none" stroke={BLUE_ACCENT} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
          <path d={PATH_MESSAGING} fill="none" stroke={BLUE_ACCENT} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
          <path d={PATH_POSITIONING} fill="none" stroke={BLUE_ACCENT} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
        </g>

        {/* --- Slow moving glowing light particles along connection paths --- */}
        <circle r="2.2" fill="#ffffff" filter="url(#br-glow-blue)">
          <animateMotion dur="4.5s" repeatCount="indefinite" path={PATH_VISUAL} />
        </circle>
        <circle r="2.2" fill="#ffffff" filter="url(#br-glow-blue)">
          <animateMotion dur="3.8s" repeatCount="indefinite" path={PATH_MESSAGING} />
        </circle>
        <circle r="2.2" fill="#ffffff" filter="url(#br-glow-blue)">
          <animateMotion dur="4.9s" repeatCount="indefinite" path={PATH_POSITIONING} />
        </circle>

        {/* --- Pulsing nodes at path endpoints --- */}
        {/* Node 1: Visual Identity */}
        <motion.circle
          cx="96"
          cy="85"
          r="3"
          fill="#ffffff"
          filter="url(#br-glow-blue)"
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Node 2: Messaging */}
        <motion.circle
          cx="180"
          cy="185"
          r="3"
          fill="#ffffff"
          filter="url(#br-glow-blue)"
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        />
        {/* Node 3: Positioning */}
        <motion.circle
          cx="264"
          cy="85"
          r="3"
          fill="#ffffff"
          filter="url(#br-glow-blue)"
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
        />

        {/* --- Blueprint Spec Overlays (Typography - Bottom-Left) --- */}
        <g transform="translate(10, 0)">
          {/* Grid lines / baseline specs */}
          <line x1="30" y1="213" x2="85" y2="213" stroke="rgba(56, 189, 248, 0.2)" strokeDasharray="1.5 1.5" />
          <line x1="30" y1="223" x2="85" y2="223" stroke="rgba(56, 189, 248, 0.2)" strokeDasharray="1.5 1.5" />
          <line x1="30" y1="235" x2="85" y2="235" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="0.8" />
          
          {/* Tiny spec labels */}
          <text x="88" y="215" fontSize="4.5" fill="rgba(56, 189, 248, 0.4)" fontFamily="monospace">CAP</text>
          <text x="88" y="225" fontSize="4.5" fill="rgba(56, 189, 248, 0.4)" fontFamily="monospace">X-H</text>
          <text x="88" y="237" fontSize="4.5" fill="rgba(56, 189, 248, 0.5)" fontFamily="monospace">BASE</text>

          {/* Large typography glyphs */}
          <text x="35" y="235" fontSize="24" fontFamily="Georgia, serif" fill="#ffffff" fillOpacity="0.85" fontWeight="normal">A</text>
          <text x="59" y="235" fontSize="20" fontFamily="system-ui, -apple-system, sans-serif" fill="#38bdf8" fillOpacity="0.85" fontWeight="bold">a</text>

          {/* Compass layout curves on lowercase 'a' */}
          <circle cx="68" cy="227" r="7.5" fill="none" stroke="rgba(6, 182, 212, 0.22)" strokeWidth="0.6" strokeDasharray="1 1.5" />
          {/* Small angle indicator line */}
          <line x1="68" y1="227" x2="74" y2="221" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="0.6" />
        </g>

        {/* --- Blueprint Spec Overlays (Golden Ratio Geometry - Bottom-Right) --- */}
        <g>
          {/* Concentric Fib circles */}
          <circle cx="282" cy="224" r="21" fill="none" stroke="rgba(56, 189, 248, 0.24)" strokeWidth="0.8" />
          <circle cx="274" cy="224" r="13" fill="none" stroke="rgba(56, 189, 248, 0.24)" strokeWidth="0.8" />
          <circle cx="288" cy="224" r="8" fill="none" stroke="rgba(56, 189, 248, 0.24)" strokeWidth="0.8" />

          {/* Compass layout line */}
          <line x1="245" y1="261" x2="315" y2="191" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="0.6" strokeDasharray="2 2" />
          <line x1="245" y1="191" x2="315" y2="261" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="0.6" strokeDasharray="2 2" />

          {/* Spec values */}
          <text x="282" y="252" fontSize="5" textAnchor="middle" fill="rgba(56, 189, 248, 0.45)" fontFamily="monospace">R = 1.618</text>
          <text x="312" y="196" fontSize="4.5" textAnchor="start" fill="rgba(56, 189, 248, 0.4)" fontFamily="monospace">45.0°</text>
        </g>

        {/* --- Technical Ruler/Scale (Bottom edge) --- */}
        <g>
          <line x1="20" y1="250" x2="340" y2="250" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.8" />
          {Array.from({ length: 33 }, (_, i) => {
            const x = 20 + i * 10;
            const isMajor = i % 5 === 0;
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={x}
                  y1="250"
                  x2={x}
                  y2={isMajor ? "254" : "252"}
                  stroke="rgba(56, 189, 248, 0.14)"
                  strokeWidth="0.8"
                />
                {isMajor && (
                  <text
                    x={x}
                    y="259"
                    fontSize="4"
                    fill="rgba(56, 189, 248, 0.35)"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {x}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* --- Floating Glassmorphic Capsules (Foreground Layer) --- */}
        
        {/* Brand Core Label Tag (Center) */}
        <g>
          {/* Glow filter behind capsule */}
          <rect x="140" y="120" width="80" height="20" rx="10" fill="rgba(9, 15, 28, 0.9)" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" />
          {/* Pulsing Accent Indicator Dot */}
          <circle cx="153" cy="130" r="2.5" fill="#ffffff" filter="url(#br-glow-blue)" />
          <motion.circle
            cx="153"
            cy="130"
            r="2.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.5"
            animate={{ scale: [1, 2.4, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <text x="186" y="130" fontSize="7" fill="#ffffff" fontWeight="700" textAnchor="middle" dominantBaseline="central" letterSpacing="0.08em" fontFamily="system-ui, -apple-system, sans-serif">BRAND CORE</text>
        </g>

        {/* Visual Identity Capsule (Top-Left) */}
        <motion.g
          animate={{ y: [0, -2.5, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="54" y="65" width="84" height="20" rx="10" fill="rgba(8, 14, 27, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          {/* Indigo indicator dot */}
          <circle cx="67" cy="75" r="2.2" fill="#818cf8" filter="url(#br-glow-blue)" />
          <text x="98" y="75" fontSize="6.5" fill="rgba(255, 255, 255, 0.9)" fontWeight="600" textAnchor="middle" dominantBaseline="central" letterSpacing="0.06em" fontFamily="system-ui, -apple-system, sans-serif">VISUAL IDENTITY</text>
        </motion.g>

        {/* Messaging Capsule (Bottom-Center) */}
        <motion.g
          animate={{ y: [0, -2.5, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        >
          <rect x="138" y="185" width="84" height="20" rx="10" fill="rgba(8, 14, 27, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          {/* Emerald indicator dot */}
          <circle cx="151" cy="195" r="2.2" fill="#34d399" filter="url(#br-glow-blue)" />
          <text x="182" y="195" fontSize="6.5" fill="rgba(255, 255, 255, 0.9)" fontWeight="600" textAnchor="middle" dominantBaseline="central" letterSpacing="0.06em" fontFamily="system-ui, -apple-system, sans-serif">MESSAGING</text>
        </motion.g>

        {/* Positioning Capsule (Top-Right) */}
        <motion.g
          animate={{ y: [0, -2.5, 0] }}
          transition={{ duration: 5.0, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
        >
          <rect x="222" y="65" width="84" height="20" rx="10" fill="rgba(8, 14, 27, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          {/* Cyan indicator dot */}
          <circle cx="235" cy="75" r="2.2" fill="#22d3ee" filter="url(#br-glow-blue)" />
          <text x="266" y="75" fontSize="6.5" fill="rgba(255, 255, 255, 0.9)" fontWeight="600" textAnchor="middle" dominantBaseline="central" letterSpacing="0.06em" fontFamily="system-ui, -apple-system, sans-serif">POSITIONING</text>
        </motion.g>
      </svg>
    </ExampleFrame>
  );
}
