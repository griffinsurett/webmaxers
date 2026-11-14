import { useEffect, useState } from "react";
import AddToCartDemo from "@/components/AnimatedExamples/AddToCartDemo";
import Icon from "@/components/Icon";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface PlatformCmsDevelopmentDemoProps {
  className?: string;
}

const tabs = [
  {
    id: "shopify",
    label: "Shopify",
    icon: "fa6:shopify" as const,
    accentClass: "text-[#95BF47]",
  },
  {
    id: "wordpress",
    label: "WordPress",
    icon: "fa6:wordpress" as const,
    accentClass: "text-[#21759B]",
  },
] as const;

export default function PlatformCmsDevelopmentDemo({
  className = "",
}: PlatformCmsDevelopmentDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("shopify");

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveTab("shopify");
      return;
    }

    const interval = setInterval(() => {
      setActiveTab((current) => (current === "shopify" ? "wordpress" : "shopify"));
    }, 3200);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const activeTabData = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <DecorativeWrapper
      className={["h-full w-full select-none", className].filter(Boolean).join(" ")}
    >
      <div className="flex h-full min-h-[22rem] flex-col sm:min-h-[24rem] lg:min-h-[28rem]">
        <div className="flex items-end gap-2 border-b border-soft px-4 pt-4 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "pointer-events-auto inline-flex items-center gap-2 rounded-t-2xl border border-b-0 px-3 py-2 text-sm transition-all duration-300 sm:px-4",
                  isActive
                    ? "border-soft bg-[#121722] text-heading"
                    : "border-transparent bg-transparent text-muted hover:text-text",
                ].join(" ")}
                aria-pressed={isActive}
              >
                <Icon icon={tab.icon} size="sm" className={tab.accentClass} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-5 sm:p-5 lg:p-6">
          <div className="flex items-center gap-2 text-lg text-heading sm:text-xl">
            <Icon
              icon={activeTabData.icon}
              size="md"
              className={activeTabData.accentClass}
              aria-hidden
            />
            <span>{activeTabData.label}</span>
          </div>

          <div className="flex flex-1 overflow-hidden rounded-[1.35rem] border border-soft bg-[#121722]">
            {activeTab === "shopify" ? (
              <AddToCartDemo className="h-full w-full rounded-[1.35rem] bg-transparent" />
            ) : (
              <div className="flex h-full w-full flex-col bg-[#f0f0f1] text-[#1d2327]">
                <div className="flex h-8 items-center justify-between bg-[#1d2327] px-3 text-[10px] text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="text-[#72aee6]">W</span>
                    <span>Test Site</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/65">
                    <span>+ New</span>
                    <span>Comments</span>
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  <div className="flex w-28 shrink-0 flex-col bg-[#1d2327] py-2 text-[10px] text-white/70">
                    {["Dashboard", "Posts", "Media", "Pages", "Comments", "Plugins", "Settings"].map(
                      (item, index) => (
                        <div
                          key={item}
                          className={[
                            "flex items-center px-3 py-2",
                            index === 0 ? "bg-[#2271b1] text-white" : "",
                          ].join(" ")}
                        >
                          {item}
                        </div>
                      ),
                    )}
                  </div>

                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="border-b border-[#dcdcde] bg-white px-4 py-3">
                      <div className="text-xl text-[#1d2327]">Dashboard</div>
                    </div>

                    <div className="grid flex-1 gap-3 overflow-hidden p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <div className="grid gap-3">
                        <div className="rounded-sm border border-[#dcdcde] bg-white p-3">
                          <div className="text-[11px] font-semibold text-[#1d2327]">At a Glance</div>
                          <div className="mt-3 grid gap-2 text-[10px] text-[#50575e]">
                            <div>1 Post</div>
                            <div>2 Pages</div>
                            <div>1 Comment</div>
                          </div>
                        </div>
                        <div className="rounded-sm border border-[#dcdcde] bg-white p-3">
                          <div className="text-[11px] font-semibold text-[#1d2327]">Activity</div>
                          <div className="mt-3 grid gap-2 text-[10px] text-[#50575e]">
                            <div className="border-b border-[#f0f0f1] pb-2">Recently Published</div>
                            <div>Hello world!</div>
                            <div className="border-t border-[#f0f0f1] pt-2">Recent Comments</div>
                            <div>From a WordPress Commenter</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-sm border border-[#dcdcde] bg-white p-3">
                          <div className="text-[11px] font-semibold text-[#1d2327]">Quick Draft</div>
                          <div className="mt-3 grid gap-2">
                            <div className="h-7 rounded-[2px] border border-[#dcdcde] bg-[#f6f7f7]" />
                            <div className="h-16 rounded-[2px] border border-[#dcdcde] bg-[#f6f7f7]" />
                            <div className="h-7 w-20 rounded-[2px] bg-[#2271b1]" />
                          </div>
                        </div>
                        <div className="rounded-sm border border-[#dcdcde] bg-white p-3">
                          <div className="text-[11px] font-semibold text-[#1d2327]">
                            WordPress Events and News
                          </div>
                          <div className="mt-3 grid gap-2 text-[10px] text-[#50575e]">
                            <div className="h-2 w-full rounded-full bg-[#f0f0f1]" />
                            <div className="h-2 w-[88%] rounded-full bg-[#f0f0f1]" />
                            <div className="h-2 w-[76%] rounded-full bg-[#f0f0f1]" />
                            <div className="h-2 w-[92%] rounded-full bg-[#f0f0f1]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
