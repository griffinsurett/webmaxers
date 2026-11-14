// src/components/LoopComponents/TestimonialCard.tsx
import AnimatedBorder from "@/components/AnimatedBorder/AnimatedBorder";
import IconListItem from "@/components/LoopComponents/IconListItem";

// Use string path instead of import to avoid bundling 8KB image metadata into JS chunk
const PLACEHOLDER_PATH = "/assets/placeholder.jpg";

export interface TestimonialItemData {
  title?: string;
  description?: string;
  author?: string;
  role?: string;
  company?: string;
  rating?: number;
  featuredImage?: any;
  url?: string;
  href?: string;
  slug?: string;
  hasPage?: boolean;
}

interface TestimonialCardProps {
  item: TestimonialItemData;
  className?: string;
  ringDuration?: number;
}

export default function TestimonialCard({
  item,
  className = "",
  ringDuration = 800,
}: TestimonialCardProps) {
  const quote = item.description ?? "";
  const author = item.author ?? item.title ?? "Happy Client";
  const roleParts = [item.role, item.company].filter(Boolean).join(", ");
  const rating = Math.max(1, Math.min(5, item.rating ?? 5));

  const avatarSrc = PLACEHOLDER_PATH;

  // Determine if this testimonial is interactive (has a page/link)
  const cardUrl = item.url;
  const isInteractive = Boolean(item.hasPage && cardUrl);

  const wrapperClassName = [
    isInteractive ? "group" : "",
    "text-left",
    "outer-card-transition",
    isInteractive ? "outer-card-hover-transition" : "",
    "!duration-[900ms]",
    "ease-out",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <AnimatedBorder
        variant={isInteractive ? "progress-b-f" : "none"}
        triggers={isInteractive ? "hover" : []}
        duration={ringDuration}
        borderRadius="rounded-3xl"
        borderWidth={2}
        className={wrapperClassName}
        innerClassName="h-100 md:h-90 lg:h-80 mx-auto px-10 flex flex-col justify-center items-start relative card-bg"
        linkProps={isInteractive ? { href: cardUrl } : undefined}
      >
        <div className="inner-card-style inner-card-transition inner-card-color" />

        <IconListItem
          data={{ icon: "❝", description: quote ? `“${quote}”` : undefined }}
          layout="vertical"
          alignment="left"
          iconClassName="card-icon-color icon-medium mb-5 z-10 relative"
          descriptionClassName="text-text text-lg leading-relaxed mb-8 italic relative z-10"
          descriptionTag="p"
          showTitle={false}
        />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10 w-full">
          <IconListItem
            data={{
              image: avatarSrc ? { src: avatarSrc, alt: author } : undefined,
              title: author,
              description: roleParts || undefined,
            }}
            layout="horizontal"
            alignment="left"
            className="gap-2"
            imageClassName="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary light:to-bg2 dark:to-primary/25"
            titleClassName="h4"
            titleTag="h4"
            descriptionClassName="text-text text-sm"
            descriptionTag="p"
            showIcon={false}
            showImage
            showTitle
            showDescription={Boolean(roleParts)}
          />

          <div className="flex gap-1 text-center justify-center items-center">
            {Array.from({ length: rating }).map((_, i) => (
              <svg
                key={`star-${i}`}
                className="w-5 h-5 text-accent fill-current"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
      </AnimatedBorder>
    </div>
  );
}
