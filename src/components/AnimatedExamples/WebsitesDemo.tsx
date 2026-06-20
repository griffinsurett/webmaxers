// src/components/AnimatedExamples/WebsitesDemo.tsx
import { motion } from "framer-motion";
import ExampleFrame from "./ExampleFrame";

// Pathway coordinates converging along the bottom-left and bottom-right edges
// of the central WEBSITE hexagon (cx=180, cy=168, R=40).
// Bottom vertex is (180, 208), bottom-left is (145.36, 188), bottom-right is (214.64, 188).
const PATHS_DATA = [
  { p0: [35, 260],  p1: [35, 235],  p2: [110, 201], p3: [150, 191] },
  { p0: [70, 260],  p1: [70, 235],  p2: [122, 203], p3: [157.5, 195] },
  { p0: [105, 260], p1: [105, 235], p2: [135, 205], p3: [165, 199] },
  { p0: [140, 260], p1: [140, 235], p2: [155, 207], p3: [172.5, 204] },
  { p0: [180, 260], p1: [180, 240], p2: [180, 213], p3: [180, 208] }, // center vertical
  { p0: [220, 260], p1: [220, 235], p2: [205, 207], p3: [187.5, 204] },
  { p0: [255, 260], p1: [255, 235], p2: [225, 205], p3: [195, 199] },
  { p0: [290, 260], p1: [290, 235], p2: [238, 203], p3: [202.5, 195] },
  { p0: [325, 260], p1: [325, 235], p2: [250, 201], p3: [210, 191] },
];

const getHexPoints = (cx: number, cy: number, r: number) => {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    points.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
};

// Generates paths for 3D bevel split-lighting
const getBevelPaths = (cx: number, cy: number, r: number) => {
  const w = r * Math.cos(Math.PI / 6);
  const h = r / 2;
  return {
    // Left half (highly lit under top-left light source)
    highlight: `M ${cx.toFixed(1)},${(cy + r).toFixed(1)} L ${(cx - w).toFixed(1)},${(cy + h).toFixed(1)} L ${(cx - w).toFixed(1)},${(cy - h).toFixed(1)} L ${cx.toFixed(1)},${(cy - r).toFixed(1)}`,
    // Right half (shadowed face away from light source)
    shadow: `M ${cx.toFixed(1)},${(cy - r).toFixed(1)} L ${(cx + w).toFixed(1)},${(cy - h).toFixed(1)} L ${(cx + w).toFixed(1)},${(cy + h).toFixed(1)} L ${cx.toFixed(1)},${(cy + r).toFixed(1)}`
  };
};

const getBezierPoint = (
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
) => {
  const x =
    Math.pow(1 - t, 3) * p0[0] +
    3 * Math.pow(1 - t, 2) * t * p1[0] +
    3 * (1 - t) * Math.pow(t, 2) * p2[0] +
    Math.pow(t, 3) * p3[0];
  const y =
    Math.pow(1 - t, 3) * p0[1] +
    3 * Math.pow(1 - t, 2) * t * p1[1] +
    3 * (1 - t) * Math.pow(t, 2) * p2[1] +
    Math.pow(t, 3) * p3[1];
  return { x, y };
};

interface Props {
  className?: string;
}

export default function WebsitesDemo({ className = "" }: Props) {
  // 12 data nodes along the pathways
  const dataNodes = [
    { pathIdx: 0, t: 0.35, r: 2.6, isPulsing: true },
    { pathIdx: 0, t: 0.72, r: 1.8, isPulsing: false },
    { pathIdx: 1, t: 0.52, r: 2.0, isPulsing: false },
    { pathIdx: 2, t: 0.30, r: 2.8, isPulsing: true },
    { pathIdx: 2, t: 0.68, r: 1.8, isPulsing: false },
    { pathIdx: 3, t: 0.45, r: 2.0, isPulsing: false },
    { pathIdx: 5, t: 0.45, r: 2.0, isPulsing: false },
    { pathIdx: 6, t: 0.30, r: 2.8, isPulsing: true },
    { pathIdx: 6, t: 0.68, r: 1.8, isPulsing: false },
    { pathIdx: 7, t: 0.52, r: 2.0, isPulsing: false },
    { pathIdx: 8, t: 0.35, r: 2.6, isPulsing: true },
    { pathIdx: 8, t: 0.72, r: 1.8, isPulsing: false },
  ];

  return (
    <ExampleFrame label="Animation: Modern high-performance web interface" className={className}>
      {/* Rich purple/indigo gradient background with soft ambient lighting */}
      <div
        className="absolute inset-0 bg-[#0d051c]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 180px 150px, rgba(147, 51, 234, 0.42) 0%, rgba(88, 28, 135, 0.16) 50%, rgba(13, 5, 28, 0) 85%),
            radial-gradient(circle at 180px 0px, rgba(192, 132, 252, 0.22) 0%, rgba(192, 132, 252, 0) 65%)
          `,
        }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Subtle dot grid pattern */}
          <pattern id="ws-dot-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#c084fc" fillOpacity="0.12" />
          </pattern>

          {/* Fade mask for grid pattern */}
          <linearGradient id="ws-grid-mask-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <mask id="ws-grid-mask">
            <rect width="360" height="260" fill="url(#ws-grid-mask-grad)" />
          </mask>

          {/* Paths Stroke Linear Gradient: More vivid purple/pink convergence */}
          <linearGradient id="ws-path-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#d8b4fe" stopOpacity="0.75" />
          </linearGradient>

          {/* Hexagon Drop Shadow for 3D depth */}
          <filter id="ws-hex-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#04020a" floodOpacity="0.85" />
          </filter>

          {/* Icon drop shadow filter to look solid and physically raised */}
          <filter id="ws-icon-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.55" />
          </filter>

          {/* Central hexagon intense glow filter */}
          <filter id="ws-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Hexagon Fill Gradients */}
          <linearGradient id="ws-hex-fill-main" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#581c87" />
            <stop offset="100%" stopColor="#2e1065" />
          </linearGradient>

          <linearGradient id="ws-hex-fill-sub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>

        {/* --- Micro-Detail: Dotted Grid Texture (Upper Left) --- */}
        <rect x="12" y="12" width="160" height="140" fill="url(#ws-dot-grid)" mask="url(#ws-grid-mask)" />

        {/* --- Infrastructure Pathways: Bold & Curving Ribbons --- */}
        <g fill="none" strokeLinecap="round">
          {/* Main thick pathways (strokeWidth=9.5 for maximum weight) */}
          {PATHS_DATA.map((path, idx) => (
            <path
              key={`path-thick-${idx}`}
              d={`M ${path.p0[0]},${path.p0[1]} C ${path.p1[0]},${path.p1[1]} ${path.p2[0]},${path.p2[1]} ${path.p3[0]},${path.p3[1]}`}
              stroke="url(#ws-path-grad)"
              strokeWidth="9.5"
              opacity="0.48"
            />
          ))}

          {/* High-intensity inner core data fiber lines */}
          {PATHS_DATA.map((path, idx) => (
            <path
              key={`path-core-${idx}`}
              d={`M ${path.p0[0]},${path.p0[1]} C ${path.p1[0]},${path.p1[1]} ${path.p2[0]},${path.p2[1]} ${path.p3[0]},${path.p3[1]}`}
              stroke="#f5f3ff"
              strokeWidth="1.6"
              opacity="0.8"
              strokeDasharray={idx % 2 === 1 ? "4 8" : undefined}
            />
          ))}
        </g>

        {/* --- Glowing Layered Data Nodes --- */}
        {dataNodes.map((node, idx) => {
          const path = PATHS_DATA[node.pathIdx];
          const pt = getBezierPoint(node.t, path.p0 as any, path.p1 as any, path.p2 as any, path.p3 as any);
          return (
            <g key={`data-node-${idx}`}>
              {node.isPulsing ? (
                <>
                  {/* Layer 1: Outer glow */}
                  <motion.circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9.5"
                    fill="none"
                    stroke="#e9d5ff"
                    strokeWidth="1.2"
                    animate={{ scale: [0.9, 1.8, 0.9], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: idx * 0.3 }}
                  />
                  {/* Layer 2: Outer Ring */}
                  <circle cx={pt.x} cy={pt.y} r="6" fill="none" stroke="#d8b4fe" strokeWidth="1.5" opacity="0.85" />
                  {/* Layer 3: Glowing Core */}
                  <circle cx={pt.x} cy={pt.y} r="3.2" fill="#ffffff" filter="url(#ws-glow-purple)" />
                  {/* Layer 4: Specular highlight */}
                  <circle cx={pt.x - 0.8} cy={pt.y - 0.8} r="0.8" fill="#ffffff" opacity="0.95" />
                </>
              ) : (
                <>
                  {/* Static Layered Node */}
                  <circle cx={pt.x} cy={pt.y} r="4.8" fill="none" stroke="#c084fc" strokeWidth="1" opacity="0.75" />
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#e9d5ff" fillOpacity="0.9" />
                </>
              )}
            </g>
          );
        })}

        {/* --- Connected Hexagons Framework lines --- */}
        <g stroke="rgba(168, 85, 247, 0.28)" strokeWidth="1.2" strokeDasharray="3 4" fill="none">
          <line x1="180" y1="78" x2="112" y2="123" />
          <line x1="180" y1="78" x2="248" y2="123" />
          <line x1="112" y1="123" x2="180" y2="168" />
          <line x1="248" y1="123" x2="180" y2="168" />
        </g>

        {/* --- Ambient glows behind hexagons --- */}
        <circle cx="180" cy="78" r="42" fill="rgba(168, 85, 247, 0.1)" filter="url(#ws-glow-purple)" />
        <circle cx="112" cy="123" r="42" fill="rgba(168, 85, 247, 0.1)" filter="url(#ws-glow-purple)" />
        <circle cx="248" cy="123" r="42" fill="rgba(168, 85, 247, 0.1)" filter="url(#ws-glow-purple)" />
        <circle cx="180" cy="168" r="42" fill="rgba(168, 85, 247, 0.1)" filter="url(#ws-glow-purple)" />

        {/* --- Hexagonal Nodes (Middle/Foreground layers) --- */}

        {/* Node 1: DESIGN (Top Center) */}
        <g>
          {/* Hexagon base fill and drop shadow */}
          <polygon points={getHexPoints(180, 78, 40)} fill="url(#ws-hex-fill-main)" filter="url(#ws-hex-shadow)" />
          {/* Hexagon base border */}
          <polygon points={getHexPoints(180, 78, 40)} fill="none" stroke="rgba(147, 51, 234, 0.45)" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Inset Highlight border */}
          <polygon points={getHexPoints(180, 78, 37.5)} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeLinejoin="round" />
          
          {/* Split-Lighting Bevel Effects */}
          <path d={getBevelPaths(180, 78, 40).highlight} fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={getBevelPaths(180, 78, 40).shadow} fill="none" stroke="rgba(15, 5, 30, 0.65)" strokeWidth="2.2" strokeLinecap="round" />

          {/* Central Pulsing highlight (subtle top glow) */}
          <polygon points={getHexPoints(180, 78, 41.5)} fill="none" stroke="#f5f3ff" strokeWidth="1" opacity="0.2" filter="url(#ws-glow-purple)" />

          {/* Content Group (Icon & Label relative to center 180, 78) */}
          <g transform="translate(180, 78)">
            {/* Icon: Wireframe Layout (Bold & Legible) */}
            <g transform="translate(0, -10)" filter="url(#ws-icon-shadow)">
              <rect x="-12" y="-12" width="24" height="24" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <line x1="-12" y1="-6" x2="12" y2="-6" stroke="#ffffff" strokeWidth="1.8" />
              <line x1="-6" y1="-6" x2="-6" y2="12" stroke="#ffffff" strokeWidth="1.4" opacity="0.85" />
              <rect x="-2" y="-2" width="10" height="10" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.6" />
              <line x1="-2" y1="-2" x2="8" y2="8" stroke="#ffffff" strokeWidth="1.2" opacity="0.65" />
              <line x1="8" y1="-2" x2="-2" y2="8" stroke="#ffffff" strokeWidth="1.2" opacity="0.65" />
            </g>

            {/* Node Label Text */}
            <text x="0" y="24" fontSize="6.5" fill="rgba(216, 180, 254, 0.85)" fontWeight="700" letterSpacing="0.08em" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">DESIGN</text>
          </g>
        </g>

        {/* Node 2: CONTENT (Left) */}
        <g>
          <polygon points={getHexPoints(112, 123, 40)} fill="url(#ws-hex-fill-main)" filter="url(#ws-hex-shadow)" />
          <polygon points={getHexPoints(112, 123, 40)} fill="none" stroke="rgba(147, 51, 234, 0.45)" strokeWidth="3.5" strokeLinejoin="round" />
          <polygon points={getHexPoints(112, 123, 37.5)} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeLinejoin="round" />

          {/* Split-Lighting Bevel Effects */}
          <path d={getBevelPaths(112, 123, 40).highlight} fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={getBevelPaths(112, 123, 40).shadow} fill="none" stroke="rgba(15, 5, 30, 0.65)" strokeWidth="2.2" strokeLinecap="round" />

          {/* Central Pulsing highlight */}
          <polygon points={getHexPoints(112, 123, 41.5)} fill="none" stroke="#f5f3ff" strokeWidth="1" opacity="0.2" filter="url(#ws-glow-purple)" />

          {/* Content Group (Icon & Label relative to center 112, 123) */}
          <g transform="translate(112, 123)">
            {/* Icon: Structured content blocks (Substantial Solid Fills) */}
            <g transform="translate(0, -10)" filter="url(#ws-icon-shadow)">
              {/* Block 1 */}
              <rect x="-13" y="-13" width="7" height="7" rx="1.5" fill="#ffffff" />
              <line x1="-3" y1="-9.5" x2="13" y2="-9.5" stroke="#ffffff" strokeWidth="2.0" strokeLinecap="round" />
              <line x1="-3" y1="-6" x2="8" y2="-6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
              {/* Block 2 */}
              <line x1="-13" y1="0.5" x2="13" y2="0.5" stroke="#ffffff" strokeWidth="2.0" strokeLinecap="round" />
              <line x1="-13" y1="4" x2="3" y2="4" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
              {/* Block 3 */}
              <line x1="-13" y1="10" x2="0" y2="10" stroke="#ffffff" strokeWidth="2.0" strokeLinecap="round" />
              <rect x="4" y="7.5" width="9" height="5" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.65" />
            </g>

            <text x="0" y="24" fontSize="6.5" fill="rgba(216, 180, 254, 0.85)" fontWeight="700" letterSpacing="0.08em" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">CONTENT</text>
          </g>
        </g>

        {/* Node 3: PERFORMANCE (Right) */}
        <g>
          <polygon points={getHexPoints(248, 123, 40)} fill="url(#ws-hex-fill-main)" filter="url(#ws-hex-shadow)" />
          <polygon points={getHexPoints(248, 123, 40)} fill="none" stroke="rgba(147, 51, 234, 0.45)" strokeWidth="3.5" strokeLinejoin="round" />
          <polygon points={getHexPoints(248, 123, 37.5)} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeLinejoin="round" />

          {/* Split-Lighting Bevel Effects */}
          <path d={getBevelPaths(248, 123, 40).highlight} fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={getBevelPaths(248, 123, 40).shadow} fill="none" stroke="rgba(15, 5, 30, 0.65)" strokeWidth="2.2" strokeLinecap="round" />

          {/* Central Pulsing highlight */}
          <polygon points={getHexPoints(248, 123, 41.5)} fill="none" stroke="#f5f3ff" strokeWidth="1" opacity="0.2" filter="url(#ws-glow-purple)" />

          {/* Content Group (Icon & Label relative to center 248, 123) */}
          <g transform="translate(248, 123)">
            {/* Icon: Speedometer Speed Optimization Graph (Substantial & Bold) */}
            <g transform="translate(0, -10)" filter="url(#ws-icon-shadow)">
              {/* Speedometer Arc */}
              <path d="M -11,8 A 11,11 0 0,1 11,8" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeDasharray="3 2" />
              {/* Gauge Hub */}
              <circle cx="0" cy="5" r="2.5" fill="#ffffff" />
              {/* Needle */}
              <line x1="0" y1="5" x2="7" y2="-3" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
              {/* 98% Score indicator label */}
              <text x="0" y="15.5" fontSize="5" fill="#ffffff" textAnchor="middle" fontFamily="monospace" fontWeight="bold">98%</text>
            </g>

            <text x="0" y="24" fontSize="6.5" fill="rgba(216, 180, 254, 0.85)" fontWeight="700" letterSpacing="0.08em" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">PERFORMANCE</text>
          </g>
        </g>

        {/* Node 4: WEBSITE (Center Lower) */}
        <g>
          {/* Heavy 3D-Bevel Hexagon borders and fill (WEBSITE) */}
          <polygon points={getHexPoints(180, 168, 40)} fill="url(#ws-hex-fill-main)" filter="url(#ws-hex-shadow)" />
          <polygon points={getHexPoints(180, 168, 40)} fill="none" stroke="rgba(147, 51, 234, 0.45)" strokeWidth="3.5" strokeLinejoin="round" />
          <polygon points={getHexPoints(180, 168, 37.5)} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeLinejoin="round" />
          
          {/* Split-Lighting Bevel Effects */}
          <path d={getBevelPaths(180, 168, 40).highlight} fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={getBevelPaths(180, 168, 40).shadow} fill="none" stroke="rgba(15, 5, 30, 0.65)" strokeWidth="2.2" strokeLinecap="round" />

          {/* Central Pulsing highlight */}
          <polygon points={getHexPoints(180, 168, 41.5)} fill="none" stroke="#f5f3ff" strokeWidth="1.2" opacity="0.35" filter="url(#ws-glow-purple)" />

          {/* Content Group (Icon & Label relative to center 180, 168) */}
          <g transform="translate(180, 168)">
            {/* Website Custom Icon: Premium Responsive Desktop + Mobile Mockup */}
            <g transform="translate(0, -11.5)" filter="url(#ws-icon-shadow)">
              {/* Desktop Monitor Screen */}
              <rect x="-16" y="-12" width="32" height="20" rx="2" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              {/* Monitor Stand */}
              <path d="M -4,8 L -6,13 L 6,13 L 4,8 Z" fill="#ffffff" />
              {/* Screen contents layout mockup */}
              <rect x="-12" y="-9" width="24" height="3" fill="#ffffff" opacity="0.5" />
              <rect x="-12" y="-4" width="7" height="9" fill="#ffffff" opacity="0.3" />
              <rect x="-3.5" y="-4" width="7" height="9" fill="#ffffff" opacity="0.3" />
              <rect x="5" y="-4" width="7" height="9" fill="#ffffff" opacity="0.3" />

              {/* Overlapping mobile screen on bottom-right corner */}
              <rect x="9" y="-4" width="10" height="18" rx="2" fill="rgba(46, 16, 101, 0.95)" stroke="#ffffff" strokeWidth="1.4" />
              {/* Mobile screen details */}
              <line x1="11" y1="-1" x2="17" y2="-1" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
              <rect x="11" y="2" width="6" height="5" fill="#ffffff" opacity="0.3" />
              <line x1="11" y1="9" x2="17" y2="9" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
              <line x1="11" y1="11" x2="15" y2="11" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
            </g>

            <text x="0" y="24" fontSize="6.5" fill="#ffffff" fontWeight="800" letterSpacing="0.1em" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">WEBSITE</text>
          </g>
        </g>
      </svg>
    </ExampleFrame>
  );
}
