// src/components/TestimonialsMarquee/TestimonialsMarquee.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";

export interface TestimonialItem {
  id: string;
  author: string;
  role: string;
  company?: string;
  quote: string;
  imageSrc?: string;
  imageAlt?: string;
}

interface Props {
  items: TestimonialItem[];
}

function TestimonialCard({ author, role, company, quote, imageSrc, imageAlt }: TestimonialItem) {
  const initials = author
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="w-52 border-white/8 bg-white/4 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={imageSrc} alt={imageAlt ?? author} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex flex-col">
            <span className="text-xs font-semibold text-white truncate leading-tight">
              {author}
            </span>
            <span className="small-text text-white/50 truncate">
              {company ?? role}
            </span>
          </div>
        </div>
        <blockquote className="mt-3 text-xs leading-relaxed text-white/70 line-clamp-4">
          "{quote}"
        </blockquote>
      </CardContent>
    </Card>
  );
}

export default function TestimonialsMarquee({ items }: Props) {
  if (!items.length) return null;

  return (
    <div
      className="relative flex h-[540px] w-full flex-row items-center justify-center overflow-hidden"
      style={{ perspective: "800px" }}
    >
      <div
        className="flex flex-row items-center gap-3"
        style={{
          transform:
            "translateX(-80px) translateZ(-60px) rotateX(15deg) rotateY(-6deg) rotateZ(16deg)",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <Marquee vertical pauseOnHover repeat={5} className="[--duration:35s]">
          {items.map((t) => <TestimonialCard key={`a-${t.id}`} {...t} />)}
        </Marquee>

        <Marquee vertical pauseOnHover reverse repeat={5} className="[--duration:30s]">
          {items.map((t) => <TestimonialCard key={`b-${t.id}`} {...t} />)}
        </Marquee>

        <Marquee vertical pauseOnHover repeat={5} className="[--duration:38s]">
          {items.map((t) => <TestimonialCard key={`c-${t.id}`} {...t} />)}
        </Marquee>

        <Marquee vertical pauseOnHover reverse repeat={5} className="[--duration:32s]">
          {items.map((t) => <TestimonialCard key={`d-${t.id}`} {...t} />)}
        </Marquee>
      </div>

      {/* Gradient fade edges — outside the 3D wrapper so they stay flat */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-[#080808]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#080808]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-[#080808]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-[#080808]" />
    </div>
  );
}
