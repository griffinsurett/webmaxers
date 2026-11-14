// src/components/LoopTemplates/TechStackSection.tsx
import { useMemo, useState } from "react";
import Heading from "@/components/Heading";
import SmoothScrollCarousel from "@/components/Carousels/SmoothScrollCarousel";
import TechStackLabel from "@/components/LoopComponents/TechStackLabel";
import Icon from "@/components/Icon";

// Minimum number of items required to use the carousel.
// Below this count, items are rendered as a static grid.
const CAROUSEL_THRESHOLD = 6;

interface TechStackItem {
  title?: string;
  icon?: string;
}

interface TechStackSectionProps {
  technologies?: TechStackItem[];
  className?: string;
}

export default function TechStackSection({
  technologies = [],
  className = "",
}: TechStackSectionProps) {
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);

  const techList = useMemo(
    () =>
      technologies
        .filter((tech) => tech?.title)
        .map((tech) => ({
          name: tech.title ?? "",
          icon: tech.icon ?? "lucide:code",
        })),
    [technologies],
  );

  const useCarousel = techList.length >= CAROUSEL_THRESHOLD;

  const techItems = techList.map((tech, index) => (
    <TechStackLabel
      key={`${tech.name}-${index}`}
      name={tech.name}
      index={index}
      onTechHover={setHoveredTech}
      onTechLeave={() => setHoveredTech(null)}
    >
      <Icon icon={tech.icon} size="xl" aria-label={tech.name} />
    </TechStackLabel>
  ));

  return (
    <div className={`inner-section text-center lg:text-left ${className}`.trim()}>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_3fr] gap-6 lg:gap-8 items-center">
        <div className="w-md">
          <div className="relative inline-block mb-6 leading-tight">
            <Heading
              tagName="h2"
              before="We've mastered "
              text="the tools that matter."
              className={`transition-opacity duration-150 ${
                hoveredTech ? "opacity-0" : "opacity-100"
              }`}
              beforeClass="text-heading block lg:inline"
              textClass="text-heading block lg:inline"
            />

            <Heading
              tagName="h2"
              before="We've mastered "
              text={hoveredTech ?? ""}
              className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                hoveredTech ? "opacity-100" : "opacity-0"
              }`}
              beforeClass="text-heading block lg:inline"
              textClass="text-accent block lg:inline"
            />
          </div>
        </div>

        {useCarousel ? (
          <SmoothScrollCarousel
            startDelay={1500}
            speed={30}
            gap={32}
            itemWidth={120}
            autoplay
            pauseOnHover
            pauseOnEngage
            gradientMask
            gradientWidth={{ base: 48, md: 72 }}
            drag
            className="relative w-full h-[84px] md:h-[96px]"
          >
            {techItems}
          </SmoothScrollCarousel>
        ) : (
          <div
            className="flex flex-wrap justify-center lg:justify-start items-center h-[84px] md:h-[96px]"
            style={{ gap: "32px" }}
          >
            {techItems}
          </div>
        )}
      </div>
    </div>
  );
}
