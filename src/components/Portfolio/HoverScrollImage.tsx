import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
} from "react";

interface SourceDef {
  type?: string;
  srcSet: string;
  sizes?: string;
}

interface HoverScrollImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "className"> {
  className?: string;
  sources?: SourceDef[];
}

const SCROLL_SPEED_PX_PER_SEC = 120;
const HOVER_SCROLL_DELAY_MS = 1000;
const MIN_SCROLL_DURATION_MS = 1800;

export default function HoverScrollImage({
  src,
  srcSet,
  sizes,
  alt = "",
  width,
  height,
  loading = "lazy",
  decoding = "async",
  fetchPriority = "auto",
  draggable = false,
  className = "",
  sources = [],
  ...rest
}: HoverScrollImageProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [maxOffset, setMaxOffset] = useState(0);
  const [hasLoadedImage, setHasLoadedImage] = useState(false);
  const [hasPlaceholder, setHasPlaceholder] = useState<boolean | null>(null);

  useEffect(() => {
    setHasLoadedImage(false);
  }, [src, srcSet]);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const image = imageRef.current;

      if (!viewport || !image) return;

      const viewportHeight = viewport.clientHeight;
      const renderedHeight = image.getBoundingClientRect().height;
      const fallbackHeight =
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? (viewport.clientWidth * image.naturalHeight) / image.naturalWidth
          : 0;
      const imageHeight = Math.max(renderedHeight, fallbackHeight, image.scrollHeight);
      const nextOffset = Math.max(0, Math.ceil(imageHeight - viewportHeight));
      setMaxOffset(nextOffset);
    };

    measure();

    const image = imageRef.current;
    const handleLoad = () => {
      measure();
      setHasLoadedImage(true);
    };

    if (image?.complete && image.naturalWidth > 0) {
      handleLoad();
    }

    image?.addEventListener("load", handleLoad);

    const viewportObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const imageObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;

    if (viewportRef.current) viewportObserver?.observe(viewportRef.current);
    if (imageRef.current) imageObserver?.observe(imageRef.current);

    return () => {
      image?.removeEventListener("load", handleLoad);
      viewportObserver?.disconnect();
      imageObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const tile = viewport.closest("[data-hover-scroll-tile]");
    if (!(tile instanceof HTMLElement)) return;

    const placeholder = tile.querySelector("[data-hover-scroll-placeholder]");
    const hasPlaceholderNode = placeholder instanceof HTMLElement;
    setHasPlaceholder(hasPlaceholderNode);

    if (!hasLoadedImage || !hasPlaceholderNode) return;

    placeholder.style.opacity = "0";
    placeholder.style.visibility = "hidden";
    placeholder.style.pointerEvents = "none";
  }, [hasLoadedImage]);

  const durationMs = useMemo(() => {
    if (maxOffset <= 0) return MIN_SCROLL_DURATION_MS;

    const rawDuration = Math.round((maxOffset / SCROLL_SPEED_PX_PER_SEC) * 1000);
    return Math.max(MIN_SCROLL_DURATION_MS, rawDuration);
  }, [maxOffset]);

  const imageStyle = {
    transform: hovered && maxOffset > 0 ? `translateY(-${maxOffset}px)` : "translateY(0px)",
    transitionDelay: hovered && maxOffset > 0 ? `${HOVER_SCROLL_DELAY_MS}ms` : "0ms",
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: "linear",
    willChange: maxOffset > 0 ? "transform" : undefined,
  } as const;

  const imageElement = (
    <img
      ref={imageRef}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      draggable={draggable}
      className={`block h-auto w-full max-w-none select-none align-top ${className}`.trim()}
      style={imageStyle}
      {...rest}
    />
  );

  return (
    <div
      ref={viewportRef}
      className="h-full w-full overflow-hidden transition-opacity duration-300"
      style={{ opacity: hasLoadedImage || hasPlaceholder === false ? 1 : 0 }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {sources.length > 0 ? (
        <picture className="block h-auto w-full">
          {sources.map((source, index) => (
            <source
              key={`${source.type ?? "source"}-${index}`}
              type={source.type}
              srcSet={source.srcSet}
              sizes={source.sizes ?? sizes}
            />
          ))}
          {imageElement}
        </picture>
      ) : (
        imageElement
      )}
    </div>
  );
}
