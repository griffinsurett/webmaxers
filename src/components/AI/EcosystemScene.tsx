// src/components/AI/EcosystemScene.tsx
// Isometric colony ecosystem — story-driven scene showing AI handling real SMB tasks

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ─── Isometric Math ──────────────────────────────────────────────────────────

const OX = 450;
const OY = 280; // exact vertical center of the 560px SVG canvas
const TILE_W = 60;
const TILE_H = 30;

function iso(gx: number, gy: number): [number, number] {
  return [
    OX + (gx - gy) * (TILE_W / 2),
    OY + (gx + gy) * (TILE_H / 2),
  ];
}

function tilePoints(gx: number, gy: number): string {
  const [cx, cy] = iso(gx, gy);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
}

function buildingFaces(gx: number, gy: number, h: number) {
  const [cx, cy] = iso(gx, gy);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return {
    top:   `${cx},${cy-hh-h} ${cx+hw},${cy-h} ${cx},${cy+hh-h} ${cx-hw},${cy-h}`,
    left:  `${cx-hw},${cy-h} ${cx},${cy+hh-h} ${cx},${cy+hh} ${cx-hw},${cy}`,
    right: `${cx},${cy+hh-h} ${cx+hw},${cy-h} ${cx+hw},${cy} ${cx},${cy+hh}`,
  };
}

function hexPts(cx: number, cy: number, r: number, rotation = -30): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((rotation + i * 60) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function zonePath(gx: number, gy: number): string {
  const [zx, zy] = iso(gx, gy);
  const [cx, cy] = iso(0, 0);
  const isVertical = Math.abs(zx - cx) < 10;
  const sideArc = isVertical ? (gy < 0 ? 35 : -35) : 0;
  const upArc   = isVertical ? 0 : -35;
  const mx = (zx + cx) / 2 + sideArc;
  const my = (zy + cy) / 2 + upArc;
  return `M ${zx} ${zy - 30} Q ${mx} ${my} ${cx} ${cy}`;
}

// ─── Zone Data ────────────────────────────────────────────────────────────────
// taskLabelPct: where the floating task pill appears over the SVG (% of 900×560)
// below: true for the south building (Scheduling) — pill anchors below the building

// Percentages recalculated for OY=280:
//   cs  dotCy = 280-120-48-30 = 82  → top 82/560  = 14.6%
//   fin dotCy = 280-44-30     = 206 → top 206/560  = 36.8%
//   ops dotCy = 280+120+14    = 414 → top 414/560  = 73.9%
//   knw dotCy = 280-48-30     = 202 → top 202/560  = 36.1%
// tail: direction the speech-bubble tail points (toward the building below it)
const zones = [
  {
    id: "cs",  gx: -4, gy: -4, h: 48,
    label: "Your Customers",
    color: "#d97065", dark: "#7a2820", mid: "#a84030",
    taskLabelPct: { left: "50%",   top: "14.6%", below: false },
    tail: "down" as const,
  },
  {
    id: "fin", gx:  4, gy: -4, h: 44,
    label: "Invoicing",
    color: "#d4920a", dark: "#7a5000", mid: "#a06800",
    taskLabelPct: { left: "76.7%", top: "36.8%", below: false },
    tail: "down" as const,
  },
  {
    id: "ops", gx:  4, gy:  4, h: 40,
    label: "Scheduling",
    color: "#5a8a60", dark: "#25462a", mid: "#406848",
    taskLabelPct: { left: "50%",   top: "73.9%", below: true  },
    tail: "up"   as const,
  },
  {
    id: "knw", gx: -4, gy:  4, h: 48,
    label: "Your Playbook",
    color: "#6878b8", dark: "#222e6a", mid: "#404e88",
    taskLabelPct: { left: "23.3%", top: "36.1%", below: false },
    tail: "down" as const,
  },
];

const zonePaths = zones.map((z) => ({
  id: `zp-${z.id}`,
  d: zonePath(z.gx, z.gy),
  color: z.color,
}));

const workers = zones.flatMap((z, zi) =>
  [0, 1, 2].map((wi) => ({
    id: `w-${z.id}-${wi}`,
    pathId: `zp-${z.id}`,
    color: [z.color, z.mid, z.color][wi],
    dur: [8, 11, 7][wi] + zi * 0.5,
    begin: [0, 3.5, 6][wi] + zi * 0.8,
    packet: wi === 0 || (wi === 2 && zi % 2 === 0),
    pColor: z.color,
  }))
);

const pulses = zones.flatMap((z, zi) =>
  [0, 1].map((pi) => ({
    id: `p-${z.id}-${pi}`,
    pathId: `zp-${z.id}`,
    color: z.color,
    dur: [3.5, 4.2][pi],
    begin: [0, 1.8][pi] + zi * 0.7,
  }))
);

const orbitals = zones.flatMap((z) => {
  const [zx, zy] = iso(z.gx, z.gy);
  return [0, 1, 2, 3].map((i) => ({
    id: `orb-${z.id}-${i}`,
    cx: zx + [-22, 18, -10, 26][i],
    cy: zy - z.h * 0.35 + [12, 8, 22, -4][i],
    r: 2.8,
    color: z.color,
    dur: [6, 8, 5, 7][i],
    begin: [0, 2, 4, 1][i],
    dx: [6, -5, 8, -7][i],
    dy: [-4, 6, -5, 5][i],
  }));
});

const packets = zones.flatMap((z) => {
  const [zx, zy] = iso(z.gx, z.gy);
  return [0, 1].map((i) => ({
    id: `pkt-${z.id}-${i}`,
    x: zx + [-28, 14][i],
    y: zy - z.h * 0.6 + [0, -10][i],
    color: z.color,
    dur: [4, 5][i],
    begin: [0, 2][i],
  }));
});

const roadSegments: [number, number][] = [
  [-1, -1], [-2, -2], [-3, -3],
  [ 1, -1], [ 2, -2], [ 3, -3],
  [ 1,  1], [ 2,  2], [ 3,  3],
  [-1,  1], [-2,  2], [-3,  3],
];

// ─── Scenario Story Data ──────────────────────────────────────────────────────

const scenarios = [
  { zoneId: "cs",  taskLabel: "New inquiry · 11:47 PM",     resultLabel: "Replied in 8 seconds",       resultIcon: "💬" },
  { zoneId: "fin", taskLabel: "Job #247 completed",          resultLabel: "Invoice sent · $1,400",       resultIcon: "💰" },
  { zoneId: "ops", taskLabel: "Jake's calendar updated",     resultLabel: "Job assigned automatically",  resultIcon: "📅" },
  { zoneId: "knw", taskLabel: "Staff asked about returns",   resultLabel: "Answer sent instantly",       resultIcon: "📋" },
];

// ─── Zone Card Content (plain English for SMB owners) ─────────────────────────

const zoneCards: Record<string, { bullets: string[]; before: string; after: string }> = {
  cs: {
    bullets: [
      "Replies to every inquiry — even at 2 AM",
      "Answers pricing, availability, and common questions",
      "Books appointments without you picking up the phone",
    ],
    before: "A customer asks about your pricing at 11 PM. You're asleep. They move on to a competitor.",
    after: "Your AI replies in seconds with pricing, availability, and a booking link. You wake up to a new job.",
  },
  fin: {
    bullets: [
      "Sends invoices the moment a job is marked complete",
      "Follows up on unpaid invoices so you don't have to chase",
      "Keeps your books updated without manual data entry",
    ],
    before: "You finish a job, forget to invoice for three days, then spend two weeks chasing payment.",
    after: "Invoice sent the moment the job is done. Payment link included. Automatic follow-up if unpaid.",
  },
  ops: {
    bullets: [
      "Assigns jobs to the right person based on their availability",
      "Sends job details and reminders to your staff automatically",
      "Updates your calendar whenever a new booking comes in",
    ],
    before: "You spend 30 minutes every morning shuffling the schedule and texting your team one by one.",
    after: "Jobs are assigned, staff are notified, and your calendar updates itself. You drink your coffee.",
  },
  knw: {
    bullets: [
      "Answers staff questions instantly using your own procedures",
      "Onboards new team members without you repeating yourself",
      "Keeps your business knowledge organised and always accessible",
    ],
    before: "A new team member asks the same procedure question for the third time. You stop what you're doing.",
    after: "Your AI answers from your own playbook. Consistently. Every time. Day or night.",
  },
};

// ─── Live Activity Ticker Items ───────────────────────────────────────────────

const feedItems = [
  "✓ Lead from website answered · just now",
  "✓ Invoice #1043 sent to client · 2 min ago",
  "✓ Appointment booked for Sarah · 5 min ago",
  "✓ Staff question resolved · 9 min ago",
  "✓ Follow-up sent to David · 14 min ago",
  "✓ Job #251 assigned to Jake · 18 min ago",
  "✓ Payment reminder sent · 22 min ago",
  "✓ New enquiry replied · 27 min ago",
  "✓ Quote request answered · 31 min ago",
  "✓ Returns policy explained to team · 35 min ago",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EcosystemScene() {
  const [reduced, setReduced] = useState(false);
  const [scenarioStep,  setScenarioStep]  = useState(0);
  const [scenarioPhase, setScenarioPhase] = useState<"task" | "result" | "done">("task");
  const [activeCard,    setActiveCard]    = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Scenario engine: task → result → done → next scenario
  useEffect(() => {
    if (reduced) {
      setScenarioStep(3);
      setScenarioPhase("result");
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (scenarioPhase === "task")   t = setTimeout(() => setScenarioPhase("result"), 2500);
    else if (scenarioPhase === "result") t = setTimeout(() => setScenarioPhase("done"),   2000);
    else t = setTimeout(() => { setScenarioStep((s) => (s + 1) % 4); setScenarioPhase("task"); }, 500);
    return () => clearTimeout(t);
  }, [reduced, scenarioStep, scenarioPhase]);

  // Focus close button when card opens
  useEffect(() => {
    if (activeCard) setTimeout(() => closeButtonRef.current?.focus(), 50);
  }, [activeCard]);

  const currentScenario = scenarios[scenarioStep];
  const activeZone = zones.find((z) => z.id === currentScenario.zoneId)!;

  const [coreCx, coreCy] = iso(0, 0);

  const floor: [number, number][] = [];
  for (let gx = -7; gx <= 7; gx++)
    for (let gy = -6; gy <= 6; gy++)
      floor.push([gx, gy]);

  return (
    <div className="relative w-full bg-[#080d16]">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(calc(-50% - 24px), 0, 0); }
        }
      `}</style>

      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="text-center pt-20 pb-6 px-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#d4920a] font-bold">
          Your Business, On Autopilot
        </span>
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-zinc-100 tracking-tight mt-2 mb-3">
          While you sleep, your AI handles it
        </h2>
        <p className="text-sm md:text-base text-zinc-400 font-light leading-relaxed max-w-lg mx-auto">
          New leads answered. Invoices sent. Jobs booked. Staff questions solved. All without you lifting a finger.
        </p>
        <p className="text-xs text-zinc-500 mt-3">Tap any building to see what it does for your business</p>
      </div>

      {/* ── SVG World + HTML Overlay ────────────────────────────────────────── */}
      <div
        className="w-full overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: "touch", position: "relative" }}
      >
        <svg
          viewBox="0 0 900 560"
          width="900"
          height="560"
          className="mx-auto block"
          style={{ maxWidth: "100%", minWidth: 640 }}
          aria-label="Isometric scene showing your AI handling customers, invoicing, scheduling, and staff knowledge for your business"
          role="img"
        >
          <defs>
            {zonePaths.map((zp) => (
              <path key={`def-${zp.id}`} id={zp.id} d={zp.d} />
            ))}
            <filter id="glow-core" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
              <feComposite in="SourceGraphic" in2="b" operator="over" />
            </filter>
            <filter id="shadow-w" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
            </filter>
            <filter id="glow-sig" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
              <feComposite in="SourceGraphic" in2="b" operator="over" />
            </filter>
          </defs>

          <rect width="900" height="560" fill="#080d16" />

          {/* Floor — 3D tiles with left + right side faces */}
          <g>
            {floor.map(([gx, gy]) => {
              const [cx, cy] = iso(gx, gy);
              const hw = TILE_W / 2;
              const hh = TILE_H / 2;
              const d = 4;
              const even = (gx + gy) % 2 === 0;
              return (
                <g key={`f-${gx}-${gy}`}>
                  {/* Left face — darkest (shadow side) */}
                  <polygon
                    points={`${cx-hw},${cy} ${cx},${cy+hh} ${cx},${cy+hh+d} ${cx-hw},${cy+d}`}
                    fill={even ? "#060d18" : "#050c16"}
                    stroke="#0a1624"
                    strokeWidth="0.25"
                  />
                  {/* Right face — mid shade */}
                  <polygon
                    points={`${cx},${cy+hh} ${cx+hw},${cy} ${cx+hw},${cy+d} ${cx},${cy+hh+d}`}
                    fill={even ? "#09111e" : "#07101c"}
                    stroke="#0a1624"
                    strokeWidth="0.25"
                  />
                  {/* Top face */}
                  <polygon
                    points={`${cx},${cy-hh} ${cx+hw},${cy} ${cx},${cy+hh} ${cx-hw},${cy}`}
                    fill={even ? "#0c1320" : "#0a1018"}
                    stroke="#111d2e"
                    strokeWidth="0.4"
                  />
                </g>
              );
            })}
          </g>

          {/* Roads — slightly deeper (raised above floor) */}
          {roadSegments.map(([gx, gy]) => {
            const [cx, cy] = iso(gx, gy);
            const hw = TILE_W / 2;
            const hh = TILE_H / 2;
            const d = 6;
            return (
              <g key={`rd-${gx}-${gy}`}>
                <polygon
                  points={`${cx-hw},${cy} ${cx},${cy+hh} ${cx},${cy+hh+d} ${cx-hw},${cy+d}`}
                  fill="#0b1a2c"
                  stroke="#142236"
                  strokeWidth="0.3"
                />
                <polygon
                  points={`${cx},${cy+hh} ${cx+hw},${cy} ${cx+hw},${cy+d} ${cx},${cy+hh+d}`}
                  fill="#0f2036"
                  stroke="#142236"
                  strokeWidth="0.3"
                />
                <polygon
                  points={`${cx},${cy-hh} ${cx+hw},${cy} ${cx},${cy+hh} ${cx-hw},${cy}`}
                  fill="#121e30"
                  stroke="#1a2c44"
                  strokeWidth="0.6"
                />
              </g>
            );
          })}

          {/* Pathway lines */}
          {zonePaths.map((zp) => (
            <path
              key={`sl-${zp.id}`}
              d={zp.d}
              fill="none"
              stroke={zp.color}
              strokeWidth="1.2"
              strokeDasharray="5 8"
              opacity="0.12"
            />
          ))}

          {/* Zone Buildings */}
          {zones.map((z) => {
            const faces = buildingFaces(z.gx, z.gy, z.h);
            const [zx, zy] = iso(z.gx, z.gy);
            const isSouth = zy > coreCy + 10;
            const dotCy  = isSouth ? zy + 14     : zy - z.h - 30;
            const labelY = isSouth ? zy + 30     : zy - z.h - 38;
            const isActive = z.id === currentScenario.zoneId;

            return (
              <g key={z.id}>
                <polygon points={faces.left}  fill={z.dark} />
                <polygon points={faces.right} fill={z.mid} />
                {/* Top face dims when another zone is active */}
                <polygon
                  points={faces.top}
                  fill={z.color}
                  opacity={isActive ? 1 : 0.55}
                  style={{ transition: "opacity 0.7s ease" }}
                />
                {/* Active zone rim glow */}
                {isActive && (
                  <polygon
                    points={faces.top}
                    fill="none"
                    stroke={z.color}
                    strokeWidth="2.5"
                    opacity="0.65"
                  />
                )}

                {/* Secondary rooftop block */}
                <polygon
                  points={`${zx},${zy - z.h - 22} ${zx + 16},${zy - z.h - 14} ${zx},${zy - z.h - 6} ${zx - 16},${zy - z.h - 14}`}
                  fill={z.color}
                  opacity={isActive ? 0.9 : 0.7}
                />
                <polygon
                  points={`${zx - 16},${zy - z.h - 14} ${zx},${zy - z.h - 6} ${zx},${zy - z.h + 8} ${zx - 16},${zy - z.h}`}
                  fill={z.dark}
                  opacity="0.7"
                />
                <polygon
                  points={`${zx},${zy - z.h - 6} ${zx + 16},${zy - z.h - 14} ${zx + 16},${zy - z.h} ${zx},${zy - z.h + 8}`}
                  fill={z.mid}
                  opacity="0.7"
                />

                {/* Windows */}
                {[0, 1].map((wi) => (
                  <rect
                    key={`win-${z.id}-${wi}`}
                    x={zx + 4 + wi * 14}
                    y={zy - z.h * 0.55 + 2}
                    width="9"
                    height="7"
                    rx="1.5"
                    fill="#fff8e0"
                    opacity="0.55"
                  >
                    {!reduced && (
                      <animate
                        attributeName="opacity"
                        values="0.55;0.8;0.55"
                        dur={`${3 + wi}s`}
                        begin={`${wi * 1.2}s`}
                        repeatCount="indefinite"
                      />
                    )}
                  </rect>
                ))}

                {/* Zone dot */}
                <circle cx={zx} cy={dotCy} r="4" fill={z.color}>
                  {!reduced && <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />}
                </circle>

                {/* Zone label */}
                <text
                  x={zx}
                  y={labelY}
                  textAnchor="middle"
                  fill={z.color}
                  fontSize="7.5"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="700"
                  letterSpacing="0.12em"
                  opacity={isActive ? 1 : 0.6}
                  style={{ transition: "opacity 0.7s ease" }}
                >
                  {z.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Orbitals */}
          {!reduced && orbitals.map((orb) => (
            <circle key={orb.id} r={orb.r} fill={orb.color} opacity="0.55" filter="url(#shadow-w)">
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${orb.cx},${orb.cy}; ${orb.cx + orb.dx},${orb.cy + orb.dy}; ${orb.cx},${orb.cy}`}
                dur={`${orb.dur}s`}
                begin={`${orb.begin}s`}
                repeatCount="indefinite"
              />
              <animate attributeName="opacity" values="0.4;0.65;0.4" dur={`${orb.dur}s`} begin={`${orb.begin}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {/* Packets */}
          {!reduced && packets.map((pkt) => (
            <g key={pkt.id}>
              <rect x={pkt.x} y={pkt.y} width="8" height="6" rx="1.5" fill={pkt.color} opacity="0.5">
                <animate attributeName="opacity" values="0.35;0.65;0.35" dur={`${pkt.dur}s`} begin={`${pkt.begin}s`} repeatCount="indefinite" />
              </rect>
              <rect x={pkt.x + 10} y={pkt.y + 2} width="8" height="6" rx="1.5" fill={pkt.color} opacity="0.35">
                <animate attributeName="opacity" values="0.2;0.5;0.2" dur={`${pkt.dur + 1}s`} begin={`${pkt.begin + 0.5}s`} repeatCount="indefinite" />
              </rect>
            </g>
          ))}

          {/* Pulse Signals */}
          {!reduced && pulses.map((p) => (
            <g key={p.id}>
              <circle r="4.5" fill={p.color} filter="url(#glow-sig)">
                <animateMotion dur={`${p.dur}s`} begin={`${p.begin}s`} repeatCount="indefinite">
                  <mpath href={`#${p.pathId}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.08;0.9;1" dur={`${p.dur}s`} begin={`${p.begin}s`} repeatCount="indefinite" />
              </circle>
              <circle r="2.5" fill={p.color} opacity="0.5">
                <animateMotion dur={`${p.dur}s`} begin={`${p.begin + 0.2}s`} repeatCount="indefinite">
                  <mpath href={`#${p.pathId}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;0.5;0.5;0" keyTimes="0;0.1;0.85;1" dur={`${p.dur}s`} begin={`${p.begin + 0.2}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}

          {/* Workers */}
          {!reduced && workers.map((w) => (
            <g key={w.id}>
              <circle r="4.5" fill={w.color} filter="url(#shadow-w)">
                <animateMotion
                  dur={`${w.dur}s`}
                  begin={`${w.begin}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                  calcMode="spline"
                  keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                  keyTimes="0;0.5;1"
                  values="0;0.5;1"
                >
                  <mpath href={`#${w.pathId}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;1;1;1;0" keyTimes="0;0.05;0.45;0.9;1" dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite" />
              </circle>
              {w.packet && (
                <rect width="7" height="5" rx="1" fill={w.pColor} filter="url(#glow-sig)" x="-3.5" y="-9">
                  <animateMotion dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite" rotate="auto">
                    <mpath href={`#${w.pathId}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.08;0.9;1" dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite" />
                </rect>
              )}
            </g>
          ))}

          {/* Central Intelligence Core — clean circle with AI label */}
          <g>
            {/* Soft ambient pulse ring */}
            <circle cx={coreCx} cy={coreCy} r="58" fill="#d4920a" opacity="0">
              {!reduced && <animate attributeName="opacity" values="0;0.07;0" dur="3.5s" repeatCount="indefinite" />}
            </circle>

            {/* Single rotating dashed scan ring */}
            <circle cx={coreCx} cy={coreCy} r="42" fill="none" stroke="#d4920a"
                    strokeWidth="1.2" strokeDasharray="9 6" opacity="0.35">
              {!reduced && (
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${coreCx} ${coreCy}`} to={`360 ${coreCx} ${coreCy}`}
                  dur="22s" repeatCount="indefinite" />
              )}
            </circle>

            {/* Main circle body */}
            <circle cx={coreCx} cy={coreCy} r="30" fill="#080d16" stroke="#d4920a" strokeWidth="1.8" filter="url(#glow-core)" />

            {/* Inner subtle ring */}
            <circle cx={coreCx} cy={coreCy} r="22" fill="none" stroke="#d4920a" strokeWidth="0.6" opacity="0.3" />

            {/* "AI" label — bold, centered */}
            <text
              x={coreCx} y={coreCy + 4}
              textAnchor="middle" dominantBaseline="middle"
              fill="#d4920a"
              fontSize="18"
              fontFamily="Inter, system-ui, -apple-system, sans-serif"
              fontWeight="800"
              letterSpacing="0.06em"
              filter="url(#glow-core)"
            >AI</text>

            {/* "BRAIN" subscript */}
            <text
              x={coreCx} y={coreCy + 18}
              textAnchor="middle"
              fill="#d4920a"
              fontSize="5.5"
              fontFamily="Inter, system-ui, -apple-system, sans-serif"
              fontWeight="700"
              letterSpacing="0.22em"
              opacity="0.65"
            >BRAIN</text>

            {/* Green "active" status dot — top-right of circle */}
            <circle cx={coreCx + 22} cy={coreCy - 22} r="5.5" fill="#080d16" stroke="#4ade80" strokeWidth="1.2" />
            <circle cx={coreCx + 22} cy={coreCy - 22} r="3.2" fill="#4ade80">
              {!reduced && <animate attributeName="r" values="2.8;3.6;2.8" dur="1.8s" repeatCount="indefinite" />}
            </circle>

            {/* 4 orbit satellite dots */}
            {[0, 1, 2, 3].map((i) => {
              const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
              const px = coreCx + Math.cos(angle) * 50;
              const py = coreCy + Math.sin(angle) * 50;
              return (
                <circle key={`sat-${i}`} cx={px} cy={py} r="2.5" fill="#d4920a">
                  <animate attributeName="opacity" values="0.1;0.65;0.1"
                    dur={`${2.5 + i * 0.45}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>

          {/* Ambient workers */}
          {!reduced && [
            { cx: 200, cy: 320, color: "#d97065", dur: 4,   begin: 0   },
            { cx: 700, cy: 280, color: "#d4920a", dur: 5,   begin: 1   },
            { cx: 680, cy: 400, color: "#5a8a60", dur: 6,   begin: 2   },
            { cx: 210, cy: 400, color: "#6878b8", dur: 5,   begin: 0.5 },
            { cx: 430, cy: 460, color: "#d97065", dur: 4,   begin: 3   },
            { cx: 460, cy: 120, color: "#d4920a", dur: 3.5, begin: 1.5 },
          ].map((a, i) => (
            <circle key={`amb-${i}`} cx={a.cx} cy={a.cy} r="3" fill={a.color}>
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${a.dur}s`} begin={`${a.begin}s`} repeatCount="indefinite" />
              <animate attributeName="cx" values={`${a.cx};${a.cx + 8};${a.cx}`} dur={`${a.dur + 1}s`} begin={`${a.begin}s`} repeatCount="indefinite" />
              <animate attributeName="cy" values={`${a.cy};${a.cy - 5};${a.cy}`} dur={`${a.dur + 1}s`} begin={`${a.begin}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>

        {/* ── HTML Overlay: scenario labels + zone hotspots ─────────────────── */}
        <div style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          {/* Inner container matches the SVG's centered width */}
          <div style={{ position: "relative", width: "min(900px, 100%)", height: "100%", margin: "0 auto" }}>

            {/* Task speech bubble near active zone */}
            <AnimatePresence mode="wait">
              {(scenarioPhase === "task" || scenarioPhase === "result") && (
                <motion.div
                  key={`task-${scenarioStep}`}
                  initial={{ opacity: 0, scale: 0.88, y: activeZone.tail === "up" ? 8 : -8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{    opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    left: activeZone.taskLabelPct.left,
                    top: activeZone.taskLabelPct.top,
                    transform: activeZone.taskLabelPct.below
                      ? "translate(-50%, 10px)"
                      : "translate(-50%, -115%)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  {/* Bubble body */}
                  <div style={{
                    position: "relative",
                    background: "#0e1623",
                    border: `1.5px solid ${activeZone.color}55`,
                    borderRadius: 10,
                    padding: "7px 14px",
                    fontSize: 11,
                    fontFamily: "ui-monospace, monospace",
                    color: "#e4e4e7",
                    whiteSpace: "nowrap",
                    boxShadow: `0 4px 24px ${activeZone.color}18, 0 0 0 1px ${activeZone.color}18`,
                  }}>
                    <span style={{ color: activeZone.color, marginRight: 6, fontSize: 10 }}>●</span>
                    {currentScenario.taskLabel}

                    {/* Tail — points toward the building */}
                    {activeZone.tail === "down" && (
                      <span style={{
                        position: "absolute",
                        bottom: -7,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0, height: 0,
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderTop: `7px solid ${activeZone.color}55`,
                      }} />
                    )}
                    {activeZone.tail === "up" && (
                      <span style={{
                        position: "absolute",
                        top: -7,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0, height: 0,
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderBottom: `7px solid ${activeZone.color}55`,
                      }} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result bubble — above the core, never overlapping it */}
            <AnimatePresence mode="wait">
              {scenarioPhase === "result" && (
                <motion.div
                  key={`result-${scenarioStep}`}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{    opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "33%",
                    transform: "translate(-50%, -100%)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  <div style={{
                    position: "relative",
                    background: "#0d1800",
                    border: "1.5px solid #4ade8066",
                    borderRadius: 10,
                    padding: "8px 16px",
                    fontSize: 11,
                    fontFamily: "ui-monospace, monospace",
                    color: "#4ade80",
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 24px #4ade8014",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 14 }}>{currentScenario.resultIcon}</span>
                    <span>{currentScenario.resultLabel}</span>
                    {/* Tail pointing down toward the core */}
                    <span style={{
                      position: "absolute",
                      bottom: -7,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 0, height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "7px solid transparent",
                      borderTop: "7px solid #4ade8066",
                    }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Invisible hotspot buttons over each zone building */}
            {zones.map((z) => (
              <button
                key={`hotspot-${z.id}`}
                onClick={() => setActiveCard(z.id)}
                aria-label={`Learn about ${z.label}`}
                style={{
                  position: "absolute",
                  left: z.taskLabelPct.left,
                  top: z.taskLabelPct.top,
                  width: "9%",
                  height: "14%",
                  transform: z.taskLabelPct.below
                    ? "translate(-50%, -90%)"
                    : "translate(-50%, 10%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Activity Ticker ─────────────────────────────────────────────── */}
      <div style={{
        overflow: "hidden",
        borderTop: "1px solid #1e2f48",
        borderBottom: "1px solid #1e2f48",
        position: "relative",
        padding: "11px 0",
      }}>
        <div style={{ position: "absolute", left: 0,  top: 0, bottom: 0, width: 72, background: "linear-gradient(to right, #080d16, transparent)", zIndex: 1, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 72, background: "linear-gradient(to left,  #080d16, transparent)", zIndex: 1, pointerEvents: "none" }} />
        <div
          style={{
            display: "flex",
            gap: 56,
            width: "max-content",
            animationName: "ticker-scroll",
            animationDuration: "36s",
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: reduced ? "paused" : "running",
          }}
        >
          {[...feedItems, ...feedItems].map((item, i) => (
            <span key={i} style={{ whiteSpace: "nowrap", color: "#52525b", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Legend Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 pb-16 pt-4 px-4">
        {zones.map((z) => (
          <div key={z.id} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: z.color }} />
            <span className="text-[11px] text-zinc-400 font-medium tracking-wide">{z.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[#d4920a]" />
          <span className="text-[11px] text-zinc-400 font-medium tracking-wide">Your AI Brain</span>
        </div>
      </div>

      {/* ── Zone Info Card Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeCard && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setActiveCard(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            {(() => {
              const z    = zones.find((z) => z.id === activeCard)!;
              const card = zoneCards[activeCard];
              return (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, scale: 0.94, y: 10 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{    opacity: 0, scale: 0.94, y: 10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`About ${z.label}`}
                  style={{
                    background: "var(--color-bg3, #18181b)",
                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                    borderRadius: 12,
                    width: "min(420px, 100%)",
                    maxHeight: "calc(100vh - 32px)",
                    overflowY: "auto",
                    padding: "24px 24px 20px",
                    position: "relative",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
                  }}
                >
                  {/* Close */}
                  <button
                    ref={closeButtonRef}
                    onClick={() => setActiveCard(null)}
                    aria-label="Close"
                    style={{
                      position: "absolute", top: 14, right: 14,
                      background: "transparent",
                      border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                      borderRadius: 6,
                      color: "#71717a",
                      cursor: "pointer",
                      width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, lineHeight: 1,
                    }}
                  >✕</button>
 
                  {/* Title */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: z.color, flexShrink: 0, boxShadow: `0 0 8px ${z.color}88` }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#f4f4f5" }}>{z.label}</span>
                  </div>
 
                  {/* What your AI does */}
                  <p style={{ fontSize: 9, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontWeight: 700 }}>
                    What your AI does here
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", display: "flex", flexDirection: "column", gap: 9 }}>
                    {card.bullets.map((b, i) => (
                      <li key={i} style={{ display: "flex", gap: 9, fontSize: 13, color: "#a1a1aa", lineHeight: 1.55 }}>
                        <span style={{ color: "var(--color-accent, #5e76f6)", flexShrink: 0, marginTop: 1 }}>→</span>
                        {b}
                      </li>
                    ))}
                  </ul>
 
                  <div style={{ height: 1, background: "var(--color-border, rgba(255, 255, 255, 0.08))", marginBottom: 18 }} />
 
                  {/* Before / After */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ background: "var(--color-bg2, #0c0c0e)", border: "1px solid rgba(244, 63, 94, 0.2)", borderRadius: 9, padding: "12px 14px" }}>
                      <div style={{ fontSize: 9, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7, fontWeight: 700 }}>Before</div>
                      <p style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>{card.before}</p>
                    </div>
                    <div style={{ background: "var(--color-bg2, #0c0c0e)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 9, padding: "12px 14px" }}>
                      <div style={{ fontSize: 9, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7, fontWeight: 700 }}>After</div>
                      <p style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>{card.after}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
