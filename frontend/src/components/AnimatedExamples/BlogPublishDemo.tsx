// src/components/AnimatedExamples/BlogPublishDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface BlogPublishDemoProps {
  className?: string;
}

const existingPosts = [
  { title: "Getting Started Guide", date: "Dec 15", reads: "234" },
  { title: "Tips for Better Results", date: "Dec 8", reads: "189" },
];

const newPost = { title: "Your Latest Post", date: "Today", reads: "New" };

export default function BlogPublishDemo({ className = "" }: BlogPublishDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - show existing posts only
  // 1: New post starts appearing (height expands, pushes others down)
  // 2: New post fully visible
  // 3: Cursor appears
  // 4: Cursor moves to new post
  // 5: Hover effect on new post
  // 6: Click effect
  // 7: Success - post "opens"

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(7);
      return;
    }

    setStep(0);

    const timings = [
      600,   // Step 1: New post starts expanding
      1200,  // Step 2: New post fully visible
      1800,  // Step 3: Cursor appears
      2400,  // Step 4: Cursor moves to post
      3000,  // Step 5: Hover
      3600,  // Step 6: Click
      4000,  // Step 7: Success
    ];

    const timers: NodeJS.Timeout[] = [];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 6000);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const isExpanding = step === 1;
  const showNewPost = step >= 2;
  const showCursor = step >= 3 && step < 7;
  const isHovering = step >= 5 && step < 7;
  const isClicking = step === 6;
  const showSuccess = step === 7;

  const getCursorPosition = () => {
    if (step <= 3) return { left: "80%", top: "75%" };
    if (step >= 4) return { left: "50%", top: "32%" }; // On new post
    return { left: "80%", top: "75%" };
  };

  const cursorPos = getCursorPosition();

  // Calculate the height/offset for push-down animation
  const getNewPostStyle = () => {
    if (prefersReducedMotion || step >= 2) {
      return { height: "auto", opacity: 1, marginBottom: "6px" };
    }
    if (step === 1) {
      return { height: "48px", opacity: 0.7, marginBottom: "6px" };
    }
    return { height: "0px", opacity: 0, marginBottom: "0px", overflow: "hidden" };
  };

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
          <span className="text-[10px] text-text/70">yoursite.com/blog</span>
        </div>
      </div>

      {/* Blog content */}
      <div className="bg-bg2 p-3 relative h-[150px] overflow-hidden">
        {/* Blog header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-text">Blog Posts</h3>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${step >= 1 ? "bg-green-500 animate-pulse" : "bg-text/30"}`} />
            <span className="text-[9px] text-text/60">{step >= 1 ? "Publishing..." : "Ready"}</span>
          </div>
        </div>

        {/* Posts list */}
        <div>
          {/* New post - animates in by expanding height and pushing others down */}
          <div
            className={`transition-all duration-500 ease-out overflow-hidden ${
              isHovering && !showSuccess ? "ring-2 ring-primary/50 rounded-lg" : ""
            } ${isClicking ? "scale-[0.98]" : ""} ${showSuccess ? "ring-2 ring-primary rounded-lg" : ""}`}
            style={getNewPostStyle()}
          >
            <div className={`bg-bg3/80 rounded-lg p-2 flex items-center gap-2 transition-all duration-300 ${
              isHovering ? "bg-primary/15" : ""
            } ${showSuccess ? "bg-primary/20" : ""}`}>
              {/* Thumbnail placeholder */}
              <div className={`w-8 h-8 rounded bg-primary/30 flex items-center justify-center shrink-0 ${
                (isExpanding || (showNewPost && step < 4)) && !prefersReducedMotion ? "animate-pulse" : ""
              }`}>
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-text truncate">{newPost.title}</span>
                  <span className="text-[8px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded-full font-medium shrink-0">
                    {newPost.reads}
                  </span>
                </div>
                <span className="text-[9px] text-text/50">{newPost.date}</span>
              </div>
            </div>
          </div>

          {/* Existing posts - pushed down by new post */}
          <div className="space-y-1.5 transition-all duration-500">
            {existingPosts.map((post, index) => (
              <div
                key={index}
                className={`bg-bg3/50 rounded-lg p-2 flex items-center gap-2 transition-all duration-500 ${
                  step >= 1 ? "opacity-60" : "opacity-100"
                }`}
              >
                {/* Thumbnail placeholder */}
                <div className="w-8 h-8 rounded bg-text/10 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-text/70 truncate">{post.title}</span>
                    <span className="text-[8px] px-1 py-0.5 bg-text/10 text-text/50 rounded-full shrink-0">
                      {post.reads}
                    </span>
                  </div>
                  <span className="text-[9px] text-text/40">{post.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Animated cursor */}
        {showCursor && !prefersReducedMotion && (
          <div
            className="absolute pointer-events-none transition-all duration-500 ease-out z-10"
            style={{
              left: cursorPos.left,
              top: cursorPos.top,
              transform: `translate(-50%, -50%) ${isClicking ? "scale(0.8)" : "scale(1)"}`,
            }}
          >
            <svg
              className={`w-5 h-5 drop-shadow-md transition-transform duration-100 ${isClicking ? "rotate-12" : ""}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M4 4l16 8-7 2-2 7-7-17z"
                className={isHovering ? "text-primary" : "text-text/80"}
              />
            </svg>

            {/* Click ripple */}
            {isClicking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-6 h-6 rounded-full bg-primary/40 animate-ping" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-bg2/50 px-3 py-1.5 flex items-center justify-between border-t border-text/10">
        <span className="text-[9px] text-text/50">
          {showSuccess
            ? "Opening post..."
            : step >= 2
              ? "New post published!"
              : step >= 1
                ? "Publishing new post..."
                : "2 posts"}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-text/40">{step >= 1 ? "3" : "2"} posts</span>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
