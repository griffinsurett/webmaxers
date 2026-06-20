// src/components/AnimatedExamples/AiAgentsWorkflow.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { FaEnvelope, FaCalendarCheck, FaFileInvoiceDollar, FaSlack, FaRobot, FaDatabase } from "react-icons/fa6";

export default function AiAgentsWorkflow() {
  const [step, setStep] = useState(0);

  // Simple step loops:
  // 0: Idle/Waiting for Lead
  // 1: Customer Lead Arrives (Email icon flows to core)
  // 2: AI Core Processing (Core glows, database lookup runs)
  // 3: Dispatching Outcomes (Calendar booked, invoice synced, Slack alerted)
  // 4: Complete State (All successful)
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-3xl mx-auto h-[340px] md:h-[400px] bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-white/5 p-6 overflow-hidden flex flex-col justify-between shadow-2xl">
      {/* Title Header Bar */}
      <div className="flex justify-between items-center z-10 border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold tracking-[0.18em]">Live System Simulation</span>
          <h4 className="text-sm font-medium text-zinc-100">
            {step === 0 && "Waiting for incoming lead..."}
            {step === 1 && "Incoming customer inquiry detected"}
            {step === 2 && "AI Agent analyzes inquiry & checking database"}
            {step === 3 && "Deploying automations & tools..."}
            {step === 4 && "All outcomes completed successfully!"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/5">
          <span className={`w-2 h-2 rounded-full ${step === 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-[10px] font-mono uppercase text-zinc-400">
            {step === 0 ? 'standby' : 'processing'}
          </span>
        </div>
      </div>

      {/* Main visual interface - Fixed height coordinate container */}
      <div className="relative flex-1 w-full max-w-2xl mx-auto h-[240px] mt-4 select-none">
        
        {/* SVG Canvas with matching coordinate mapping (width: 600, height: 240) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 240" style={{ zIndex: 0 }}>
          {/* Path Left (Trigger) -> Center (Core): perfectly straight line */}
          <path
            d="M 130,120 H 250"
            fill="none"
            stroke={step >= 1 ? "#ffffff" : "#27272a"}
            strokeOpacity={step >= 1 ? 0.35 : 0.15}
            strokeWidth="1.5"
            strokeDasharray={step === 1 ? "4 4" : "0"}
            className="transition-all duration-500"
          />
          {/* Path Center (Core) -> Right Top (Calendar): orthogonal layout */}
          <path
            d="M 330,120 H 390 V 24 H 450"
            fill="none"
            stroke={step >= 3 ? "#10b981" : "#27272a"}
            strokeOpacity={step >= 3 ? 0.6 : 0.25}
            strokeWidth="1.5"
            strokeDasharray={step === 3 ? "4 4" : "0"}
            className="transition-all duration-500"
          />
          {/* Path Center (Core) -> Right Middle (QuickBooks): perfectly straight line */}
          <path
            d="M 330,120 H 450"
            fill="none"
            stroke={step >= 3 ? "#10b981" : "#27272a"}
            strokeOpacity={step >= 3 ? 0.6 : 0.25}
            strokeWidth="1.5"
            strokeDasharray={step === 3 ? "4 4" : "0"}
            className="transition-all duration-500"
          />
          {/* Path Center (Core) -> Right Bottom (Slack): orthogonal layout */}
          <path
            d="M 330,120 H 390 V 216 H 450"
            fill="none"
            stroke={step >= 3 ? "#10b981" : "#27272a"}
            strokeOpacity={step >= 3 ? 0.6 : 0.25}
            strokeWidth="1.5"
            strokeDasharray={step === 3 ? "4 4" : "0"}
            className="transition-all duration-500"
          />

          {/* Flow Particles */}
          <AnimatePresence>
            {step === 1 && (
              <circle r="3" fill="rgba(255,255,255,0.7)">
                <animateMotion dur="1s" repeatCount="indefinite" path="M 130,120 H 250" />
              </circle>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step === 3 && (
              <>
                {/* Particle to Calendar */}
                <circle r="2.5" fill="#10b981">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path="M 330,120 H 390 V 24 H 450" />
                </circle>
                {/* Particle to QuickBooks */}
                <circle r="2.5" fill="#10b981">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path="M 330,120 H 450" />
                </circle>
                {/* Particle to Slack */}
                <circle r="2.5" fill="#10b981">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path="M 330,120 H 390 V 216 H 450" />
                </circle>
              </>
            )}
          </AnimatePresence>
        </svg>

        {/* ── HTML Nodes Positioned to Match SVG coordinates ── */}
        
        {/* Trigger Node (Left) */}
        <div className="absolute left-[0%] w-[21.6%] top-[50%] -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <div className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">trigger</div>
          <motion.div
            className={`w-14 h-14 rounded-xl flex items-center justify-center border text-xl ${
              step >= 1
                ? "bg-zinc-800/70 border-white/20 text-zinc-100"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
            } transition-all duration-500`}
            animate={step === 1 ? { scale: [1, 1.12, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <FaEnvelope />
          </motion.div>
          <div className="text-[10px] text-zinc-300 text-center font-medium leading-tight">
            Quote Inquiry<br/>
            <span className="text-zinc-500 font-normal">via Email</span>
          </div>
        </div>

        {/* AI Agent Core (Center) */}
        <div className="absolute left-[41.6%] w-[13.3%] top-[50%] -translate-y-1/2 flex flex-col items-center justify-center z-10">
          <div className="relative flex items-center justify-center">
            <AnimatePresence>
              {step === 2 && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.6, opacity: 0.06 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                    className="absolute w-24 h-24 rounded-full bg-white"
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 2.4, opacity: 0.025 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                    className="absolute w-24 h-24 rounded-full bg-white"
                  />
                </>
              )}
            </AnimatePresence>

            <motion.div
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border shadow-lg relative ${
                step >= 2
                  ? "bg-zinc-800/60 border-white/20 text-zinc-100"
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
              } transition-all duration-500`}
              animate={
                step === 2
                  ? { rotate: 360, scale: 1.05 }
                  : step > 2
                  ? { scale: 1 }
                  : {}
              }
              transition={step === 2 ? { rotate: { repeat: Infinity, duration: 8, ease: "linear" } } : {}}
            >
              <FaRobot className="text-xl" />
              {step === 2 && (
                <span className="absolute -bottom-1 -right-1 bg-zinc-900 border border-white/15 rounded-full p-1 text-[8px] text-zinc-300 animate-pulse">
                  <FaDatabase />
                </span>
              )}
            </motion.div>
          </div>
          <div className="text-[9px] text-zinc-400 mt-2 font-bold tracking-wide uppercase text-center whitespace-nowrap">
            AI Agent Core
          </div>
        </div>

        {/* Outcomes Stack (Right) */}
        <div className="absolute left-[75%] w-[25%] h-full z-10">
          
          {/* Outcome 1: Calendar */}
          <div className="absolute top-[0px] h-[48px] flex items-center gap-2">
            <motion.div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border text-sm shrink-0 ${
                step >= 3
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-650"
              } transition-all duration-500`}
              animate={step === 3 ? { scale: [1, 1.1, 1] } : {}}
            >
              <FaCalendarCheck />
            </motion.div>
            <div className="text-[10px] leading-tight">
              <span className={step >= 3 ? "text-zinc-200 font-medium" : "text-zinc-500"}>Calendar</span>
              <br/>
              <span className={step >= 3 ? "text-emerald-400/90 font-mono" : "text-zinc-650"}>Booked ✓</span>
            </div>
          </div>

          {/* Outcome 2: QuickBooks */}
          <div className="absolute top-[96px] h-[48px] flex items-center gap-2">
            <motion.div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border text-sm shrink-0 ${
                step >= 3
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-650"
              } transition-all duration-500`}
              animate={step === 3 ? { scale: [1, 1.1, 1], transition: { delay: 0.15 } } : {}}
            >
              <FaFileInvoiceDollar />
            </motion.div>
            <div className="text-[10px] leading-tight">
              <span className={step >= 3 ? "text-zinc-200 font-medium" : "text-zinc-500"}>QuickBooks</span>
              <br/>
              <span className={step >= 3 ? "text-emerald-400/90 font-mono" : "text-zinc-650"}>Synced ✓</span>
            </div>
          </div>

          {/* Outcome 3: Slack */}
          <div className="absolute top-[192px] h-[48px] flex items-center gap-2">
            <motion.div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border text-sm shrink-0 ${
                step >= 3
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-650"
              } transition-all duration-500`}
              animate={step === 3 ? { scale: [1, 1.1, 1], transition: { delay: 0.3 } } : {}}
            >
              <FaSlack />
            </motion.div>
            <div className="text-[10px] leading-tight">
              <span className={step >= 3 ? "text-zinc-200 font-medium" : "text-zinc-500"}>Slack Alert</span>
              <br/>
              <span className={step >= 3 ? "text-emerald-400/90 font-mono" : "text-zinc-650"}>Sent ✓</span>
            </div>
          </div>

        </div>

      </div>

      {/* Manual timeline controls */}
      <div className="flex items-center justify-center gap-3 border-t border-white/5 pt-4 z-10">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <button
              onClick={() => setStep(i)}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 flex items-center justify-center text-[7px] ${
                step === i
                  ? "bg-white/15 border-white/40 text-white font-bold"
                  : step > i
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-600"
              }`}
            >
              {step > i ? "✓" : i + 1}
            </button>
            {i < 4 && (
              <div
                className={`w-6 h-0.5 rounded ${
                  step > i ? "bg-white/20" : "bg-zinc-800"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
