// --- MASTER AD CONTROLLER v2.0 ---
function masterAdController() {
  // --- AUTO AD EXCLUSION ---
  function excludeAutoAdZones() {
    const noAdSelectors = [
      'table',
      '#header',
      '.custom-cta-box',
      '.tools-grid',
      '.icontainer',
      '.tool-card',
      '.recentpostsae',
      '.recentpostnavfeed',
      '.sitemap-wrapper',
      '.footer-sections'
    ];
    const elementsToExclude = document.querySelectorAll(noAdSelectors.join(', '));
    elementsToExclude.forEach(el => el.classList.add('google_ad_mod'));
    console.log('Auto Ad exclusion zones have been set.');
  }

  // --- INJECTOR & LAZY-LOADER ---
  function initManualAds() {
    const adPlaceholders = document.querySelectorAll('.manual-adsense-ad');
    if (adPlaceholders.length === 0) {
      // If no manual ads, still inject base script for Auto Ads
      const adClient = "ca-pub-XXXXXXXXXXXXXXXX"; // ADD YOUR ADSENSE ID HERE FOR AUTO ADS
      if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
        injectBaseScript(adClient);
      }
      return;
    }

    const firstPlaceholder = adPlaceholders[0];
    const adClient = firstPlaceholder.dataset.adClient;

    // Inject the main AdSense script file if it doesn't exist yet
    if (!document.querySelector('script[src*="adsbygoogle.js"]') && adClient) {
      injectBaseScript(adClient);
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        
        const placeholder = entry.target;
        // Stop observing once it's visible to prevent re-triggering
        observer.unobserve(placeholder);

        if (placeholder.childElementCount > 0) return;

        const client = placeholder.dataset.adClient;
        const slot = placeholder.dataset.adSlot;

        if (!client || !slot) {
          console.error('AdSense placeholder is missing data attributes.');
          return;
        }

        const adIns = document.createElement('ins');
        adIns.className = 'adsbygoogle';
        adIns.style.display = 'block';
        adIns.dataset.adClient = client;
        adIns.dataset.adSlot = slot;
        adIns.dataset.adFormat = placeholder.dataset.adFormat || 'auto';
        adIns.dataset.fullWidthResponsive = 'true';

        placeholder.appendChild(adIns);
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
    }, { rootMargin: '200px' }); // Start loading when ad is 200px away from viewport

    adPlaceholders.forEach(placeholder => observer.observe(placeholder));
  }
  
  function injectBaseScript(client) {
    const adScript = document.createElement('script');
    adScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    adScript.async = true;
    adScript.crossOrigin = 'anonymous';
    document.head.appendChild(adScript);
  }

  // --- EXECUTION ---
  excludeAutoAdZones();
  initManualAds();
}
window.addEventListener('load', masterAdController);
