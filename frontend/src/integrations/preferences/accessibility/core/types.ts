// src/components/accessibility/types.ts

export interface TextPreferences {
  fontSize: number;        // 100-200%
  lineHeight: number;      // 1.5-2.5
  letterSpacing: number;   // 0-0.3em
  wordSpacing: number;     // 0-0.5em
  fontFamily: 'default' | 'dyslexia' | 'readable';
  fontWeight: 'normal' | 'semibold' | 'bold';
  textAlign: 'left' | 'justify';
}

export interface VisualPreferences {
  linkHighlight: boolean;
  titleHighlight: boolean;
  contrastBoost: boolean;
  saturation: 'normal' | 'low' | 'high' | 'monochrome';
}

export interface ReadingAids {
  readingGuide: boolean;
  readingMask: boolean;
  focusHighlight: boolean;
  bigCursor: boolean;
  pauseAnimations: boolean;
}

export interface ContentPreferences {
  hideImages: boolean;
  muteSounds: boolean;
  reducedMotion: boolean;
}

export interface A11yPreferences {
  text: TextPreferences;
  visual: VisualPreferences;
  reading: ReadingAids;
  content: ContentPreferences;
  timestamp: number;
  version: string;
}

export const DEFAULT_PREFS: A11yPreferences = {
  text: {
    fontSize: 100,
    lineHeight: 1.5,
    letterSpacing: 0,
    wordSpacing: 0,
    fontFamily: 'default',
    fontWeight: 'normal',
    textAlign: 'left',
  },
  visual: {
    linkHighlight: false,
    titleHighlight: false,
    contrastBoost: false,
    saturation: 'normal',
  },
  reading: {
    readingGuide: false,
    readingMask: false,
    focusHighlight: false,
    bigCursor: false,
    pauseAnimations: false,
  },
  content: {
    hideImages: false,
    muteSounds: false,
    reducedMotion: false,
  },
  timestamp: Date.now(),
  version: '1.0',
};