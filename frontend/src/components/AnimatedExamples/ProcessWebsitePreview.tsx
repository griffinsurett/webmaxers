import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface ProcessWebsitePreviewProps {
  className?: string;
  mode?: "wireframe" | "final";
}

export default function ProcessWebsitePreview({
  className = "",
  mode = "final",
}: ProcessWebsitePreviewProps) {
  const isFinal = mode === "final";

  return (
    <DecorativeWrapper
      className={[
        "relative h-full w-full overflow-hidden rounded-[1rem] border select-none pointer-events-none",
        isFinal
          ? "border-white/14 bg-[#13192B]"
          : "border-white/10 bg-[#13192B]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0 h-6 border-b border-white/10",
          isFinal
            ? "bg-[linear-gradient(90deg,rgba(99,122,255,0.2),rgba(99,122,255,0.04))]"
            : "bg-white/[0.04]",
        ].join(" ")}
      />
      <div className="absolute left-3 top-2 flex gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white/18" />
        <span className="h-2 w-2 rounded-full bg-white/12" />
        <span className="h-2 w-2 rounded-full bg-white/12" />
      </div>

      <div
        className={[
          "absolute left-4 top-[1.85rem] h-2 rounded-full",
          isFinal ? "w-11 bg-primary/85" : "w-9 bg-white/16",
        ].join(" ")}
      />

      <div className="absolute right-4 top-[2.15rem] flex flex-col gap-1">
        <span className={isFinal ? "h-[1.5px] w-4 rounded-full bg-white/70" : "h-[1.5px] w-4 rounded-full bg-white/12"} />
        <span className={isFinal ? "h-[1.5px] w-4 rounded-full bg-white/55" : "h-[1.5px] w-4 rounded-full bg-white/10"} />
        <span className={isFinal ? "h-[1.5px] w-4 rounded-full bg-white/40" : "h-[1.5px] w-4 rounded-full bg-white/8"} />
      </div>

      <div className="absolute inset-x-4 top-[3.35rem] flex flex-col items-center text-center">
        {isFinal ? (
          <>
            <div className="max-w-[10.5rem] text-[11px] font-semibold leading-[1.15] text-white">
              Websites that look clear and feel credible
            </div>
            <div className="mt-2.5 max-w-[10rem] text-[7px] leading-[1.35] text-white/62">
              Built to help people understand what you do and take the next step.
            </div>
          </>
        ) : (
          <>
            <div className="h-3 w-[8.8rem] rounded-full bg-white/18" />
            <div className="mt-2.5 h-1.5 w-[8.1rem] rounded-full bg-white/12" />
            <div className="mt-1.5 h-1.5 w-[6.9rem] rounded-full bg-white/10" />
          </>
        )}
      </div>

      {isFinal ? (
        <>
          <div className="absolute left-1/2 top-[7.15rem] -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[8px] font-semibold text-white shadow-[0_10px_24px_rgba(99,122,255,0.3)]">
            Book a Call
          </div>
          <div className="absolute left-1/2 top-[8.65rem] flex -translate-x-1/2 items-center gap-1.5 text-[6px] font-medium text-white/62">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/85" />
            <span>Trusted by local businesses</span>
          </div>
          <div className="absolute inset-0 ring-1 ring-primary/30" />
        </>
      ) : (
        <>
          <div className="absolute left-1/2 top-[7.1rem] h-6 w-[4.8rem] -translate-x-1/2 rounded-full bg-white/12" />
          <div className="absolute left-1/2 top-[8.45rem] h-1.5 w-[6.5rem] -translate-x-1/2 rounded-full bg-white/8" />
        </>
      )}
    </DecorativeWrapper>
  );
}
