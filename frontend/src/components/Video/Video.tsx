// src/components/Video/Video.tsx
/**
 * Video Component (React)
 *
 * Client-side video player with lazy loading support.
 */
import { useRef, useEffect, forwardRef, useState } from "react";
import ClientImage from "@/components/ClientImage";
import type {
  VideoHTMLAttributes,
  ReactNode,
} from "react";

interface VideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  lazy?: boolean;
  sourceType?: string;
  children?: ReactNode;
  clientLoadPlaceholder?: boolean;
  placeholderSrc?: string;
  clientPosterSrc?: string;
  clientPlaceholderSrc?: string;
  wrapperClass?: string;
}

export const Video = forwardRef<HTMLVideoElement, VideoProps>(
  (
    {
      src,
      poster,
      className = "",
      autoPlay = true,
      muted = true,
      loop = true,
      controls = false,
      playsInline = true,
      lazy = true,
      sourceType,
      children,
      clientLoadPlaceholder = false,
      placeholderSrc,
      clientPosterSrc,
      clientPlaceholderSrc,
      wrapperClass = "",
      preload,
      ...rest
    },
    ref,
  ) => {
    const internalRef = useRef<HTMLVideoElement | null>(null);
    const [resolvedPoster, setResolvedPoster] = useState<string | undefined>(
      poster,
    );
    const [resolvedPlaceholderSrc, setResolvedPlaceholderSrc] = useState<
      string | undefined
    >(placeholderSrc);

    const assignRef = (node: HTMLVideoElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    useEffect(() => {
      const video = internalRef.current;
      if (!video || !lazy) return;

      const ensureVideoSources = () => {
        let attached = false;

        const dataSrc = video.dataset.videoSrc;
        if (dataSrc && video.src !== dataSrc) {
          video.src = dataSrc;
          attached = true;
        }

        const sourceNodes = video.querySelectorAll("source[data-video-src]");
        sourceNodes.forEach((node) => {
          const nodeSrc = node.getAttribute("data-video-src");
          if (nodeSrc && node.getAttribute("src") !== nodeSrc) {
            node.setAttribute("src", nodeSrc);
            attached = true;
          }
        });

        if (attached) {
          video.load();
        }
      };

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              ensureVideoSources();
              if (autoPlay) {
                video.play().catch(() => {});
              }
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35, rootMargin: "0px 0px 160px 0px" },
      );

      observer.observe(video);
      return () => observer.disconnect();
    }, [lazy, autoPlay]);

    useEffect(() => {
      const video = internalRef.current;
      if (!video) return;
      const shell = video.closest<HTMLElement>("[data-video-shell]");

      const markShellLoaded = () => {
        if (!shell || shell.dataset.videoLoaded === "true") return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            shell.dataset.videoLoaded = "true";
          });
        });
      };

      if (video.readyState >= 2) {
        markShellLoaded();
      }

      video.addEventListener("playing", markShellLoaded);
      video.addEventListener("loadeddata", markShellLoaded);
      video.addEventListener("canplay", markShellLoaded);

      return () => {
        video.removeEventListener("playing", markShellLoaded);
        video.removeEventListener("loadeddata", markShellLoaded);
        video.removeEventListener("canplay", markShellLoaded);
      };
    }, []);

    useEffect(() => {
      if (clientLoadPlaceholder && clientPosterSrc) {
        setResolvedPoster(clientPosterSrc);
        return;
      }
      setResolvedPoster(poster);
    }, [clientLoadPlaceholder, clientPosterSrc, poster]);

    useEffect(() => {
      if (clientLoadPlaceholder && clientPlaceholderSrc) {
        setResolvedPlaceholderSrc(clientPlaceholderSrc);
        return;
      }
      setResolvedPlaceholderSrc(placeholderSrc);
    }, [clientLoadPlaceholder, clientPlaceholderSrc, placeholderSrc]);

    const wrapperClasses = `relative grid w-full h-full ${wrapperClass ?? ""}`.trim();
    const mediaClasses = `w-full h-full object-cover ${className ?? ""}`.trim();
    const stackClasses = "col-start-1 col-end-2 row-start-1 row-end-2";

    return (
      <div className={wrapperClasses}>
        {resolvedPlaceholderSrc && (
          <ClientImage
            src={resolvedPlaceholderSrc}
            alt=""
            className={`${mediaClasses} ${stackClasses}`.trim()}
            loading="eager"
            decoding="async"
            style={{ zIndex: 0 }}
          />
        )}
        <video
          ref={assignRef}
          className={`${mediaClasses} ${stackClasses}`.trim()}
          poster={resolvedPoster}
          autoPlay={!lazy && autoPlay}
          muted={muted}
          loop={loop}
          controls={controls}
          playsInline={playsInline}
          preload={preload ?? (lazy ? "metadata" : "auto")}
          data-video-src={lazy ? src : undefined}
          src={!lazy ? src : undefined}
          style={{ zIndex: 1 }}
          {...rest}
        >
          {src && (
            <source
              src={!lazy ? src : undefined}
              data-video-src={lazy ? src : undefined}
              type={sourceType}
            />
          )}
          {children ?? "Your browser does not support the video tag."}
        </video>
      </div>
    );
  },
);

Video.displayName = "Video";

export default Video;
