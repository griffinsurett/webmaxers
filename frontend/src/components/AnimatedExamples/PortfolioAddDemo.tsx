import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface PortfolioAddDemoProps {
  className?: string;
}

const existingPhotos = [
  { title: "Golden Hour Portrait", color: "from-amber-600 to-orange-800" },
  { title: "Urban Architecture", color: "from-slate-500 to-zinc-700" },
  { title: "Ocean Sunset", color: "from-sky-400 to-indigo-600" },
];

const newPhoto = { title: "Mountain Landscape", color: "from-emerald-500 to-teal-700" };

export default function PortfolioAddDemo({ className = "" }: PortfolioAddDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - show existing photos
  // 1: Dashed placeholder appears, pushing existing down
  // 2: Photo starts filling in (loading)
  // 3: Photo fully loaded
  // 4: Success state with badge

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(4);
      return;
    }

    setStep(0);

    const step1 = setTimeout(() => setStep(1), 800);
    const step2 = setTimeout(() => setStep(2), 1600);
    const step3 = setTimeout(() => setStep(3), 2800);
    const step4 = setTimeout(() => setStep(4), 3400);

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 5500);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
      clearTimeout(step4);
      clearTimeout(resetTimer);
    };
  }, [animationKey, prefersReducedMotion]);

  const showSlot = step >= 1;
  const isLoading = step === 2;
  const showPhoto = step >= 3;
  const showSuccess = step >= 4;

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Browser chrome */}
      <div className="bg-bg2 px-3 py-2 flex items-center gap-2 border-b border-text/10">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 bg-bg3 rounded px-2 py-0.5">
          <span className="text-[10px] text-text/70">emilycarter.com/portfolio</span>
        </div>
      </div>

      {/* Portfolio content */}
      <div className="bg-neutral-900 p-3 relative h-[200px] overflow-hidden">
        {/* Page header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[11px] text-white">Photography Portfolio</h3>
            <p className="text-[8px] text-white/50">Recent work</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-300 ${
            step >= 1 && step < 4 ? 'bg-green-500/20' : 'bg-white/10'
          }`}>
            {step >= 1 && step < 4 && !prefersReducedMotion && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            )}
            <span className="text-[8px] text-white/70">
              {step >= 1 && step < 4 ? 'Adding photo...' : `${showSuccess ? 4 : 3} photos`}
            </span>
          </div>
        </div>

        {/* Portfolio grid - alternating left/right layout */}
        <div className="space-y-2">
          {/* NEW PHOTO SLOT - at the top */}
          <div
            className={`transition-all duration-500 ease-out overflow-hidden ${
              showSlot ? 'h-[52px] opacity-100 mb-2' : 'h-0 opacity-0 mb-0'
            }`}
          >
            <div className="flex justify-start">
              <div
                className={`w-[60%] h-[52px] rounded-lg relative overflow-hidden transition-all duration-500 ${
                  showPhoto
                    ? `bg-gradient-to-br ${newPhoto.color}`
                    : isLoading
                      ? 'bg-white/5'
                      : 'bg-transparent border-2 border-dashed border-white/30'
                } ${showSuccess ? 'ring-2 ring-green-400/60' : ''}`}
              >
                {/* Dashed state - before loading */}
                {showSlot && !isLoading && !showPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      <span className="text-[9px] text-white/40">New photo</span>
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {isLoading && !prefersReducedMotion && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                      <span className="text-[9px] text-white/60">Uploading...</span>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                      <div className="h-full bg-green-500/70 animate-progress" />
                    </div>
                  </div>
                )}

                {/* Loaded photo */}
                {showPhoto && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
                      <span className="text-[9px] text-white font-medium">{newPhoto.title}</span>
                      {showSuccess && (
                        <span className="text-[7px] px-1.5 py-0.5 bg-green-500/40 text-green-200 rounded-full font-medium">
                          ✓ Added
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Existing photos - pushed down when new photo appears */}
          {existingPhotos.map((photo, index) => (
            <div
              key={index}
              className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'} transition-all duration-500`}
              style={{
                opacity: showSlot ? 0.7 : 1,
              }}
            >
              <div
                className={`w-[60%] h-[44px] rounded-lg bg-gradient-to-br ${photo.color} relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 left-2">
                  <span className="text-[8px] text-white/90 font-medium">{photo.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-bg2/50 px-3 py-1.5 flex items-center justify-between border-t border-text/10">
        <span className="text-[9px] text-text/50">
          {showSuccess
            ? "Photo published!"
            : showPhoto
              ? "Processing..."
              : isLoading
                ? "Uploading mountain-landscape.jpg..."
                : showSlot
                  ? "Preparing upload..."
                  : "Portfolio ready"}
        </span>
        <span className="text-[9px] text-text/40">
          {showSuccess ? "4 photos" : "3 photos"}
        </span>
      </div>

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 1.2s ease-out forwards;
        }
      `}</style>
    </DecorativeWrapper>
  );
}
