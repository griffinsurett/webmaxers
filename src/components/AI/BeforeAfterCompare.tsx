// src/components/AI/BeforeAfterCompare.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCircleXmark, FaCircleCheck, FaClock, FaBolt, FaArrowRight } from "react-icons/fa6";

interface OperationCard {
  id: string;
  title: string;
  subtitle: string;
  before: {
    problem: string;
    metrics: string;
    flow: string[];
  };
  after: {
    solution: string;
    metrics: string;
    flow: string[];
  };
}

const operations: OperationCard[] = [
  {
    id: "leads",
    title: "Winning New Customers",
    subtitle: "Instant booking, day or night",
    before: {
      problem: "When potential clients message you after hours, they expect a reply. If you are busy or asleep, they just call the next business and you lose the job.",
      metrics: "60% of leads lost to competitors",
      flow: [
        "Customer requests a quote at night",
        "Message sits in your inbox unread",
        "You call them back the next morning",
        "They already hired someone else"
      ]
    },
    after: {
      solution: "Your website responds to new inquiries automatically in less than a minute, answers basic questions, and books them straight onto your calendar.",
      metrics: "Every lead answered in 45 seconds",
      flow: [
        "Customer requests a quote at night",
        "System replies within 1 minute",
        "Customer picks an open time slot",
        "Job is instantly locked on your calendar"
      ]
    }
  },
  {
    id: "billing",
    title: "Invoicing & Getting Paid",
    subtitle: "No more Sunday night paperwork",
    before: {
      problem: "Writing job details on paper notes, then spending your weekends typing them into invoicing software and chasing unpaid bills manually.",
      metrics: "5+ hours of paperwork every weekend",
      flow: [
        "You finish a service job",
        "Write the details on a notepad",
        "Spend Sunday typing up invoices",
        "Wait weeks to get paid"
      ]
    },
    after: {
      solution: "As soon as you mark a job as completed on your phone, an invoice is automatically created and sent. Payments are collected online without you lifting a finger.",
      metrics: "Get paid 5x faster, zero admin work",
      flow: [
        "You finish a service job",
        "Mark it as 'Done' on your phone",
        "Invoice is automatically created & sent",
        "Client pays immediately online"
      ]
    }
  },
  {
    id: "reviews",
    title: "Google Ranking & Reputation",
    subtitle: "Collect 5-star reviews on autopilot",
    before: {
      problem: "Happy customers intend to leave a review but forget. Your business stays invisible on Google, while low-quality competitors get all the clicks.",
      metrics: "Fewer than 1 review per month",
      flow: [
        "Service completed successfully",
        "You forget to ask for a review",
        "Your Google page remains empty",
        "Competitors get all the phone calls"
      ]
    },
    after: {
      solution: "A friendly text message automatically goes out after a job asking for feedback. Happy customers are guided straight to your Google page to leave a review.",
      metrics: "3x increase in Google reviews",
      flow: [
        "Service completed successfully",
        "Auto-text sent requesting feedback",
        "Customer clicks link to leave review",
        "Your business rises to the top of Google"
      ]
    }
  }
];

export default function BeforeAfterCompare() {
  const [isAiMode, setIsAiMode] = useState(true);

  return (
    <div className="relative w-full max-w-5xl mx-auto py-8">
      {/* Toggler Controls */}
      <div className="flex flex-col items-center gap-4 mb-10 text-center">
        <h3 className="text-xl md:text-2xl font-semibold text-zinc-100">
          How AI Transforms Your Daily Operations
        </h3>
        <p className="text-sm text-zinc-400 max-w-lg">
          Toggle below to compare the traditional manual processes with automated, outcome-driven operations.
        </p>

        {/* Global Sliding Switch */}
        <div className="relative flex items-center bg-zinc-900 border border-white/5 rounded-full p-1 w-full max-w-md h-12 shadow-inner">
          {/* Animated Background Selector */}
          <motion.div
            className={`absolute top-1 bottom-1 rounded-full ${
              isAiMode ? "bg-[#5e76f6]" : "bg-zinc-800"
            }`}
            layoutId="activeTab"
            style={{ width: "calc(50% - 4px)" }}
            animate={{ x: isAiMode ? "100%" : "0%" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />

          <button
            onClick={() => setIsAiMode(false)}
            className={`flex-1 flex items-center justify-center gap-2 text-xs md:text-sm font-semibold z-10 h-full transition-colors duration-300 focus:outline-none ${
              !isAiMode ? "text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FaClock className="text-xs" />
            The Old Way (Manual)
          </button>

          <button
            onClick={() => setIsAiMode(true)}
            className={`flex-1 flex items-center justify-center gap-2 text-xs md:text-sm font-semibold z-10 h-full transition-colors duration-300 focus:outline-none ${
              isAiMode ? "text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FaBolt className="text-xs" />
            The AI Way (Automated)
          </button>
        </div>
      </div>

      {/* Grid of Operation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {operations.map((op) => (
          <div
            key={op.id}
            className={`relative rounded-2xl border bg-zinc-950/40 backdrop-blur-md p-6 flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-500 ${
              isAiMode 
                ? "border-emerald-500/10 hover:border-emerald-500/25 shadow-emerald-950/5"
                : "border-rose-500/10 hover:border-rose-500/25 shadow-rose-950/5"
            }`}
          >
            {/* Top Info */}
            <div className="z-10">
              <span className={`text-[10px] uppercase font-semibold tracking-widest ${
                isAiMode ? "text-[#5e76f6]" : "text-zinc-500"
              }`}>
                {op.title}
              </span>
              <h4 className="text-base font-semibold text-zinc-100 mt-1 mb-2 leading-tight">
                {op.subtitle}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed min-h-[55px]">
                {isAiMode ? op.after.solution : op.before.problem}
              </p>
            </div>

            {/* Visual Process Timeline */}
            <div className="my-6 relative border-l border-zinc-800/80 pl-4 py-1 flex flex-col gap-4 z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isAiMode ? "after" : "before"}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-3"
                >
                  {(isAiMode ? op.after.flow : op.before.flow).map((stepText, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded-full text-[9px] ${
                        isAiMode ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={`text-xs ${isAiMode ? "text-zinc-300 font-medium" : "text-zinc-400"}`}>
                        {stepText}
                      </span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Outcome Banner */}
            <div className="z-10 pt-4 border-t border-white/5 mt-auto">
              <div className={`w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all duration-500 ${
                isAiMode
                  ? "bg-zinc-900 border-emerald-500/20 text-emerald-400"
                  : "bg-zinc-900 border-rose-500/20 text-rose-400"
              }`}>
                <span className="shrink-0 text-base">
                  {isAiMode ? (
                    <FaCircleCheck className="text-emerald-400" />
                  ) : (
                    <FaCircleXmark className="text-rose-400" />
                  )}
                </span>
                <div className="flex-1 flex flex-col min-w-0">
                  <span className={`text-[9px] uppercase tracking-widest font-bold opacity-60`}>
                    {isAiMode ? "Automated Outcome" : "Manual System Cost"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-100 leading-snug mt-0.5">
                    {isAiMode ? op.after.metrics : op.before.metrics}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
