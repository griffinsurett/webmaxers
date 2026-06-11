// src/components/ClientImage.tsx
/**
 * Client-Side Image Loader
 *
 * Prevents SSR rendering of below-fold images to reduce initial HTML size.
 * Images are only rendered after React hydration on the client.
 */

import { useState, useEffect } from "react";

interface ClientImageProps {
  src?: string;
  srcSet?: string;
  sizes?: string;
  alt?: string;
  width?: number;
  height?: number;
  sources?: { type?: string; srcSet: string; sizes?: string }[];
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  style?: React.CSSProperties;
}

export default function ClientImage({
  src,
  srcSet,
  sizes,
  alt = "",
  width,
  height,
  sources = [],
  className = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority = "auto",
  draggable = false,
  style,
}: ClientImageProps) {
  // Prevent rendering during SSR
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Return placeholder during SSR to maintain layout
    return (
      <div
        className={className}
        style={{
          ...style,
          backgroundColor: "transparent",
        }}
      />
    );
  }

  // Render image after hydration
  if (sources.length > 0) {
    return (
      <picture>
        {sources.map((source, idx) => (
          <source
            key={idx}
            srcSet={source.srcSet}
            sizes={source.sizes ?? sizes}
            type={source.type}
          />
        ))}
        <img
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
          className={className}
          style={style}
        />
      </picture>
    );
  }

  return (
    <img
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
      className={className}
      style={style}
    />
  );
}
