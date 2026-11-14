export interface AnimatedLetter {
  char: string;
  index: number;
  reverseIndex: number;
}

export interface AnimatedWord {
  word: string;
  letters: AnimatedLetter[];
  isLast: boolean;
}

export function splitTextIntoAnimatedWords(text: string): AnimatedWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalLetters = words.reduce((sum, word) => sum + Array.from(word).length, 0);
  let currentIndex = 0;

  return words.map((word, wordIndex) => {
    const letters = Array.from(word).map((char) => {
      const letter: AnimatedLetter = { char, index: currentIndex, reverseIndex: totalLetters - currentIndex - 1 };
      currentIndex += 1;
      return letter;
    });
    return { word, letters, isLast: wordIndex === words.length - 1 };
  });
}
