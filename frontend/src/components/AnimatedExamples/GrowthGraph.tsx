// src/components/AnimatedExamples/GrowthGraph.tsx
import { useState, useEffect, useId } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface GrowthGraphProps {
  className?: string;
  variant?: "compact" | "panel";
}

const normalizedPoints = [
  { x: 0, y: 0.92 },
  { x: 0.1, y: 0.88 },
  { x: 0.2, y: 0.8 },
  { x: 0.35, y: 0.64 },
  { x: 0.5, y: 0.48 },
  { x: 0.65, y: 0.34 },
  { x: 0.8, y: 0.22 },
  { x: 0.9, y: 0.14 },
  { x: 1, y: 0.08 },
];

type Point = {
  x: number;
  y: number;
};

const buildGraphGeometry = (width: number, height: number) => {
  const points: Point[] = normalizedPoints.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));

  const pathData = points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(" ");

  const fillPathData = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];
    const segmentLength = Math.hypot(
      currentPoint.x - previousPoint.x,
      currentPoint.y - previousPoint.y,
    );

    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }

  const getPointAtProgress = (progress: number) => {
    if (progress <= 0) return points[0];
    if (progress >= 100) return points[points.length - 1];

    const targetLength = (progress / 100) * totalLength;
    let traversedLength = 0;

    for (let index = 0; index < segmentLengths.length; index += 1) {
      const segmentLength = segmentLengths[index];

      if (traversedLength + segmentLength >= targetLength) {
        const segmentProgress = (targetLength - traversedLength) / segmentLength;
        const startPoint = points[index];
        const endPoint = points[index + 1];

        return {
          x: startPoint.x + (endPoint.x - startPoint.x) * segmentProgress,
          y: startPoint.y + (endPoint.y - startPoint.y) * segmentProgress,
        };
      }

      traversedLength += segmentLength;
    }

    return points[points.length - 1];
  };

  return {
    fillPathData,
    pathData,
    pathLength: totalLength,
    pointAtProgress: getPointAtProgress,
  };
};

export default function GrowthGraph({
  className = "",
  variant = "compact",
}: GrowthGraphProps) {
  const prefersReducedMotion = useMotionPreference();
  const [progress, setProgress] = useState(prefersReducedMotion ? 100 : 0);
  const uniqueId = useId();
  const [fillOpacity, setFillOpacity] = useState(prefersReducedMotion ? 1 : 0);

  useEffect(() => {
    // If user prefers reduced motion, show final state immediately
    if (prefersReducedMotion) {
      setProgress(100);
      setFillOpacity(1);
      return;
    }

    // Animate the line drawing
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = 100 / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= 100) {
        setProgress(100);
        clearInterval(interval);
        // Fade in the fill after line completes
        setTimeout(() => {
          setFillOpacity(1);
        }, 200);
        // Reset after a pause
        setTimeout(() => {
          setFillOpacity(0);
          setTimeout(() => {
            setProgress(0);
            // Restart animation
            setTimeout(() => {
              current = 0;
              const restartInterval = setInterval(() => {
                current += increment;
                if (current >= 100) {
                  setProgress(100);
                  clearInterval(restartInterval);
                  setTimeout(() => setFillOpacity(1), 200);
                } else {
                  setProgress(current);
                }
              }, duration / steps);
            }, 500);
          }, 300);
        }, 3500);
      } else {
        setProgress(current);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const width = variant === "panel" ? 1000 : 400;
  const height = variant === "panel" ? 460 : 120;
  const { fillPathData, pathData, pathLength, pointAtProgress } = buildGraphGeometry(width, height);
  const activePoint = pointAtProgress(progress);

  if (variant === "panel") {
    return (
      <DecorativeWrapper
        className={`flex h-full w-full select-none pointer-events-none ${className}`}
      >
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.6rem] bg-[radial-gradient(circle_at_top,rgba(99,122,255,0.12),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:6.5rem_6.5rem]" />
          <div className="relative flex items-center justify-between text-sm text-muted sm:text-base">
            <span>Today</span>
            <span>Future</span>
          </div>
          <div className="relative mt-5 flex-1 min-h-[18rem]">
            <div className="absolute inset-x-0 bottom-0 top-0 rounded-[1.4rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]" />
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="relative block h-full w-full"
            >
              <defs>
                <linearGradient
                  id={`growthLineGradient-${uniqueId}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="var(--color-accent)" />
                  <stop offset="100%" stopColor="var(--color-accent-700)" />
                </linearGradient>
                <linearGradient
                  id={`growthFillGradient-${uniqueId}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
                </linearGradient>
                <filter
                  id={`growthGlow-${uniqueId}`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path
                d={fillPathData}
                fill={`url(#growthFillGradient-${uniqueId})`}
                style={{
                  opacity: fillOpacity,
                  transition: "opacity 0.5s ease-out",
                }}
              />

              <path
                d={pathData}
                fill="none"
                stroke={`url(#growthLineGradient-${uniqueId})`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#growthGlow-${uniqueId})`}
                style={{
                  strokeDasharray: pathLength,
                  strokeDashoffset: pathLength - (pathLength * progress) / 100,
                  transition: "stroke-dashoffset 0.05s linear",
                }}
              />

              {progress > 5 && (
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="10"
                  className="fill-accent"
                  style={{
                    filter: `url(#growthGlow-${uniqueId})`,
                    opacity: progress < 100 ? 1 : 0.85,
                  }}
                />
              )}
            </svg>
          </div>
        </div>
      </DecorativeWrapper>
    );
  }

  return (
    <DecorativeWrapper
      className={`-mx-6 -mb-6 mt-4 overflow-hidden rounded-b-2xl bg-text/10 select-none pointer-events-none ${className}`}
    >
      {/* Labels above the graph */}
      <div className="flex justify-between px-4 pt-3 pb-2 text-xs text-text/60">
        <span>Today</span>
        <span>Future</span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block"
      >
        {/* Growth line with gradient stroke */}
        <defs>
          <linearGradient
            id={`growthLineGradient-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-accent-700)" />
          </linearGradient>
          <linearGradient
            id={`growthFillGradient-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor="var(--color-accent)"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor="var(--color-accent)"
              stopOpacity="0.05"
            />
          </linearGradient>
          {/* Glow filter */}
          <filter
            id={`growthGlow-${uniqueId}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Filled area under the curve - fades in after line completes */}
        <path
          d={fillPathData}
          fill={`url(#growthFillGradient-${uniqueId})`}
          style={{
            opacity: fillOpacity,
            transition: "opacity 0.5s ease-out",
          }}
        />

        {/* Animated growth line */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#growthLineGradient-${uniqueId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#growthGlow-${uniqueId})`}
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength - (pathLength * progress) / 100,
            transition: "stroke-dashoffset 0.05s linear",
          }}
        />

        {/* Dot at the end of the line */}
        {progress > 5 && (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="5"
            className="fill-accent"
            style={{
              filter: `url(#growthGlow-${uniqueId})`,
              opacity: progress < 100 ? 1 : 0.8,
            }}
          />
        )}
      </svg>
    </DecorativeWrapper>
  );
}
