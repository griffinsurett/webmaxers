// src/components/AnimatedExamples/AiAgentsDemo.tsx
import { motion } from "framer-motion";
import ExampleFrame, { useExampleSteps } from "./ExampleFrame";

const GREEN_ACCENT = "#4ade80";

// Symmetrical wave path connecting the node centers mathematically
const WAVE_PATH = "M 80,180 C 120,180 140,80 180,80 C 220,80 240,180 280,180";

// Three mathematically balanced app nodes
const PATH_NODES = [
  { cx: 80,  cy: 180, color: "#60a5fa", type: "calendar", activeStep: 1, textY: 208, label: "STEP 1" },
  { cx: 180, cy: 80,  color: "#fbbf24", type: "mail",     activeStep: 2, textY: 55,  label: "STEP 2" },
  { cx: 280, cy: 180, color: "#c084fc", type: "db",       activeStep: 3, textY: 211, label: "STEP 3" },
];

interface Props { className?: string }

export default function AiAgentsDemo({ className = "" }: Props) {
  // Loop timings for step increments
  const step = useExampleSteps([600, 1400, 2300], 4800);

  return (
    <ExampleFrame label="Animation: Symmetrical AI Agent workflow execution pipeline" className={className}>
      {/* Background with emerald green radial glow */}
      <div 
        className="absolute inset-0 bg-[#040907]" 
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(74,222,128,0.12) 0%, rgba(4,9,7,0) 75%)"
        }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Glowing particle filter */}
          <filter id="agent-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle grid of miniature dots */}
        {Array.from({ length: 12 }, (_, col) =>
          Array.from({ length: 9 }, (_, row) => {
            const cx = col * 32 + (row % 2) * 16 - 8;
            const cy = row * 28 + 6;
            return (
              <circle
                key={`${col}-${row}`}
                cx={cx}
                cy={cy}
                r="0.85"
                fill={GREEN_ACCENT}
                fillOpacity="0.04"
              />
            );
          })
        )}

        {/* --- Symmetrical Circuit Wave Path --- */}
        <g>
          {/* Background trace line */}
          <path
            d={WAVE_PATH}
            fill="none"
            stroke="rgba(74, 222, 128, 0.08)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          {/* Active dotted path */}
          <path
            d={WAVE_PATH}
            fill="none"
            stroke={GREEN_ACCENT}
            strokeWidth="1.2"
            strokeDasharray="3 4"
            strokeOpacity="0.6"
          />

          {/* Glowing Orb traversing the path */}
          <circle r="4" fill="#ffffff" filter="url(#agent-glow)">
            <animateMotion
              dur="4.5s"
              repeatCount="indefinite"
              path={WAVE_PATH}
            />
          </circle>
        </g>

        {/* --- Mathematically Balanced Hexagon Nodes & Monospace Labels --- */}
        {PATH_NODES.map((n, idx) => {
          const isActive = step >= n.activeStep;
          
          // Generate coordinates for flat-topped hexagon (radius 14) dynamically
          const hexPath = `M ${n.cx + 14},${n.cy} L ${n.cx + 7},${n.cy + 12} L ${n.cx - 7},${n.cy + 12} L ${n.cx - 14},${n.cy} L ${n.cx - 7},${n.cy - 12} L ${n.cx + 7},${n.cy - 12} Z`;

          return (
            <motion.g 
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: isActive ? [1, 1.15, 1] : 1
              }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              {/* Symmetrical Hexagon Card Node */}
              <motion.path
                d={hexPath}
                fill="rgba(10, 15, 24, 0.85)"
                stroke={isActive ? n.color : "rgba(255, 255, 255, 0.06)"}
                strokeWidth="1.2"
                filter={isActive ? "url(#agent-glow)" : undefined}
                animate={isActive ? { strokeOpacity: [0.7, 1.0, 0.7] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />

              {/* Minimal SVG icons inside nodes */}
              {n.type === "calendar" && (
                <g stroke={isActive ? n.color : "rgba(255,255,255,0.35)"} strokeWidth="1" fill="none">
                  <rect x={n.cx - 5} y={n.cy - 5} width="10" height="9" rx="1" />
                  <line x1={n.cx - 5} y1={n.cy - 2} x2={n.cx + 5} y2={n.cy - 2} />
                  <circle cx={n.cx} cy={n.cy + 1.5} r="0.6" fill="currentColor" />
                </g>
              )}

              {n.type === "mail" && (
                <g stroke={isActive ? n.color : "rgba(255,255,255,0.35)"} strokeWidth="1" fill="none">
                  <rect x={n.cx - 6} y={n.cy - 4} width="12" height="8" rx="1" />
                  <path d={`M${n.cx - 6},${n.cy - 2.5} L${n.cx},${n.cy + 1} L${n.cx + 6},${n.cy - 2.5}`} />
                </g>
              )}

              {n.type === "db" && (
                <g stroke={isActive ? n.color : "rgba(255,255,255,0.35)"} strokeWidth="1" fill="none">
                  <ellipse cx={n.cx} cy={n.cy - 3} rx="5" ry="1.6" />
                  <path d={`M${n.cx - 5},${n.cy - 3} V${n.cy + 0.5} C${n.cx - 5},${n.cy + 2} ${n.cx + 5},${n.cy + 2} ${n.cx + 5},${n.cy + 0.5} V${n.cy - 3}`} />
                  <path d={`M${n.cx - 5},${n.cy + 0.5} V${n.cy + 4} C${n.cx - 5},${n.cy + 5.5} ${n.cx + 5},${n.cy + 5.5} ${n.cx + 5},${n.cy + 4} V${n.cy + 0.5}`} />
                </g>
              )}

              {/* Clean all-caps label aligned under/above node */}
              <text
                x={n.cx}
                y={n.textY}
                fontSize="7.5"
                fill={isActive ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.28)"}
                fontWeight="800"
                textAnchor="middle"
                fontFamily="monospace"
                letterSpacing="0.6"
              >
                {n.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </ExampleFrame>
  );
}
