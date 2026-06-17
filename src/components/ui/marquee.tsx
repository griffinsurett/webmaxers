import React from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  const strips = React.useMemo(
    () =>
      Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 [gap:var(--gap)]",
            vertical ? "flex-col" : "flex-row",
            vertical ? "animate-marquee-vertical" : "animate-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
            "[will-change:transform] [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
          )}
        >
          {children}
        </div>
      )),
    [repeat, children, vertical, pauseOnHover, reverse],
  );

  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        className,
      )}
    >
      {strips}
    </div>
  );
}
