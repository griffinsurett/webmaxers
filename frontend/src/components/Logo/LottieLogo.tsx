import OptimizedLottie from "@/components/OptimizedLottie";
import type { PropsWithChildren } from "react";

interface LottieLogoProps {
  alt?: string;
  className?: string;
  mediaClasses?: string;
  loading?: "lazy" | "eager";
  trigger?: "auto" | "scroll" | "visible" | "load";
  respectReducedMotion?: boolean;
  fadeMs?: number;
  loop?: boolean;
  autoplay?: boolean;
  decorative?: boolean;
}

const ANIMATION_URL = "/lotties/Animation_logo_small_size.json";

export default function LottieLogo({
  alt = "",
  className = "logo-class",
  mediaClasses = "block w-[40px] h-[40px] lg:w-[45px] lg:h-[45px] object-contain",
  trigger = "auto",
  respectReducedMotion = true,
  fadeMs = 180,
  loop = true,
  autoplay = false,
  decorative = true,
  children,
}: PropsWithChildren<LottieLogoProps>) {
  // OptimizedLottie already renders `children` as the static fallback and keeps
  // it shown whenever motion is disabled (never loading the Lottie player), so
  // we let it own the reduced-motion path. Branching to a separate tree here
  // remounted the subtree on every motion toggle, which re-fired the logo's
  // one-shot spin animation — the placeholder "going insane".
  return (
    <OptimizedLottie
      animationUrl={ANIMATION_URL}
      alt={decorative ? "" : alt}
      className={className}
      containerClasses={`relative ${mediaClasses}`}
      trigger={trigger}
      respectReducedMotion={respectReducedMotion}
      fadeMs={fadeMs}
      rewindToStartOnTop
      loop={loop}
      autoplay={autoplay}
      speed={0.5}
      renderer="svg"
      scrollThreshold={1}
      debounceDelay={8}
      wheelSensitivity={1}
      decorative={decorative}
    >
      {children}
    </OptimizedLottie>
  );
}
