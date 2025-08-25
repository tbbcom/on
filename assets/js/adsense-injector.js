// Grandmaster SEO Alchemist - Manual AdSense Injector v1.0
function injectAds() {
  const adPlaceholders = document.querySelectorAll('.manual-adsense-ad');
  adPlaceholders.forEach(placeholder => {
    if (placeholder.childElementCount > 0) return; // Ad already loaded, do nothing

    const adClient = placeholder.dataset.adClient;
    const adSlot = placeholder.dataset.adSlot;

    if (!adClient || !adSlot) {
      console.error('AdSense placeholder is missing data-ad-client or data-ad-slot.');
      return;
    }

    const adScript = document.createElement('script');
    adScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + adClient;
    adScript.async = true;
    adScript.crossOrigin = 'anonymous';
    
    const adIns = document.createElement('ins');
    adIns.className = 'adsbygoogle';
    adIns.style.display = 'block';
    adIns.dataset.adClient = adClient;
    adIns.dataset.adSlot = adSlot;
    adIns.dataset.adFormat = 'auto';
    adIns.dataset.fullWidthResponsive = 'true';

    placeholder.appendChild(adScript);
    placeholder.appendChild(adIns);

    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
}

// Run after the page is fully loaded to avoid conflicts with React
window.addEventListener('load', injectAds);
