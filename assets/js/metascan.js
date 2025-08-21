/*! SEO Meta Analyzer & Generator — Vanilla JS — TheBukitBesi
    Notes:
    - Uses canvas to measure pixel width for more realistic SERP truncation.
    - CORS: Cross-domain fetch is blocked. Use paste-HTML fallback.
    - Buttons/classes prefixed with "ib"/"ibtn" to avoid theme conflicts.
*/
(function(){
  'use strict';

  // ---------- Utility ----------
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const nowYear = new Date().getFullYear();

  function measurePx(text, font = getComputedStyle(document.body).font) {
    if (!measurePx._c) {
      measurePx._c = document.createElement('canvas');
      measurePx._ctx = measurePx._c.getContext('2d');
    }
    const ctx = measurePx._ctx;
    ctx.font = font;
    return ctx.measureText(text || '').width;
  }

  function trimToPx(text, maxPx, font) {
    if (!text) return '';
    let acc = '';
    for (let i = 0; i < text.length; i++) {
      const next = acc + text[i];
      if (measurePx(next, font) > maxPx) break;
      acc = next;
    }
    return (acc.length < text.length) ? acc.trim().replace(/[ .,;:!?-]*$/,'') + '…' : acc;
  }

  function slugify(input) {
    const s = (input||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    let slug = s.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const stops = new Set(['a','an','and','the','of','to','for','in','on','at','by','with','from','or','as','is','are','be','this','that','it','your','you','we','our','their','how','what','why']);
    slug = slug.split(' ').filter(w => !stops.has(w)).join('-');
    slug = slug.replace(/-+/g,'-').replace(/^-|-$/g,'');
    if (slug.length > 60) slug = slug.slice(0,60).replace(/-+[^-]*$/,'');
    return slug;
  }

  function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function absUrl(href, base) {
    try { return new URL(href, base).href; } catch(e){ return href; }
  }

  function safeText(node) {
    return (node && (node.textContent||'').trim()) || '';
  }

  function getMeta(doc, name) {
    return doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
           doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';
  }

  function statusBadge(text, level='ok') {
    const b = document.createElement('span');
    b.className = `ib-badge ${level}`;
    b.textContent = text;
    return b;
  }

  function setMeter(el, value, max=1) {
    const pct = Math.max(0, Math.min(1, value / max));
    el.style.width = (pct*100).toFixed(1)+'%';
  }

  function summarizeLevel(levels) {
    if (levels.includes('err')) return 'err';
    if (levels.includes('warn')) return 'warn';
    return 'ok';
  }

  // ---------- Analysis ----------
  function analyzeDoc(doc, sourceUrl='', keyword='') {
    const font = getComputedStyle(document.body).font;
    const title = safeText(doc.querySelector('title'));
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const robots = getMeta(doc, 'robots').toLowerCase();
    const viewport = getMeta(doc, 'viewport');
    const lang = doc.documentElement.getAttribute('lang') || '';
    const ogTitle = getMeta(doc, 'og:title') || '';
    const ogDesc = getMeta(doc, 'og:description') || '';
    const ogImg = getMeta(doc, 'og:image') || '';
    const twTitle = getMeta(doc, 'twitter:title') || '';
    const twDesc = getMeta(doc, 'twitter:description') || '';
    const twCard = getMeta(doc, 'twitter:card') || '';
    const favicon = doc.querySelector('link[rel="icon"],link[rel="shortcut icon"],link[rel="mask-icon"]')?.getAttribute('href') || '';

    const h1s = $$('h1', doc).map(h => safeText(h)).filter(Boolean);
    const imgs = $$('img', doc);
    const imgsMissingAlt = imgs.filter(i => !i.hasAttribute('alt') || i.getAttribute('alt').trim()==='').length;

    const baseHref = doc.querySelector('base')?.getAttribute('href') || (sourceUrl || location.href);
    const links = $$('a[href]', doc).map(a => {
      const href = a.getAttribute('href');
      const url = absUrl(href, baseHref);
      const rel = (a.getAttribute('rel')||'').toLowerCase();
      return {href:url, rel};
    });

    let internal=0, external=0, nofollow=0, ugc=0, sponsored=0;
    let host = '';
    try { host = new URL(sourceUrl || location.href).host; } catch(e){}
    links.forEach(l=>{
      try {
        const h = new URL(l.href).host;
        if (host && h === host) internal++; else external++;
      } catch(e){ /* ignore */ }
      if (l.rel.includes('nofollow')) nofollow++;
      if (l.rel.includes('ugc')) ugc++;
      if (l.rel.includes('sponsored')) sponsored++;
    });

    // JSON-LD types
    const jsonLdScripts = $$('script[type="application/ld+json"]', doc);
    const jsonldTypes = [];
    jsonLdScripts.forEach(s=>{
      try {
        const json = JSON.parse(s.textContent);
        const collectTypes = (node) => {
          if (!node) return;
          if (Array.isArray(node)) return node.forEach(collectTypes);
          if (typeof node === 'object') {
            if (node['@type']) jsonldTypes.push(Array.isArray(node['@type']) ? node['@type'].join(',') : node['@type']);
            Object.values(node).forEach(collectTypes);
          }
        };
        collectTypes(json);
      } catch(e){ /* ignore parse errors */ }
    });

    // Measurements
    const titlePx = measurePx(title, font);
    const titleChars = title.length;
    const titleMaxPx = 600;   // approximate
    const titleGoodUpper = 580; // safer cutoff
    const titleStatus = !title ? 'err' : (titlePx <= titleGoodUpper ? 'ok' : 'warn');

    const descPxDesktop = measurePx(metaDesc, font);
    const descPxMobile = descPxDesktop; // same text width in px, different limit
    const descChars = metaDesc.length;
    const descMaxPxDesktop = 920;
    const descMaxPxMobile  = 680;
    const descStatus = !metaDesc ? 'warn' : ((descPxDesktop <= descMaxPxDesktop && descPxMobile <= descMaxPxDesktop) ? 'ok' : 'warn');

    const hasCanonical = !!canonical;
    let canonicalStatus = hasCanonical ? 'ok' : 'warn';
    if (hasCanonical && sourceUrl) {
      try {
        const cHost = new URL(canonical, baseHref).host;
        const sHost = new URL(sourceUrl).host;
        if (cHost !== sHost) canonicalStatus = 'warn';
      } catch(e){}
    }

    let robotsIndex = true, robotsFollow = true;
    if (robots.includes('noindex')) robotsIndex = false;
    if (robots.includes('nofollow')) robotsFollow = false;
    const robotsStatus = robotsIndex && robotsFollow ? 'ok' : (robotsIndex ? 'warn' : 'err');

    const h1Status = h1s.length === 0 ? 'warn' : 'ok';
    const viewportStatus = viewport ? 'ok' : 'warn';
    const langStatus = lang ? 'ok' : 'warn';
    const ogStatus = (ogTitle || twTitle) ? 'ok' : 'warn';
    const imgAltStatus = imgsMissingAlt > 0 ? (imgsMissingAlt > Math.max(2, imgs.length*0.2) ? 'warn' : 'warn') : 'ok';

    // Keyword placements (if provided)
    const kw = (keyword||'').trim().toLowerCase();
    const hasKw = kw ? {
      title: title.toLowerCase().includes(kw),
      desc: metaDesc.toLowerCase().includes(kw),
      h1: h1s.some(h => h.toLowerCase().includes(kw))
    } : null;

    // Suggestions
    const suggestions = [];
    if (!title) suggestions.push('Add a concise, descriptive <title> with your primary keyword.');
    else {
      if (titlePx > titleGoodUpper) suggestions.push('Shorten the title to avoid truncation on Google (keep ≲ 580 px).');
      if (kw && !hasKw.title) suggestions.push('Include the primary keyword near the start of the title.');
    }
    if (!metaDesc) suggestions.push('Add a compelling meta description (≈ 140–160 chars) to improve CTR.');
    else {
      if (kw && !hasKw.desc) suggestions.push('Mention the primary keyword once in the meta description naturally.');
      if (descPxDesktop > descMaxPxDesktop) suggestions.push('Reduce meta description to fit under ~920 px (desktop).');
    }
    if (!viewport) suggestions.push('Add a responsive viewport meta tag for mobile friendliness.');
    if (!lang) suggestions.push('Set the <html lang="..."> attribute for better accessibility and SEO.');
    if (!canonical) suggestions.push('Add a canonical URL to consolidate signals and prevent duplicates.');
    if (!robotsIndex) suggestions.push('Remove noindex from robots meta if you want this page indexed.');
    if (imgsMissingAlt > 0) suggestions.push(`Add alt text to ${imgsMissingAlt} image(s) for accessibility and image SEO.`);
    if (!ogTitle && !twTitle) suggestions.push('Add Open Graph/Twitter tags for better social sharing previews.');
    if (h1s.length === 0) suggestions.push('Add a clear H1 that reflects the page topic.');

    const severity = summarizeLevel([titleStatus, descStatus, canonicalStatus, robotsStatus, viewportStatus, langStatus, ogStatus, imgAltStatus]);

    return {
      sourceUrl,
      baseHref,
      title, titleChars, titlePx, titleMaxPx, titleGoodUpper, titleStatus,
      metaDesc, descChars, descPxDesktop, descPxMobile, descMaxPxDesktop, descMaxPxMobile, descStatus,
      canonical, canonicalStatus,
      robots, robotsIndex, robotsFollow, robotsStatus,
      viewport, viewportStatus,
      lang, langStatus,
      og: {ogTitle, ogDesc, ogImg, twTitle, twDesc, twCard, status: ogStatus},
      h1s, h1Status,
      favicon,
      images: {count: imgs.length, missingAlt: imgsMissingAlt, status: imgAltStatus},
      links: {total: links.length, internal, external, nofollow, ugc, sponsored},
      jsonldTypes,
      keyword: kw,
      keywordUsage: hasKw,
      suggestions,
      severity
    };
  }

  // ---------- Render ----------
  function renderResults(r) {
    $('#ib-results').hidden = false;

    const badges = $('#ib-summary-badges');
    badges.innerHTML = '';
    badges.append(
      statusBadge(r.severity==='ok' ? 'Overall: Good' : r.severity==='warn' ? 'Overall: Needs tweaks' : 'Overall: Critical', r.severity),
      statusBadge(r.title ? 'Title found' : 'Missing title', r.title ? r.titleStatus : 'err'),
      statusBadge(r.metaDesc ? 'Meta description' : 'Missing description', r.metaDesc ? r.descStatus : 'warn'),
      statusBadge(r.canonical ? 'Canonical' : 'No canonical', r.canonical ? r.canonicalStatus : 'warn'),
      statusBadge(r.robotsIndex ? 'Indexable' : 'Noindex', r.robotsStatus),
      statusBadge(r.viewport ? 'Viewport' : 'No viewport', r.viewportStatus),
      statusBadge(r.lang ? `lang=${r.lang}` : 'No lang', r.langStatus),
      statusBadge(r.og.status==='ok' ? 'OG/Twitter' : 'Missing OG/Twitter', r.og.status),
      statusBadge(r.images.missingAlt===0 ? 'Image alts OK' : `${r.images.missingAlt} image(s) missing alt`, r.images.status)
    );

    // SERP preview
    const serpUrl = r.sourceUrl || r.baseHref || location.href;
    const serpTitle = trimToPx(r.title || 'No title found', 580);
    const serpDesc = trimToPx(r.metaDesc || 'No meta description found. Add a concise, benefit-driven summary around 150 characters.', 920);
    $('#ib-serp-title').textContent = serpTitle || 'Title preview';
    $('#ib-serp-url').textContent = serpUrl.replace(/^https?:\/\//,'');
    $('#ib-serp-desc').textContent = serpDesc;

    // Title card
    $('#ib-title-text').textContent = r.title || '(missing)';
    setMeter($('#ib-title-meter'), r.titlePx, r.titleMaxPx);
    $('#ib-title-meta').textContent = r.title
      ? `Characters: ${r.titleChars} • Pixels: ${Math.round(r.titlePx)} px • Recommended ≤ ~${r.titleGoodUpper} px`
      : 'Add a <title> tag to define the page’s title in SERPs.';

    // Description card
    $('#ib-desc-text').textContent = r.metaDesc || '(missing)';
    setMeter($('#ib-desc-meter'), Math.min(r.descPxDesktop, r.descMaxPxDesktop), r.descMaxPxDesktop);
    $('#ib-desc-meta').textContent = r.metaDesc
      ? `Chars: ${r.descChars} • Pixels: ${Math.round(r.descPxDesktop)} px (desktop) • Target ≤ ${r.descMaxPxDesktop} px (~140–160 chars)`
      : 'Add a meta description to influence SERP snippet and improve CTR.';

    // KPIs
    const kpis = $('#ib-kpis');
    const listTypes = r.jsonldTypes.length ? r.jsonldTypes.join(', ') : 'None';
    const fav = r.favicon ? absUrl(r.favicon, r.baseHref) : '';
    kpis.innerHTML = `
      <div class="ib-kpi"><b>Canonical</b><div class="ib-small">${r.canonical ? `<a href="${absUrl(r.canonical, r.baseHref)}" target="_blank" rel="noopener">${r.canonical}</a>` : '—'}</div></div>
      <div class="ib-kpi"><b>Robots</b><div class="ib-small">${r.robots || '—'}</div></div>
      <div class="ib-kpi"><b>Viewport</b><div class="ib-small">${r.viewport || '—'}</div></div>
      <div class="ib-kpi"><b>H1s</b><div class="ib-small">${r.h1s.length ? r.h1s.map(h=>`• ${h}`).join('<br>') : '—'}</div></div>
      <div class="ib-kpi"><b>OG/Twitter</b><div class="ib-small">${r.og.ogTitle || r.og.twTitle ? 'Present' : 'Missing'}</div></div>
      <div class="ib-kpi"><b>JSON-LD types</b><div class="ib-small">${listTypes}</div></div>
      <div class="ib-kpi"><b>Images</b><div class="ib-small">${r.images.count} total • ${r.images.missingAlt} missing alt</div></div>
      <div class="ib-kpi"><b>Links</b><div class="ib-small">${r.links.total} total • ${r.links.internal} internal • ${r.links.external} external • ${r.links.nofollow} nofollow</div></div>
      <div class="ib-kpi"><b>Favicon</b><div class="ib-small">${fav ? `<a href="${fav}" target="_blank" rel="noopener">${fav}</a>` : '—'}</div></div>
    `;

    // Save last analysis
    window._ib_lastAnalysis = r;
  }

  // ---------- Generators ----------
  function genTitleIdeas(kw, brand) {
    const b = (brand||'').trim();
    const suffix = b ? ` | ${b}` : '';
    const Y = nowYear;
    const kwCap = kw ? kw[0].toUpperCase()+kw.slice(1) : 'SEO';
    const base = [
      `${kwCap}: Complete Guide (${Y})${suffix}`,
      `What is ${kwCap}? Benefits, Examples & Tips${suffix}`,
      `Best ${kwCap} Checklist (${Y})${suffix}`,
      `${kwCap} Explained Simply: Steps & Tools${suffix}`,
      `${kwCap} for Beginners (${Y})${suffix}`,
      `${kwCap} vs Alternatives: Which to Choose?${suffix}`,
      `Free ${kwCap} Tool & SERP Preview${suffix}`,
      `${kwCap}: Pro Tips to Boost CTR${suffix}`
    ];
    // Filter to fit ~580px
    const font = getComputedStyle(document.body).font;
    return base.filter(t => measurePx(t, font) <= 580).slice(0, 6);
  }

  function genDescIdeas(kw, brand) {
    const b = (brand||'').trim();
    const who = b ? ` by ${b}` : '';
    const Y = nowYear;
    const target = 155; // target chars
    const candidates = [
      `Analyze title and meta description length by pixels, preview Google snippets, and fix issues fast. Free SEO meta analyzer${who}.`,
      `Check title and description length, canonical, robots, OG/Twitter, H1s, JSON‑LD, and more. Pixel‑accurate SERP preview included.`,
      `Optimize your ${kw||'page'} with a fast, accurate SEO meta analyzer. Generate titles, slugs, and descriptions that fit Google’s limits (${Y}).`,
      `Boost CTR with perfectly sized titles and meta descriptions. Validate canonical, robots, Open Graph, Twitter, and structured data${who}.`
    ];
    return candidates.map(s => s.length>165 ? s.slice(0, 158).replace(/\s+\S*$/,'')+'…' : s);
  }

  // ---------- Actions ----------
  async function analyzeFromUrl(url, keyword) {
    if (!url) throw new Error('Please enter a URL');
    const sameOrigin = (()=>{try{return new URL(url, location.href).origin===location.origin;}catch(e){return false;}})();
    let text = '';
    try {
      const res = await fetch(url, {mode: sameOrigin ? 'cors' : 'cors'});
      if (!res.ok) throw new Error('Request failed: '+res.status);
      text = await res.text();
    } catch(e) {
      throw new Error('Browser blocked reading this page (CORS). Use “Paste HTML” for cross-domain pages.');
    }
    const doc = parseHTML(text);
    const r = analyzeDoc(doc, url, keyword);
    renderResults(r);
  }

  function analyzeFromCurrent(keyword) {
    const doc = document.cloneNode(true);
    const r = analyzeDoc(doc, location.href, keyword);
    renderResults(r);
  }

  function analyzeFromHtml(html, baseUrl, keyword) {
    if (!html || html.trim()==='') throw new Error('Please paste HTML first.');
    const doc = parseHTML(html);
    const r = analyzeDoc(doc, baseUrl||'', keyword);
    renderResults(r);
  }

  // ---------- Event bindings ----------
  function bindUI() {
    const elUrl = $('#ib-url');
    const elKw = $('#ib-keyword');
    const elBrand = $('#ib-brand');
    const elHtml = $('#ib-html');

    $('#ib-analyze-url').addEventListener('click', async () => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Analyzing…';
      try {
        await analyzeFromUrl(elUrl.value.trim(), elKw.value.trim());
      } catch(e) { alert(e.message || String(e)); }
      finally { btn.disabled = false; btn.textContent = 'Analyze URL'; }
    });

    $('#ib-analyze-current').addEventListener('click', () => {
      analyzeFromCurrent(elKw.value.trim());
    });

    $('#ib-analyze-html').addEventListener('click', () => {
      analyzeFromHtml(elHtml.value, $('#ib-url').value.trim(), elKw.value.trim());
    });

    $('#ib-reset').addEventListener('click', () => {
      $('#ib-results').hidden = true;
      elUrl.value=''; elKw.value=''; elHtml.value=''; $('#ib-slug-source').value='';
      $('#ib-title-suggestions').innerHTML=''; $('#ib-desc-suggestions').innerHTML='';
      $('#ib-slug-output').textContent='';
    });

    // Generators
    $('#ib-gen-titles').addEventListener('click', () => {
      const ideas = genTitleIdeas(elKw.value.trim() || 'SEO Meta Analyzer', elBrand.value.trim());
      const wrap = $('#ib-title-suggestions'); wrap.innerHTML='';
      const font = getComputedStyle(document.body).font;
      (ideas.length?ideas:['Add a keyword to generate']).forEach(t=>{
        const px = measurePx(t, font);
        const div = document.createElement('div');
        div.className = 'ib-suggestion';
        div.innerHTML = `
          <div class="ib-small ib-muted">Pixels: ${Math.round(px)} px</div>
          <div class="ib-pre">${t}</div>
          <div class="ib-meter" style="margin-top:6px;"><span style="width:${Math.min(100, (px/600)*100)}%"></span></div>
          <div class="ib-actions"><button class="ibtn ibtn-accent">Copy</button></div>
        `;
        div.querySelector('button').addEventListener('click', ()=>{ navigator.clipboard.writeText(t); div.querySelector('button').textContent='Copied'; setTimeout(()=>div.querySelector('button').textContent='Copy',800);});
        wrap.appendChild(div);
      });
    });

    $('#ib-gen-descriptions').addEventListener('click', () => {
      const ideas = genDescIdeas(elKw.value.trim() || 'SEO', elBrand.value.trim());
      const wrap = $('#ib-desc-suggestions'); wrap.innerHTML='';
      const font = getComputedStyle(document.body).font;
      ideas.forEach(d=>{
        const px = measurePx(d, font);
        const div = document.createElement('div');
        div.className = 'ib-suggestion';
        div.innerHTML = `
          <div class="ib-small ib-muted">Chars: ${d.length} • Pixels: ${Math.round(px)} px</div>
          <div class="ib-pre">${d}</div>
          <div class="ib-meter" style="margin-top:6px;"><span style="width:${Math.min(100, (px/920)*100)}%"></span></div>
          <div class="ib-actions"><button class="ibtn ibtn-accent">Copy</button></div>
        `;
        div.querySelector('button').addEventListener('click', ()=>{ navigator.clipboard.writeText(d); div.querySelector('button').textContent='Copied'; setTimeout(()=>div.querySelector('button').textContent='Copy',800);});
        wrap.appendChild(div);
      });
    });

    $('#ib-copy-best-title').addEventListener('click', () => {
      // Choose shortest within 540–580 px or the shortest overall
      const list = $$('#ib-title-suggestions .ib-pre').map(n => n.textContent);
      const font = getComputedStyle(document.body).font;
      if (!list.length) return alert('Generate titles first.');
      const filtered = list.map(t=>({t,px:measurePx(t,font)})).sort((a,b)=>a.px-b.px);
      const best = filtered.find(x=>x.px>=440 && x.px<=580) || filtered[0];
      navigator.clipboard.writeText(best.t);
      alert('Best-fit title copied.');
    });

    $('#ib-copy-best-desc').addEventListener('click', () => {
      const list = $$('#ib-desc-suggestions .ib-pre').map(n => n.textContent);
      if (!list.length) return alert('Generate descriptions first.');
      // Prefer ~150–160 chars
      const within = list.filter(s => s.length>=140 && s.length<=165);
      navigator.clipboard.writeText((within[0] || list[0]));
      alert('Best-fit description copied.');
    });

    $('#ib-gen-slug').addEventListener('click', () => {
      const source = $('#ib-slug-source').value.trim() || ($('#ib-title-text').textContent.trim());
      if (!source) return alert('Enter a title or phrase first.');
      const s = slugify(source);
      $('#ib-slug-output').textContent = s;
    });

    $('#ib-copy-slug').addEventListener('click', () => {
      const s = $('#ib-slug-output').textContent.trim();
      if (!s) return alert('Generate a slug first.');
      navigator.clipboard.writeText(s);
      alert('Slug copied.');
    });

    $('#ib-copy-report').addEventListener('click', () => {
      if (!window._ib_lastAnalysis) return alert('Run an analysis first.');
      navigator.clipboard.writeText(JSON.stringify(window._ib_lastAnalysis, null, 2));
      alert('Report JSON copied.');
    });

    $('#ib-download-report').addEventListener('click', () => {
      if (!window._ib_lastAnalysis) return alert('Run an analysis first.');
      const blob = new Blob([JSON.stringify(window._ib_lastAnalysis, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'seo-meta-report.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // Init
  bindUI();
})();
