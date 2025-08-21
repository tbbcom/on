document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element Cache ---
  const DOMElements = {
    urlInput: document.getElementById('ib-url'),
    keywordInput: document.getElementById('ib-keyword'),
    brandInput: document.getElementById('ib-brand'),
    htmlInput: document.getElementById('ib-html'),
    analyzeUrlBtn: document.getElementById('ib-analyze-url'),
    analyzeCurrentBtn: document.getElementById('ib-analyze-current'),
    analyzeHtmlBtn: document.getElementById('ib-analyze-html'),
    resetBtn: document.getElementById('ib-reset'),
    resultsContainer: document.getElementById('ib-results'),
    summaryBadges: document.getElementById('ib-summary-badges'),
    serpTitle: document.getElementById('ib-serp-title'),
    serpUrl: document.getElementById('ib-serp-url'),
    serpDesc: document.getElementById('ib-serp-desc'),
    titleText: document.getElementById('ib-title-text'),
    titleMeter: document.getElementById('ib-title-meter'),
    titleMeta: document.getElementById('ib-title-meta'),
    descText: document.getElementById('ib-desc-text'),
    descMeter: document.getElementById('ib-desc-meter'),
    descMeta: document.getElementById('ib-desc-meta'),
    kpisContainer: document.getElementById('ib-kpis'),
    genTitlesBtn: document.getElementById('ib-gen-titles'),
    copyBestTitleBtn: document.getElementById('ib-copy-best-title'),
    titleSuggestions: document.getElementById('ib-title-suggestions'),
    genDescriptionsBtn: document.getElementById('ib-gen-descriptions'),
    copyBestDescBtn: document.getElementById('ib-copy-best-desc'),
    descSuggestions: document.getElementById('ib-desc-suggestions'),
    slugSourceInput: document.getElementById('ib-slug-source'),
    genSlugBtn: document.getElementById('ib-gen-slug'),
    copySlugBtn: document.getElementById('ib-copy-slug'),
    slugOutput: document.getElementById('ib-slug-output'),
    copyReportBtn: document.getElementById('ib-copy-report'),
    downloadReportBtn: document.getElementById('ib-download-report'),
  };

  // --- State ---
  let analysisReport = {};
  let lastAnalysisSource = '';

  // --- Constants ---
  const PIXEL_LIMITS = {
    TITLE: 600, // Google SERP title pixel limit (approx.)
    DESCRIPTION: 920, // Google SERP description pixel limit (approx.)
  };
  const FONT_STYLES = {
    TITLE: '18px Arial',
    DESCRIPTION: '14px Arial',
  };

  // --- Utility Functions ---
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const getTextPixelWidth = (text, fontStyle) => {
    ctx.font = fontStyle;
    return ctx.measureText(text).width;
  };

  const createBadge = (text, status) => `<span class="ib-badge ${status}">${text}</span>`;
  const createKpi = (label, value) => `<div class="ib-kpi"><b>${label}</b><span>${value}</span></div>`;

  const copyToClipboard = (text, button) => {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }).catch(err => console.error('Failed to copy:', err));
  };
  
  const sanitizeSlug = (text) => {
    if (!text) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return text.toString().toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
  }

  // --- Core Analysis Logic ---
  const parseHtmlAndExtractData = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const getMetaContent = (name) => doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') || '';

    const allLinks = Array.from(doc.querySelectorAll('a[href]'));
    const internalLinks = allLinks.filter(a => a.href.includes(window.location.hostname) || a.href.startsWith('/')).length;
    
    const allImages = Array.from(doc.querySelectorAll('img'));
    const imagesWithAlt = allImages.filter(img => img.alt && img.alt.trim() !== '').length;

    const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const jsonLdTypes = jsonLdScripts.map(script => {
      try {
        const json = JSON.parse(script.textContent);
        return json['@type'] || 'N/A';
      } catch (e) {
        return 'Invalid JSON';
      }
    }).flat();

    return {
      title: doc.querySelector('title')?.innerText.trim() || '',
      description: getMetaContent('description'),
      url: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || 'Not found',
      robots: getMetaContent('robots'),
      viewport: getMetaContent('viewport'),
      h1s: Array.from(doc.querySelectorAll('h1')).map(h => h.innerText.trim()),
      og: {
        title: getMetaContent('og:title'),
        description: getMetaContent('og:description'),
        image: getMetaContent('og:image'),
        url: getMetaContent('og:url'),
        type: getMetaContent('og:type'),
      },
      twitter: {
        card: getMetaContent('twitter:card'),
        title: getMetaContent('twitter:title'),
        description: getMetaContent('twitter:description'),
        image: getMetaContent('twitter:image'),
      },
      links: {
        total: allLinks.length,
        internal: internalLinks,
        external: allLinks.length - internalLinks,
      },
      images: {
        total: allImages.length,
        withAlt: imagesWithAlt,
        missingAlt: allImages.length - imagesWithAlt,
      },
      jsonLd: jsonLdTypes.length > 0 ? jsonLdTypes.join(', ') : 'Not found',
    };
  };

  const generateAnalysisReport = (data) => {
    const title = data.title;
    const description = data.description;
    const keyword = DOMElements.keywordInput.value.toLowerCase();
    
    const titlePixels = getTextPixelWidth(title, FONT_STYLES.TITLE);
    const descPixels = getTextPixelWidth(description, FONT_STYLES.DESCRIPTION);

    const badges = [];
    const kpis = [];
    
    // Title Analysis
    let titleStatus, titleMessage;
    if (!title) {
        titleStatus = 'err';
        titleMessage = 'Title is missing.';
        badges.push(createBadge('No Title', 'err'));
    } else if (titlePixels > PIXEL_LIMITS.TITLE) {
        titleStatus = 'err';
        titleMessage = 'Title is too long.';
        badges.push(createBadge('Title Too Long', 'err'));
    } else if (title.length < 20) {
        titleStatus = 'warn';
        titleMessage = 'Title is too short.';
        badges.push(createBadge('Title Too Short', 'warn'));
    } else {
        titleStatus = 'ok';
        titleMessage = 'Title length is good.';
        badges.push(createBadge('Good Title', 'ok'));
    }

    // Description Analysis
    let descStatus, descMessage;
    if (!description) {
        descStatus = 'warn';
        descMessage = 'Meta description is missing.';
        badges.push(createBadge('No Description', 'warn'));
    } else if (descPixels > PIXEL_LIMITS.DESCRIPTION) {
        descStatus = 'err';
        descMessage = 'Description is too long.';
        badges.push(createBadge('Desc Too Long', 'err'));
    } else if (description.length < 50) {
        descStatus = 'warn';
        descMessage = 'Description is too short.';
        badges.push(createBadge('Desc Too Short', 'warn'));
    } else {
        descStatus = 'ok';
        descMessage = 'Description length is good.';
        badges.push(createBadge('Good Description', 'ok'));
    }

    // Keyword checks
    if (keyword) {
        if (title.toLowerCase().includes(keyword)) badges.push(createBadge('Keyword in Title', 'ok'));
        else badges.push(createBadge('Keyword missing in Title', 'warn'));
        if (description.toLowerCase().includes(keyword)) badges.push(createBadge('Keyword in Desc', 'ok'));
        else badges.push(createBadge('Keyword missing in Desc', 'warn'));
    }

    // Technical KPIs
    kpis.push(createKpi('Canonical URL', data.url || 'Not set'));
    kpis.push(createKpi('Robots Meta', data.robots || 'Not set (defaults to index, follow)'));
    kpis.push(createKpi('H1 Tags', data.h1s.length > 0 ? `${data.h1s.length}: "${data.h1s[0]}"` : '0 tags found'));
    kpis.push(createKpi('Image Alt Tags', `${data.images.withAlt} of ${data.images.total} images have alt text.`));
    kpis.push(createKpi('Links', `${data.links.internal} internal, ${data.links.external} external`));
    kpis.push(createKpi('JSON-LD Schema', data.jsonLd));
    kpis.push(createKpi('Open Graph', data.og.title ? 'Present' : 'Missing'));
    kpis.push(createKpi('Twitter Card', data.twitter.card ? 'Present' : 'Missing'));
    
    return {
      raw: data,
      title: { text: title, length: title.length, pixels: titlePixels, status: titleStatus, message: titleMessage },
      description: { text: description, length: description.length, pixels: descPixels, status: descStatus, message: descMessage },
      serp: { url: data.url },
      summary: { badges: badges.join('') },
      kpis: { html: kpis.join('') }
    };
  };

  // --- UI Update Logic ---
  const updateUI = (report) => {
    analysisReport = report; // Store for export
    
    // SERP Preview
    DOMElements.serpTitle.textContent = report.title.text || 'Your Title Will Appear Here';
    DOMElements.serpDesc.textContent = report.description.text || 'Your meta description will be displayed in this area. Craft a compelling summary to entice users to click.';
    DOMElements.serpUrl.textContent = report.serp.url;

    // Summary Badges
    DOMElements.summaryBadges.innerHTML = report.summary.badges;

    // Title Details
    DOMElements.titleText.textContent = report.title.text;
    const titleWidthPercent = Math.min((report.title.pixels / PIXEL_LIMITS.TITLE) * 100, 100);
    DOMElements.titleMeter.style.width = `${titleWidthPercent}%`;
    DOMElements.titleMeter.parentElement.classList.toggle('err', report.title.status === 'err');
    DOMElements.titleMeta.textContent = `${report.title.length} characters / ${Math.round(report.title.pixels)} pixels. ${report.title.message}`;

    // Description Details
    DOMElements.descText.textContent = report.description.text;
    const descWidthPercent = Math.min((report.description.pixels / PIXEL_LIMITS.DESCRIPTION) * 100, 100);
    DOMElements.descMeter.style.width = `${descWidthPercent}%`;
    DOMElements.descMeter.parentElement.classList.toggle('err', report.description.status === 'err');
    DOMElements.descMeta.textContent = `${report.description.length} characters / ${Math.round(report.description.pixels)} pixels. ${report.description.message}`;

    // KPIs
    DOMElements.kpisContainer.innerHTML = report.kpis.html;

    // Show results
    DOMElements.resultsContainer.hidden = false;
    DOMElements.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  };
  
  const setLoadingState = (isLoading) => {
    const buttons = [DOMElements.analyzeUrlBtn, DOMElements.analyzeCurrentBtn, DOMElements.analyzeHtmlBtn];
    buttons.forEach(btn => {
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Analyzing...' : btn.dataset.originalText;
    });
  };

  // --- Main Execution ---
  const runAnalysis = (htmlSource, sourceName) => {
    if (!htmlSource) {
      alert('Could not find any HTML to analyze.');
      return;
    }
    setLoadingState(true);
    lastAnalysisSource = sourceName;
    setTimeout(() => { // Gives browser time to update UI
        try {
            const data = parseHtmlAndExtractData(htmlSource);
            const report = generateAnalysisReport(data);
            updateUI(report);
        } catch (error) {
            console.error('Analysis failed:', error);
            alert('An error occurred during analysis. Check the console for details.');
        } finally {
            setLoadingState(false);
        }
    }, 50);
  };

  // --- Event Handlers ---
  const handleAnalyzeUrl = async () => {
    const url = DOMElements.urlInput.value;
    if (!url) {
      alert('Please enter a URL.');
      return;
    }
    
    // Use a free CORS proxy for external URLs. Note: Public proxies can be unreliable.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    setLoadingState(true);
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
      const html = await response.text();
      runAnalysis(html, url);
    } catch (error) {
      setLoadingState(false);
      console.error('Fetch error:', error);
      alert('Could not fetch the URL. This might be due to CORS policy or network issues. Try pasting the HTML source directly.');
    }
  };

  const handleAnalyzeHtml = () => runAnalysis(DOMElements.htmlInput.value, 'Pasted HTML');
  const handleAnalyzeCurrent = () => runAnalysis(document.documentElement.outerHTML, window.location.href);

  const handleReset = () => {
    DOMElements.urlInput.value = '';
    DOMElements.keywordInput.value = '';
    DOMElements.htmlInput.value = '';
    DOMElements.resultsContainer.hidden = true;
    DOMElements.titleSuggestions.innerHTML = '';
    DOMElements.descSuggestions.innerHTML = '';
    DOMElements.slugOutput.textContent = '';
    DOMElements.slugSourceInput.value = '';
    analysisReport = {};
  };

  // --- Generator Functions ---
  const generateTitles = () => {
    const kw = DOMElements.keywordInput.value || 'Your Keyword';
    const brand = DOMElements.brandInput.value || 'Your Brand';
    const h1 = analysisReport.raw?.h1s[0] || kw;

    const templates = [
      `${kw} | ${brand}`,
      `The Ultimate Guide to ${kw}`,
      `${h1}`,
      `${kw}: Everything You Need to Know`,
      `How to ${kw} (Step-by-Step)`,
      `${new Date().getFullYear()} ${kw} Review | ${brand}`
    ];
    
    renderSuggestions(templates, DOMElements.titleSuggestions, FONT_STYLES.TITLE, PIXEL_LIMITS.TITLE);
  };
  
  const generateDescriptions = () => {
      const kw = DOMElements.keywordInput.value || 'your keyword';
      const title = analysisReport.raw?.title || `a guide on ${kw}`;
      
      const templates = [
        `Looking for information on ${kw}? Discover everything you need to know about ${kw} in our comprehensive guide. Learn the best practices today.`,
        `Explore the complete guide to ${title}. We cover all aspects to help you master ${kw} effectively. Get started now!`,
        `Unlock the secrets of ${kw}. This post breaks down the core concepts and provides actionable tips to help you succeed.`,
        `Learn how to ${kw} with our expert tips. This detailed article provides everything you need for success. Read more here.`
      ];

      renderSuggestions(templates, DOMElements.descSuggestions, FONT_STYLES.DESCRIPTION, PIXEL_LIMITS.DESCRIPTION);
  };
  
  const renderSuggestions = (suggestions, container, fontStyle, limit) => {
    container.innerHTML = suggestions.map(text => {
      const pixels = getTextPixelWidth(text, fontStyle);
      const status = pixels > limit ? 'err' : (pixels > limit * 0.9 ? 'warn' : 'ok');
      const fit = pixels > limit ? 'Too Long' : 'Good Fit';
      return `
        <div class="ib-suggestion">
          <p>${text}</p>
          <div class="ib-badges" style="margin-top:4px;">
            ${createBadge(`${Math.round(pixels)}px`, status)}
            ${createBadge(fit, status)}
          </div>
        </div>`;
    }).join('');
  };
  
  const copyBestSuggestion = (container, limit, fontStyle) => {
      const suggestions = Array.from(container.querySelectorAll('.ib-suggestion p'));
      const bestFit = suggestions
        .map(p => ({ text: p.textContent, pixels: getTextPixelWidth(p.textContent, fontStyle) }))
        .filter(item => item.pixels <= limit)
        .sort((a, b) => b.pixels - a.pixels)[0];
        
      if (bestFit) {
        copyToClipboard(bestFit.text, container.previousElementSibling.querySelector('.ibtn:last-child'));
      } else {
        alert('No suggestions fit within the pixel limit.');
      }
  };

  const handleGenerateSlug = () => {
    const sourceText = DOMElements.slugSourceInput.value || analysisReport.raw?.title || DOMElements.keywordInput.value;
    if (!sourceText) {
        alert('Enter some text or run an analysis to generate a slug.');
        return;
    }
    DOMElements.slugOutput.textContent = sanitizeSlug(sourceText);
  };
  
  const handleCopySlug = () => {
      if(DOMElements.slugOutput.textContent) {
          copyToClipboard(DOMElements.slugOutput.textContent, DOMElements.copySlugBtn);
      }
  };

  // --- Export Functions ---
  const handleExport = (action) => {
    if (Object.keys(analysisReport).length === 0) {
      alert('Please run an analysis first.');
      return;
    }
    const reportJson = JSON.stringify({
        source: lastAnalysisSource,
        timestamp: new Date().toISOString(),
        analysis: analysisReport
    }, null, 2);

    if (action === 'copy') {
        copyToClipboard(reportJson, DOMElements.copyReportBtn);
    } else if (action === 'download') {
        const blob = new Blob([reportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'seo-report.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
  };
  
  // --- Event Listener Binding ---
  const init = () => {
      Object.values(DOMElements).forEach(el => {
          if (el && el.tagName === 'BUTTON') {
              el.dataset.originalText = el.textContent;
          }
      });

      DOMElements.analyzeUrlBtn.addEventListener('click', handleAnalyzeUrl);
      DOMElements.analyzeHtmlBtn.addEventListener('click', handleAnalyzeHtml);
      DOMElements.analyzeCurrentBtn.addEventListener('click', handleAnalyzeCurrent);
      DOMElements.resetBtn.addEventListener('click', handleReset);
      DOMElements.genTitlesBtn.addEventListener('click', generateTitles);
      DOMElements.copyBestTitleBtn.addEventListener('click', () => copyBestSuggestion(DOMElements.titleSuggestions, PIXEL_LIMITS.TITLE, FONT_STYLES.TITLE));
      DOMElements.genDescriptionsBtn.addEventListener('click', generateDescriptions);
      DOMElements.copyBestDescBtn.addEventListener('click', () => copyBestSuggestion(DOMElements.descSuggestions, PIXEL_LIMITS.DESCRIPTION, FONT_STYLES.DESCRIPTION));
      DOMElements.genSlugBtn.addEventListener('click', handleGenerateSlug);
      DOMElements.copySlugBtn.addEventListener('click', handleCopySlug);
      DOMElements.copyReportBtn.addEventListener('click', () => handleExport('copy'));
      DOMElements.downloadReportBtn.addEventListener('click', () => handleExport('download'));
  };

  init();
});
