// src/components/AnimatedExamples/ScalabilityDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface ScalabilityDemoProps {
  className?: string;
}

const salesData = [
  { id: "#2341", product: "Jacket", amount: 149 },
  { id: "#2342", product: "Sneakers", amount: 89 },
  { id: "#2343", product: "Watch", amount: 299 },
  { id: "#2344", product: "Bag", amount: 65 },
  { id: "#2345", product: "Shirt", amount: 45 },
  { id: "#2346", product: "Boots", amount: 175 },
  { id: "#2347", product: "Hat", amount: 35 },
  { id: "#2348", product: "Jeans", amount: 79 },
  { id: "#2349", product: "Dress", amount: 120 },
  { id: "#2350", product: "Shoes", amount: 95 },
  { id: "#2351", product: "Coat", amount: 220 },
  { id: "#2352", product: "Belt", amount: 40 },
];

export default function ScalabilityDemo({ className = "" }: ScalabilityDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [scrollY, setScrollY] = useState(0);
  const [visibleSales, setVisibleSales] = useState(3);
  const [totalRevenue, setTotalRevenue] = useState(537);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setScrollY(100);
      setVisibleSales(salesData.length);
      setTotalRevenue(1411);
      return;
    }

    setScrollY(0);
    setVisibleSales(3);
    setTotalRevenue(537);

    const scrollInterval = setInterval(() => {
      setScrollY(prev => {
        if (prev >= 120) return prev;
        return prev + 2;
      });
    }, 50);

    const salesInterval = setInterval(() => {
      setVisibleSales(prev => {
        if (prev >= salesData.length) return prev;
        const newCount = prev + 1;
        // Calculate new total
        const newTotal = salesData.slice(0, newCount).reduce((sum, s) => sum + s.amount, 0);
        setTotalRevenue(newTotal);
        return newCount;
      });
    }, 400);

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 7000);

    return () => {
      clearInterval(scrollInterval);
      clearInterval(salesInterval);
      clearTimeout(resetTimer);
    };
  }, [animationKey, prefersReducedMotion]);

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Header bar */}
      <div className="bg-bg2 px-3 py-2 flex items-center gap-2 border-b border-text/10">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="text-[8px] text-green-500 font-medium animate-pulse">●</span>
          <span className="text-[9px] text-text/70">Site stable • Sales flowing</span>
        </div>
      </div>

      {/* Two panels side by side */}
      <div className="bg-bg2 p-2 grid grid-cols-2 gap-2 min-h-[200px]">
        {/* Left: Scrolling e-commerce site */}
        <div className="bg-bg3 rounded-lg overflow-hidden">
          <div className="bg-text/5 px-2 py-1 border-b border-text/10 flex items-center justify-between">
            <span className="text-[8px] font-semibold text-text">yourstore.com</span>
            <div className="flex items-center gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[6px] text-green-500">Online</span>
            </div>
          </div>

          {/* Scrollable content viewport */}
          <div className="h-[160px] overflow-hidden relative">
            <div
              className="transition-transform duration-100 ease-linear"
              style={{ transform: `translateY(-${scrollY}px)` }}
            >
              {/* Hero section */}
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5">
                <div className="text-[8px] font-semibold text-text mb-1">Winter Sale</div>
                <div className="text-[6px] text-text/60">Up to 50% off</div>
                <div className="mt-1 bg-primary rounded px-2 py-0.5 inline-block">
                  <span className="text-[6px] text-white font-medium">Shop Now</span>
                </div>
              </div>

              {/* Product grid */}
              <div className="p-2">
                <div className="text-[7px] font-semibold text-text mb-1">Featured Products</div>
                <div className="grid grid-cols-2 gap-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-text/5 rounded p-1">
                      <div className="w-full aspect-square bg-text/10 rounded mb-1 flex items-center justify-center">
                        <span className="text-[10px]">{['👕', '👟', '⌚', '👜', '👒', '👖'][i-1]}</span>
                      </div>
                      <div className="text-[5px] text-text truncate">Product {i}</div>
                      <div className="text-[6px] text-text font-semibold">${[45, 89, 299, 65, 35, 79][i-1]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* More content */}
              <div className="p-2 bg-text/5">
                <div className="text-[7px] font-semibold text-text mb-1">New Arrivals</div>
                <div className="grid grid-cols-2 gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-bg3 rounded p-1">
                      <div className="w-full aspect-square bg-text/10 rounded mb-1 flex items-center justify-center">
                        <span className="text-[10px]">{['🧥', '👗', '🥾', '🧣'][i-1]}</span>
                      </div>
                      <div className="text-[5px] text-text truncate">New Item {i}</div>
                      <div className="text-[6px] text-text font-semibold">${[149, 120, 175, 55][i-1]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute right-0.5 top-2 bottom-2 w-1 bg-text/10 rounded-full">
              <div
                className="w-1 bg-text/30 rounded-full transition-all duration-100"
                style={{
                  height: '30%',
                  transform: `translateY(${scrollY * 0.8}%)`
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: Live sales spreadsheet */}
        <div className="bg-bg3 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-text/5 px-2 py-1 border-b border-text/10 flex items-center justify-between">
            <span className="text-[8px] font-semibold text-text">📊 Live Sales</span>
            <span className="text-[6px] text-green-500 animate-pulse">● Updating</span>
          </div>

          {/* Total revenue banner */}
          <div className="bg-green-500/10 px-2 py-1.5 border-b border-green-500/20">
            <div className="text-[6px] text-text/60">Today's Revenue</div>
            <div className="text-[12px] font-semibold text-green-500 tabular-nums">
              ${totalRevenue.toLocaleString()}
            </div>
          </div>

          {/* Sales table */}
          <div className="flex-1 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-1 px-1.5 py-1 bg-text/5 border-b border-text/10">
              <span className="text-[6px] font-semibold text-text/70">Order</span>
              <span className="text-[6px] font-semibold text-text/70">Item</span>
              <span className="text-[6px] font-semibold text-text/70 text-right">Amount</span>
            </div>

            {/* Sales rows - scrolling container */}
            <div className="h-[90px] overflow-hidden relative">
              <div className="absolute bottom-0 left-0 right-0">
                {salesData.slice(0, visibleSales).map((sale, idx) => (
                  <div
                    key={sale.id}
                    className={`grid grid-cols-3 gap-1 px-1.5 py-0.5 border-b border-text/5 ${
                      idx === visibleSales - 1 && !prefersReducedMotion
                        ? "bg-green-500/20 animate-[fadeIn_0.3s_ease-out]"
                        : ""
                    }`}
                  >
                    <span className="text-[6px] text-text">{sale.id}</span>
                    <span className="text-[6px] text-text truncate">{sale.product}</span>
                    <span className={`text-[6px] text-right font-medium ${
                      idx === visibleSales - 1 && !prefersReducedMotion
                        ? "text-green-500"
                        : "text-text"
                    }`}>
                      ${sale.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order count */}
          <div className="px-2 py-1 bg-text/5 border-t border-text/10 flex items-center justify-between">
            <span className="text-[6px] text-text/60">Orders today</span>
            <span className="text-[7px] font-semibold text-text">{visibleSales}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; background-color: rgba(34, 197, 94, 0.4); }
          to { opacity: 1; background-color: rgba(34, 197, 94, 0.2); }
        }
      `}</style>
    </DecorativeWrapper>
  );
}
