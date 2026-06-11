import OptimizedLottie from "@/components/OptimizedLottie";
import { useMotionPreference } from "@/hooks/useMotionPreference";
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
  const shouldDisableMotion = useMotionPreference(respectReducedMotion);
  const accessibilityProps = decorative
    ? { "aria-hidden": true, role: "presentation" as const }
    : { "aria-label": alt };

  // If reduced motion is enabled, just render the static fallback - don't load Lottie at all
  if (shouldDisableMotion) {
    return (
      <div className={`${className} relative ${mediaClasses}`} {...accessibilityProps}>
        {children}
      </div>
    );
  }

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
