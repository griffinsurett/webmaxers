import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealTextProps {
  text: string;
  className?: string;
  splitType?: "character" | "word" | "line";
  staggerDelay?: number; // milliseconds between each character/word reveal
  scrollBuffer?: number; // pixels before/after viewport to start/end animation
}

type CharacterData = {
  char: string;
  index: number;
  opacity: number;
};

type WordData = {
  word: string;
  index: number;
  opacity: number;
};

export default function ScrollRevealText({
  text,
  className = "",
  splitType = "character",
  staggerDelay = 10,
  scrollBuffer = 200,
}: ScrollRevealTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [words, setWords] = useState<WordData[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize split text
  useEffect(() => {
    if (splitType === "character") {
      const chars = text.split("").map((char, index) => ({
        char,
        index,
        opacity: 0,
      }));
      setCharacters(chars);
    } else if (splitType === "word") {
      const wordArray = text.split(/\s+/).map((word, index) => ({
        word,
        index,
        opacity: 0,
      }));
      setWords(wordArray);
    }
  }, [text, splitType]);

  // Handle scroll animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateOpacity = () => {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const elementTop = rect.top;
      const elementBottom = rect.bottom;

      // Calculate how much of the element is in viewport
      const elementHeight = rect.height;
      const scrollStart = viewportHeight + scrollBuffer;
      const scrollEnd = -scrollBuffer;

      // Clamp progress between 0 and 1
      let progress = 0;
      if (elementTop < scrollStart && elementBottom > scrollEnd) {
        // Element is in view
        const distanceFromTop = scrollStart - elementTop;
        const totalDistance = elementHeight + scrollStart - scrollEnd;
        progress = Math.max(0, Math.min(1, distanceFromTop / totalDistance));
      } else if (elementTop >= scrollStart) {
        // Element is below viewport
        progress = 0;
      } else if (elementBottom <= scrollEnd) {
        // Element is above viewport
        progress = 1;
      }

      if (splitType === "character") {
        const totalChars = characters.length;
        setCharacters((prevChars) =>
          prevChars.map((char) => {
            // Calculate when this character should be revealed
            const charProgress = progress * totalChars - char.index;
            const opacity = Math.max(0, Math.min(1, charProgress));
            return { ...char, opacity };
          })
        );
      } else if (splitType === "word") {
        const totalWords = words.length;
        setWords((prevWords) =>
          prevWords.map((word) => {
            const wordProgress = progress * totalWords - word.index;
            const opacity = Math.max(0, Math.min(1, wordProgress));
            return { ...word, opacity };
          })
        );
      }
    };

    const handleScroll = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateOpacity);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial call
    updateOpacity();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [characters, words, splitType, scrollBuffer]);

  if (splitType === "character") {
    return (
      <div
        ref={containerRef}
        className={`relative ${className}`}
        style={{ wordBreak: "break-word" }}
      >
        {characters.map((char, idx) => (
          <span
            key={idx}
            style={{
              opacity: char.opacity,
              color: `rgb(${Math.round(255 * char.opacity)}, ${Math.round(
                255 * char.opacity
              )}, ${Math.round(255 * char.opacity)})`,
              transition:
                "opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1), color 0.1s cubic-bezier(0.4, 0, 0.2, 1)",
              display: char.char === " " ? "inline" : "inline",
              letterSpacing: "inherit",
            }}
          >
            {char.char}
          </span>
        ))}
      </div>
    );
  }

  if (splitType === "word") {
    return (
      <div
        ref={containerRef}
        className={`relative ${className}`}
        style={{ wordBreak: "break-word" }}
      >
        {words.map((word, idx) => (
          <React.Fragment key={idx}>
            <span
              style={{
                opacity: word.opacity,
                color: `rgb(${Math.round(255 * word.opacity)}, ${Math.round(
                  255 * word.opacity
                )}, ${Math.round(255 * word.opacity)})`,
                transition:
                  "opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "inline",
              }}
            >
              {word.word}
            </span>
            {idx < words.length - 1 && <span> </span>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return null;
}
