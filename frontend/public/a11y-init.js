// public/a11y-init.js

(function() {
  'use strict';
  
  try {
    const prefs = localStorage.getItem('user-a11y-prefs');
    if (!prefs) return;
    
    const parsed = JSON.parse(prefs);
    const root = document.documentElement;
    
    // TEXT & TYPOGRAPHY
    root.style.setProperty('--a11y-font-size', parsed.text.fontSize + '%');
    root.style.setProperty('--a11y-line-height', String(parsed.text.lineHeight));
    root.style.setProperty('--a11y-letter-spacing', parsed.text.letterSpacing + 'em');
    root.style.setProperty('--a11y-word-spacing', parsed.text.wordSpacing + 'em');
    root.setAttribute('data-a11y-font', parsed.text.fontFamily);
    root.style.fontWeight = parsed.text.fontWeight;
    document.body.style.textAlign = parsed.text.textAlign;
    
    // VISUAL ENHANCEMENTS
    root.setAttribute('data-a11y-links', parsed.visual.linkHighlight ? 'true' : 'false');
    root.setAttribute('data-a11y-titles', parsed.visual.titleHighlight ? 'true' : 'false');
    root.setAttribute('data-a11y-contrast', parsed.visual.contrastBoost ? 'boost' : 'normal');
    root.setAttribute('data-a11y-saturation', parsed.visual.saturation);
    
    // READING AIDS
    root.setAttribute('data-a11y-focus', parsed.reading.focusHighlight ? 'true' : 'false');
    root.setAttribute('data-a11y-cursor', parsed.reading.bigCursor ? 'big' : 'normal');
    root.setAttribute('data-a11y-mask', parsed.reading.readingMask ? 'true' : 'false');
    
    if (parsed.reading.pauseAnimations) {
      root.style.setProperty('--a11y-animation-duration', '0.01ms');
    }
    
    // CONTENT SIMPLIFICATION
    root.setAttribute('data-a11y-images', parsed.content.hideImages ? 'hide' : 'show');
    root.setAttribute('data-a11y-sounds', parsed.content.muteSounds ? 'mute' : 'play');
    root.setAttribute('data-a11y-motion', parsed.content.reducedMotion ? 'reduced' : 'normal');
    
  } catch (error) {
    console.error('Failed to apply accessibility preferences:', error);
  }
})();