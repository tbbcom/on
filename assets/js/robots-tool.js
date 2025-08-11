(() => {
  'use strict';

  const $ = (s,sc=document)=>sc.querySelector(s);
  const $$ = (s,sc=document)=>Array.from(sc.querySelectorAll(s));

  const state = {
    sitemaps: [],
    records: [], // {id, agent, disallow[], allow[], delay}
  };

  const el = (tag, attrs={}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v, {passive:true});
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return n;
  };

  // DOM refs
  const form = $('#rtx-form');
  const protocolEl = $('#rtx-protocol');
  const domainEl = $('#rtx-domain');
  const hostEl = $('#rtx-host');
  const cleanParamEl = $('#rtx-cleanparam');
  const addDefaultSitemapsEl = $('#rtx-add-default-sitemaps');
  const sitemapInput = $('#rtx-sitemap-input');
  const addSitemapBtn = $('#rtx-add-sitemap');
  const sitemapList = $('#rtx-sitemap-list');

  const templateEl = $('#rtx-template');
  const recordsEl = $('#rtx-records');
  const addRecordBtn = $('#rtx-add-record');

  const includeCommentsEl = $('#rtx-comments');
  const includeNoindexEl = $('#rtx-noindex');

  const generateBtn = $('#rtx-generate');
  const copyBtn = $('#rtx-copy');
  const downloadBtn = $('#rtx-download');
  const outputEl = $('#rtx-output');
  const warnEl = $('#rtx-warnings');

  // Helpers
  const uid = () => Math.random().toString(36).slice(2,9);
  const sanitizePath = s => {
    s = (s||'').trim();
    if (!s) return '';
    // Allow wildcard and $; if path starts with http, treat as comment suggestion
    if (s.startsWith('http')) return s;
    if (!s.startsWith('/')) s = '/' + s;
    return s.replace(/\s+/g,' ');
  };
  const multilineToList = (val) =>
    (val||'').split('\n').map(v=>v.trim()).filter(v=>v && !v.startsWith('#'));

  const absoluteUrl = (proto, domain, path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (!domain) return path;
    const p = path.startsWith('/') ? path : '/' + path;
    return `${proto}://${domain}${p}`;
  };

  // Sitemaps
  const renderSitemaps = () => {
    sitemapList.innerHTML = '';
    state.sitemaps.forEach((u, idx) => {
      const li = el('li',{}, el('span',{}, u),
        el('button',{class:'icon', onclick:()=>{ state.sitemaps.splice(idx,1); renderSitemaps(); }}, '✕'));
      sitemapList.appendChild(li);
    });
  };
  const addSitemap = (url) => {
    url = (url||'').trim();
    if (!url) return;
    try {
      // rudimentary validation
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error('Bad protocol');
      if (!state.sitemaps.includes(url)) state.sitemaps.push(url);
      renderSitemaps();
    } catch {
      // ignore invalid url
      toast('Invalid sitemap URL');
    }
  };

  // Records
  const recordTemplate = (rec) => {
    const wrap = el('div', {class:'record', 'data-id':rec.id});
    const head = el('div', {class:'record-head'},
      el('div', {class:'record-title'}, 'User-agent'),
      el('div', {},
        el('button', {type:'button', class:'btn icon', onclick:()=>duplicateRecord(rec.id)}, '⎘'),
        el('button', {type:'button', class:'btn icon', onclick:()=>removeRecord(rec.id)}, '🗑️')
      )
    );
    const agent = el('input', {type:'text', value:rec.agent||'*', 'aria-label':'User-agent'});
    agent.addEventListener('input', ()=>{ rec.agent = agent.value.trim() || '*'; });

    const gridTop = el('div', {class:'grid g2'},
      el('label',{}, 'User-agent',
        agent
      ),
      el('label',{}, 'Crawl-delay (optional; Google ignores)',
        el('input',{type:'number', min:'0', step:'1', value: rec.delay ?? '', 'aria-label':'Crawl delay',
          oninput:(e)=>{ const v = e.target.value; rec.delay = v===''? null : Math.max(0, parseInt(v,10)||0); }
        })
      )
    );

    const disallow = el('textarea', {placeholder:'One path per line, e.g.\n/search\n/private/*\n/*.pdf$', 'aria-label':'Disallow'});
    disallow.value = (rec.disallow || []).join('\n');
    disallow.addEventListener('input', ()=>{ rec.disallow = multilineToList(disallow.value).map(sanitizePath); });

    const allow = el('textarea', {placeholder:'One path per line to allow exceptions\n/search/label/\n/assets/*.css', 'aria-label':'Allow'});
    allow.value = (rec.allow || []).join('\n');
    allow.addEventListener('input', ()=>{ rec.allow = multilineToList(allow.value).map(sanitizePath); });

    const grid = el('div', {class:'grid g2'},
      el('label', {}, 'Disallow', disallow),
      el('label', {}, 'Allow', allow)
    );

    wrap.append(head, gridTop, grid);
    return wrap;
  };

  const addRecord = (init={ agent:'*', disallow:[], allow:[], delay:null }) => {
    const rec = { id: uid(), ...init };
    state.records.push(rec);
    recordsEl.appendChild(recordTemplate(rec));
  };

  const removeRecord = (id) => {
    const idx = state.records.findIndex(r=>r.id===id);
    if (idx>=0) {
      state.records.splice(idx,1);
      const node = recordsEl.querySelector(`.record[data-id="${id}"]`);
      if (node) node.remove();
    }
  };

  const duplicateRecord = (id) => {
    const rec = state.records.find(r=>r.id===id);
    if (!rec) return;
    addRecord({ agent: rec.agent, disallow: [...(rec.disallow||[])], allow:[...(rec.allow||[])], delay: rec.delay });
  };

  // Templates
  const applyTemplate = (name) => {
    // Reset records
    state.records = [];
    recordsEl.innerHTML = '';
    if (name === 'blogger') {
      addRecord({
        agent:'*',
        disallow:['/search'],
        allow:['/search/label/'],
        delay:null
      });
      ensureDefaultSitemaps();
    } else if (name === 'block-ai') {
        const bots = [
          'GPTBot','CCBot','PerplexityBot','ClaudeBot','Claude-Web',
          'Google-Extended','Applebot-Extended','Bytespider'
        ];
        addRecord({agent:'*', disallow:[], allow:[], delay:null});
        bots.forEach(b => addRecord({agent:b, disallow:['/'], allow:[], delay:null}));
        ensureDefaultSitemaps();
    } else if (name === 'strict') {
        addRecord({agent:'*', disallow:['/'], allow:[], delay:null});
    } else {
      // default empty
      addRecord({agent:'*', disallow:[], allow:[], delay:null});
    }
  };

  const ensureDefaultSitemaps = () => {
    if (!addDefaultSitemapsEl.checked) return;
    const d = (domainEl.value || '').trim();
    if (!d) return;
    const proto = protocolEl.value;
    const s1 = absoluteUrl(proto, d, '/sitemap.xml');
    const s2 = absoluteUrl(proto, d, '/sitemap-pages.xml');
    if (s1 && !state.sitemaps.includes(s1)) state.sitemaps.push(s1);
    if (s2 && !state.sitemaps.includes(s2)) state.sitemaps.push(s2);
    renderSitemaps();
  };

  // Generate
  const generate = () => {
    warnEl.textContent = '';
    const proto = protocolEl.value || 'https';
    const domain = (domainEl.value||'').trim();
    const includeComments = !!includeCommentsEl.checked;
    const includeNoindex = !!includeNoindexEl.checked;
    const host = (hostEl.value||'').trim();
    const cleanparam = (cleanParamEl.value||'').trim();

    // Validate
    const warnings = [];
    if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(domain)) warnings.push('Domain looks unusual. Example: thebukitbesi.com');
    if (!state.records.length) warnings.push('Add at least one user-agent record.');
    state.records.forEach((r,i)=>{
      if (!r.agent) warnings.push(`Record ${i+1}: empty user-agent; defaulting to *`);
      (r.disallow||[]).forEach(p => { if (/\s/.test(p.trim())) warnings.push(`Record ${i+1} Disallow has spaces: "${p}"`); });
      (r.allow||[]).forEach(p => { if (/\s/.test(p.trim())) warnings.push(`Record ${i+1} Allow has spaces: "${p}"`); });
    });

    // Build
    const lines = [];
    if (includeComments) {
      lines.push(`# robots.txt generated by thebukitbesi.com — ${new Date().toISOString()}`,
                 `# Learn more: https://developers.google.com/search/docs/crawling-indexing/robots/intro`);
    }

    state.records.forEach((r, idx) => {
      const agent = (r.agent && r.agent.trim()) || '*';
      lines.push(`User-agent: ${agent}`);
      (r.disallow||[]).forEach(p => lines.push(`Disallow: ${p}`));
      (r.allow||[]).forEach(p => lines.push(`Allow: ${p}`));
      if (typeof r.delay === 'number' && r.delay >= 0) lines.push(`Crawl-delay: ${r.delay}`);
      if (includeNoindex && (r.disallow||[]).length) {
        if (includeComments) lines.push(`# Note: Noindex is deprecated and ignored by Google`);
        (r.disallow||[]).forEach(p => lines.push(`Noindex: ${p}`));
      }
      if (idx !== state.records.length - 1) lines.push('');
    });

    // Global directives (Sitemap, Host, Clean-param)
    const sitemaps = state.sitemaps.length ? state.sitemaps : (addDefaultSitemapsEl.checked && domain ? [
      absoluteUrl(proto, domain, '/sitemap.xml'),
      absoluteUrl(proto, domain, '/sitemap-pages.xml')
    ].filter(Boolean) : []);
    if (lines.length && (sitemaps.length || host || cleanparam)) lines.push('');
    sitemaps.forEach(u => lines.push(`Sitemap: ${u}`));
    if (host) lines.push(`Host: ${host}`);
    if (cleanparam) lines.push(`Clean-param: ${cleanparam}`);

    outputEl.textContent = lines.join('\n');
    if (warnings.length) warnEl.textContent = 'Warnings: ' + warnings.join(' • ');
  };

  const copyOut = async () => {
    const txt = outputEl.textContent.trim();
    if (!txt) { toast('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(txt);
      toast('Copied to clipboard');
    } catch {
      toast('Copy failed');
    }
  };

  const downloadOut = () => {
    const txt = outputEl.textContent.trim();
    if (!txt) { toast('Generate first'); return; }
    const blob = new Blob([txt], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'robots.txt';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  };

  let toastTimer;
  const toast = (msg) => {
    warnEl.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ warnEl.textContent=''; }, 4000);
  };

  // Events
  addRecordBtn.addEventListener('click', ()=> addRecord({agent:'*', disallow:[], allow:[], delay:null}));
  templateEl.addEventListener('change', (e)=> applyTemplate(e.target.value));
  addSitemapBtn.addEventListener('click', ()=> addSitemap(sitemapInput.value));
  sitemapInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') { e.preventDefault(); addSitemap(sitemapInput.value); } });
  addDefaultSitemapsEl.addEventListener('change', ()=> {
    if (addDefaultSitemapsEl.checked) ensureDefaultSitemaps();
  });

  generateBtn.addEventListener('click', generate);
  copyBtn.addEventListener('click', copyOut);
  downloadBtn.addEventListener('click', downloadOut);

  // Init
  applyTemplate('blogger'); // sensible default for Blogger
  generate(); // initial preview
})();
