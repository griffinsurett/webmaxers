import { useEffect, useRef, useState, forwardRef } from "react";
import ClientImage from "@/components/ClientImage";
import type { ReactNode, VideoHTMLAttributes } from "react";

interface HoverPlayVideoClientProps extends VideoHTMLAttributes<HTMLVideoElement> {
  lazy?: boolean;
  sourceType?: string;
  children?: ReactNode;
  clientLoadPlaceholder?: boolean;
  placeholderSrc?: string;
  clientPosterSrc?: string;
  clientPlaceholderSrc?: string;
  wrapperClass?: string;
}

const HoverPlayVideoClient = forwardRef<HTMLVideoElement, HoverPlayVideoClientProps>(
  (
    {
      src,
      poster,
      className = "",
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
    const [resolvedPoster, setResolvedPoster] = useState<string | undefined>(poster);
    const [resolvedPlaceholderSrc, setResolvedPlaceholderSrc] = useState<string | undefined>(
      placeholderSrc,
    );

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
          if (video.preload === "none") {
            video.preload = "metadata";
          }
          video.load();
        }
      };

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            ensureVideoSources();
            observer.disconnect();
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px 200px 0px" },
      );

      observer.observe(video);
      return () => observer.disconnect();
    }, [lazy]);

    useEffect(() => {
      const video = internalRef.current;
      if (!video) return;

      const shell = video.closest<HTMLElement>("[data-hover-play-video-shell]");
      if (!shell) return;

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
          if (video.preload === "none") {
            video.preload = "metadata";
          }
          video.load();
        }

        return attached;
      };

      const markShellLoaded = () => {
        if (shell.dataset.videoLoaded === "true") return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            shell.dataset.videoLoaded = "true";
          });
        });
      };

      const attemptPlay = () => {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined);
        }
      };

      const playOnHover = () => {
        const attached = ensureVideoSources();
        if (!attached || video.readyState >= 2) {
          attemptPlay();
          return;
        }

        const playWhenReady = () => {
          video.removeEventListener("loadeddata", playWhenReady);
          video.removeEventListener("canplay", playWhenReady);
          attemptPlay();
        };

        video.addEventListener("loadeddata", playWhenReady, { once: true });
        video.addEventListener("canplay", playWhenReady, { once: true });
      };

      const resetToPoster = () => {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {}
        delete shell.dataset.videoLoaded;
      };

      video.addEventListener("playing", markShellLoaded);
      shell.addEventListener("pointerenter", playOnHover);
      shell.addEventListener("pointerleave", resetToPoster);
      shell.addEventListener("focusin", playOnHover);
      shell.addEventListener("focusout", resetToPoster);

      return () => {
        video.removeEventListener("playing", markShellLoaded);
        shell.removeEventListener("pointerenter", playOnHover);
        shell.removeEventListener("pointerleave", resetToPoster);
        shell.removeEventListener("focusin", playOnHover);
        shell.removeEventListener("focusout", resetToPoster);
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
          autoPlay={false}
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

HoverPlayVideoClient.displayName = "HoverPlayVideoClient";

export default HoverPlayVideoClient;
