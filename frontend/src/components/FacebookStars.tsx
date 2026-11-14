import Icon from "@/components/Icon";

export interface FacebookStarsProps {
  href?: string;
  className?: string;
  starCount?: number;
}

export default function FacebookStars({
  href = "#",
  className = "",
  starCount = 5,
}: FacebookStarsProps) {
  const stars = Array.from({ length: starCount });

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <span className="sr-only">{starCount} stars</span>
      <div
        className="flex gap-1 text-[1.2rem] leading-none text-[#ffc538] lg:text-[1.35rem]"
        aria-hidden="true"
      >
        {stars.map((_, index) => (
          <span aria-hidden="true" key={index}>
            ★
          </span>
        ))}
      </div>

      <a
        href={href}
        aria-label="View Facebook reviews"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1877f2] text-white transition-transform duration-200 hover:-translate-y-0.5"
      >
        <Icon icon="si:facebook" size="sm" className="text-current" />
      </a>
    </div>
  );
}
