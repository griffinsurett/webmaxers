// src/components/AnimatedExamples/LeadsSpreadsheet.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface LeadsSpreadsheetProps {
  className?: string;
}

const leadData = [
  { name: "Sarah M.", source: "Google", status: "qualified" },
  { name: "James R.", source: "Meta Ad", status: "new" },
  { name: "Maria L.", source: "Direct", status: "qualified" },
  { name: "David K.", source: "Google", status: "converted" },
  { name: "Emma T.", source: "Meta Ad", status: "new" },
  { name: "Michael B.", source: "Referral", status: "qualified" },
  { name: "Lisa P.", source: "Google", status: "new" },
  { name: "Chris W.", source: "Meta Ad", status: "converted" },
];

export default function LeadsSpreadsheet({ className = "" }: LeadsSpreadsheetProps) {
  const prefersReducedMotion = useMotionPreference();
  const [visibleRows, setVisibleRows] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleRows(leadData.length);
      setTotalLeads(247);
      return;
    }

    setVisibleRows(0);
    setTotalLeads(239);

    const timers: NodeJS.Timeout[] = [];

    // Add rows one by one
    leadData.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleRows(index + 1);
          setTotalLeads(prev => prev + 1);
        }, 600 + index * 500)
      );
    });

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 600 + leadData.length * 500 + 2000);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500/20 text-blue-400";
      case "qualified": return "bg-yellow-500/20 text-yellow-400";
      case "converted": return "bg-green-500/20 text-green-400";
      default: return "bg-text/20 text-text/60";
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Google": return "G";
      case "Meta Ad": return "f";
      case "Direct": return "→";
      case "Referral": return "★";
      default: return "•";
    }
  };

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Spreadsheet header */}
      <div className="bg-bg2 px-3 py-2 flex items-center justify-between border-b border-text/10">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h4v4H7V7zm0 6h4v4H7v-4zm6-6h4v4h-4V7zm0 6h4v4h-4v-4z"/>
          </svg>
          <span className="text-xs font-medium text-text">Leads Dashboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-text/60">Live</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-bg2/50 px-3 py-1.5 flex items-center gap-4 border-b border-text/10">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text/50">Total:</span>
          <span className="text-xs font-semibold text-primary tabular-nums">{totalLeads}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text/50">This week:</span>
          <span className="text-xs font-semibold text-green-400 tabular-nums">+{visibleRows}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_70px] gap-1 px-3 py-1.5 bg-bg2/30 border-b border-text/10">
        <span className="text-[9px] font-semibold text-text/50 uppercase tracking-wider">Name</span>
        <span className="text-[9px] font-semibold text-text/50 uppercase tracking-wider">Source</span>
        <span className="text-[9px] font-semibold text-text/50 uppercase tracking-wider">Status</span>
      </div>

      {/* Spreadsheet rows */}
      <div className="h-[120px] overflow-hidden">
        <div className="divide-y divide-text/5">
          {leadData.slice(0, visibleRows).map((lead, index) => (
            <div
              key={`${animationKey}-${index}`}
              className={`grid grid-cols-[1fr_60px_70px] gap-1 px-3 py-1.5 items-center transition-all duration-300 ${
                index === visibleRows - 1 && !prefersReducedMotion
                  ? "bg-primary/10 animate-pulse"
                  : "bg-transparent"
              }`}
              style={{
                opacity: prefersReducedMotion ? 1 : undefined,
                animation: prefersReducedMotion ? "none" : index === visibleRows - 1 ? undefined : "none",
              }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-text/20 flex items-center justify-center">
                  <span className="text-[9px] font-medium text-text/70">
                    {lead.name.charAt(0)}
                  </span>
                </div>
                <span className="text-[11px] text-text truncate">{lead.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text/50">{getSourceIcon(lead.source)}</span>
                <span className="text-[10px] text-text/70 truncate">{lead.source}</span>
              </div>
              <div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(lead.status)}`}>
                  {lead.status}
                </span>
              </div>
            </div>
          ))}

          {/* New row indicator */}
          {visibleRows < leadData.length && !prefersReducedMotion && (
            <div className="grid grid-cols-[1fr_60px_70px] gap-1 px-3 py-1.5 items-center opacity-30">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-text/10 animate-pulse" />
                <div className="h-2 w-16 bg-text/10 rounded animate-pulse" />
              </div>
              <div className="h-2 w-10 bg-text/10 rounded animate-pulse" />
              <div className="h-4 w-12 bg-text/10 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Footer with scroll indicator */}
      <div className="bg-bg2/30 px-3 py-1.5 flex items-center justify-between border-t border-text/10">
        <span className="text-[9px] text-text/40">
          Showing {visibleRows} of {totalLeads} leads
        </span>
        <div className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full ${i === 0 ? "bg-primary" : "bg-text/20"}`}
            />
          ))}
        </div>
      </div>
    </DecorativeWrapper>
  );
}
