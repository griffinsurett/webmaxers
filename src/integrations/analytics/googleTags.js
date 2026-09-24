/** Direct destinations copied from published GTM-P6HHJC3Z version 4.
 * Zest owns consent signals; this bridge owns loading and destination setup.
 * No GTM container and no redundant "Google Analytics" custom event.
 */
(function () {
  if (window.__webmaxxersGoogleTags) return;
  window.__webmaxxersGoogleTags = true;

  const GA4_ID = 'G-MWPC04E67Q';
  const ADS_ID = 'AW-18471438772';
  const configured = new Set();
  let loaded = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function sync() {
    const consent = window.Zest?.getConsent();
    if (!consent) return;
    window['ga-disable-' + GA4_ID] = consent.analytics !== true;
    const destinations = [];
    if (consent.analytics === true) destinations.push(GA4_ID);
    if (consent.marketing === true) destinations.push(ADS_ID);
    if (!destinations.length) return;

    // Zest emits zest:change after queuing the Google consent update.
    // Saved preferences are also restored before this component executes.
    if (!loaded) {
      loaded = true;
      window.gtag('js', new Date());
      const script = document.createElement('script');
      script.id = 'google-tags-loader';
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + destinations[0];
      document.head.appendChild(script);
    }
    for (const id of destinations) {
      if (configured.has(id)) continue;
      configured.add(id);
      window.gtag('config', id);
    }
  }

  document.addEventListener('zest:change', sync);
  document.addEventListener('zest:ready', sync);
  sync();
})();
