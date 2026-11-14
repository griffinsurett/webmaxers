/**
 * Letter-by-Letter Animation Utility
 *
 * Splits text into individual character spans for staggered animations.
 * Preserves word boundaries and handles whitespace correctly.
 */

export interface LetterConfig {
  /** Base delay before animation starts (ms) */
  baseDelay?: number;
  /** Delay between each letter (ms) */
  staggerDelay?: number;
  /** CSS class to apply to each letter span */
  letterClassName?: string;
  /** CSS class to apply to word wrapper spans */
  wordClassName?: string;
  /** Whether to preserve spaces as visible characters */
  preserveSpaces?: boolean;
}

export interface LetterSpan {
  char: string;
  index: number;
  delay: number;
  isSpace: boolean;
  wordIndex: number;
}

export interface WordGroup {
  word: string;
  letters: LetterSpan[];
  wordIndex: number;
}

const DEFAULT_CONFIG: Required<LetterConfig> = {
  baseDelay: 0,
  staggerDelay: 30,
  letterClassName: "letter",
  wordClassName: "word",
  preserveSpaces: false,
};

/**
 * Splits a string into letter data for animation
 */
export function splitIntoLetters(
  text: string,
  config: LetterConfig = {}
): LetterSpan[] {
  const { baseDelay, staggerDelay } = { ...DEFAULT_CONFIG, ...config };
  const letters: LetterSpan[] = [];

  let letterIndex = 0;
  let wordIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isSpace = char === " " || char === "\t" || char === "\n";

    if (isSpace && i > 0 && !text[i - 1].match(/\s/)) {
      wordIndex++;
    }

    letters.push({
      char,
      index: letterIndex,
      delay: baseDelay + letterIndex * staggerDelay,
      isSpace,
      wordIndex: isSpace ? -1 : wordIndex,
    });

    letterIndex++;
  }

  return letters;
}

/**
 * Groups letters by word for word-wrapped animations
 */
export function splitIntoWords(
  text: string,
  config: LetterConfig = {}
): WordGroup[] {
  const letters = splitIntoLetters(text, config);
  const words: WordGroup[] = [];
  let currentWord: LetterSpan[] = [];
  let currentWordIndex = 0;
  let wordStarted = false;

  for (const letter of letters) {
    if (letter.isSpace) {
      if (currentWord.length > 0) {
        words.push({
          word: currentWord.map((l) => l.char).join(""),
          letters: currentWord,
          wordIndex: currentWordIndex,
        });
        currentWord = [];
        currentWordIndex++;
        wordStarted = false;
      }
      // Add space as its own "word" for proper spacing
      words.push({
        word: letter.char,
        letters: [letter],
        wordIndex: -1,
      });
    } else {
      currentWord.push(letter);
      wordStarted = true;
    }
  }

  // Don't forget the last word
  if (currentWord.length > 0) {
    words.push({
      word: currentWord.map((l) => l.char).join(""),
      letters: currentWord,
      wordIndex: currentWordIndex,
    });
  }

  return words;
}

/**
 * Calculates the total animation duration for a text string
 */
export function getAnimationDuration(
  text: string,
  config: LetterConfig = {}
): number {
  const { baseDelay, staggerDelay } = { ...DEFAULT_CONFIG, ...config };
  const nonSpaceChars = text.replace(/\s/g, "").length;
  return baseDelay + nonSpaceChars * staggerDelay;
}

/**
 * Creates CSS custom properties for letter animation timing
 */
export function getLetterStyle(
  letter: LetterSpan
): Record<string, string | number> {
  return {
    "--letter-delay": `${letter.delay}ms`,
    "--letter-index": letter.index,
  };
}
