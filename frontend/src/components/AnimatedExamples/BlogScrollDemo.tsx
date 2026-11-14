// src/components/AnimatedExamples/BlogScrollDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface BlogScrollDemoProps {
  className?: string;
}

export default function BlogScrollDemo({ className = "" }: BlogScrollDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [scrollY, setScrollY] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Total scroll distance for the animation (content height minus viewport)
  const maxScroll = 320;

  useEffect(() => {
    if (prefersReducedMotion) {
      setScrollY(maxScroll / 2); // Show middle state
      return;
    }

    setScrollY(0);

    let frame: number;
    let startTime: number | null = null;
    const duration = 6000; // 6 seconds for full scroll

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      // Ease in-out scroll animation
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setScrollY(easeProgress * maxScroll);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 7500);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resetTimer);
    };
  }, [animationKey, prefersReducedMotion]);

  // Calculate read progress percentage
  const readProgress = Math.min((scrollY / maxScroll) * 100, 100);

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
          <span className="text-[10px] text-text/70">yoursite.com/blog/why-content-keeps-working</span>
        </div>
      </div>


      {/* Blog content area */}
      <div className="bg-bg2 relative h-[160px] overflow-hidden">
        {/* Scrollable content */}
        <div
          className="absolute left-0 right-0 p-3 transition-transform duration-100"
          style={{ transform: `translateY(-${scrollY}px)` }}
        >
          {/* Blog header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] text-text/50">Published 8 months ago</span>
            </div>
            <h2 className="text-[11px] text-text mb-1.5 leading-tight">Why Your Blog Posts Keep Working Long After You Write Them</h2>
          </div>

          {/* Article content - real text */}
          <div className="space-y-2 text-[8px] text-text/70 leading-relaxed">
            <p>
              Every piece of content you publish becomes an asset that continues to attract readers months and years down the road. Unlike social media posts that disappear within hours, a well-crafted blog post keeps showing up in search results, answering questions, and bringing new visitors to your site.
            </p>

            <p>
              The beauty of this approach is that your library of content grows over time. Each new article adds to your collection, and older posts continue pulling their weight. A post you wrote six months ago might still be your top traffic driver today.
            </p>

            <p>
              This compounds. Businesses with consistent blogs often find that their older content generates more traffic than their newer posts. The articles have had time to be discovered, shared, and linked to by others. Search engines reward content that has been around longer and has proven its value to readers.
            </p>

            <p>
              When your site is built properly, these posts remain stable and functional as your site evolves. Links stay intact, formatting stays clean, and readers can always find what they came for. Nothing breaks when you update your design or add new features.
            </p>

            <p>
              Think of each blog post as a small employee that works for you around the clock. It never calls in sick, never asks for a raise, and never stops bringing in new visitors. Over time, you build a team of these tireless workers, each one contributing to your bottom line.
            </p>

            <p>
              The key is consistency. Businesses that publish regularly see their traffic grow month over month, even if individual posts perform modestly. The cumulative effect is what matters. Ten posts that each bring in twenty visitors per month means two hundred visitors, and that number only grows as you add more.
            </p>

            <p>
              Consider this: a single blog post that ranks well can bring in visitors for years. We have seen posts written three years ago still driving hundreds of visits per month. That is the power of evergreen content built on a stable foundation.
            </p>

            <p>
              Your competitors who only post on social media are starting from zero every single day. Meanwhile, your blog is quietly working in the background, building authority and attracting readers while you sleep.
            </p>

            <p>
              The math is simple. If you publish one post per week for a year, you have fifty-two assets working for you. After two years, you have over one hundred. Each one compounds on the others, creating a network of content that reinforces itself.
            </p>

            <p>
              This is the kind of sustainable growth that pays dividends over time. Your content keeps working so you can focus on what matters most: running your business and serving your customers.
            </p>

            <p>
              Ready to start building your content library? The best time to start was yesterday. The second best time is today. Every post you publish is an investment in your future traffic.
            </p>
          </div>
        </div>

        {/* Fade overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-bg2 to-transparent" />
      </div>

    </DecorativeWrapper>
  );
}
