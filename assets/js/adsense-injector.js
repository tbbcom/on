// Grandmaster SEO Alchemist - Manual AdSense Injector v1.0
function initAds() {
  const adPlaceholders = document.querySelectorAll('.manual-adsense-ad');
  if (adPlaceholders.length === 0) return;

  const firstPlaceholder = adPlaceholders[0];
  const adClient = firstPlaceholder.dataset.adClient;

  if (!document.querySelector('script[src*="adsbygoogle.js"]') && adClient) {
    const adScript = document.createElement('script');
    adScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + adClient;
    adScript.async = true;
    adScript.crossOrigin = 'anonymous';
    document.head.appendChild(adScript);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const placeholder = entry.target;
      if (placeholder.childElementCount > 0) {
        observer.unobserve(placeholder);
        return;
      }

      const adClient = placeholder.dataset.adClient;
      const adSlot = placeholder.dataset.adSlot;

      if (!adClient || !adSlot) {
        console.error('AdSense placeholder is missing data-ad-client or data-ad-slot.');
        observer.unobserve(placeholder);
        return;
      }

      const adIns = document.createElement('ins');
      adIns.className = 'adsbygoogle';
      adIns.style.display = 'block';
      adIns.dataset.adClient = adClient;
      adIns.dataset.adSlot = adSlot;
      adIns.dataset.adFormat = 'auto';
      adIns.dataset.fullWidthResponsive = 'true';

      placeholder.appendChild(adIns);

      (window.adsbygoogle = window.adsbygoogle || []).push({});
      observer.unobserve(placeholder);
    });
  });

  adPlaceholders.forEach(placeholder => observer.observe(placeholder));
}

// Run after the page is fully loaded to avoid conflicts with React
window.addEventListener('load', initAds);
