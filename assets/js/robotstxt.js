(() => {
  // Utilities
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const output = $('#rtg-output');
  const warningsEl = $('#warnings');
  const LS_KEY = 'robots_tool_v2';

  // Default bad bots (toggle)
  const BAD_BOTS = ['AhrefsBot','SemrushBot','MJ12bot','DotBot','BLEXBot','SEOkicks','PetalBot','Bytespider'];

  // Group factory
  let groupSeq = 0;
  function createGroup({ua='*', allow=['/'], disallow=[], delay=''} = {}, removable = false){
    const id = 'ua_'+(++groupSeq);
    const div = document.createElement('div');
    div.className = 'ua';
    div.dataset.id = id;
    div.innerHTML = `
      <div class="ua-h">
        <strong>User-agent group</strong>
        ${removable ? '<buttonts type="buttonts" class="btns btns-muted remove-group" title="Remove this group">Remove</buttonts>' : ''}
      </div>
      <div class="row">
        <div>
          <label>User-agent</label>
          <input type="text" class="ua-name" placeholder="e.g., Googlebot" value="${escapeHtml(ua)}">
        </div>
        <div>
          <label>Crawl-delay (seconds, optional)</label>
          <input type="number" min="0" step="1" class="ua-delay" value="${escapeHtml(delay)}">
          <p class="help">Ignored by Google. Used by Bing/Yandex.</p>
        </div>
      </div>
      <div class="row">
        <div>
          <label>Disallow (one per line)</label>
          <textarea class="ua-disallow" placeholder="/search">${escapeHtml(linesToText(disallow))}</textarea>
        </div>
        <div>
          <label>Allow (one per line)</label>
          <textarea class="ua-allow" placeholder="/">${escapeHtml(linesToText(allow))}</textarea>
        </div>
      </div>
    `;
    $('#groups').appendChild(div);
  }

  function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function linesToText(arr){return (arr||[]).join('\n');}
  function textToLines(t){return (t||'').split('\n').map(s=>s.trim()).filter(Boolean);}

  // Presets
  function applyPresetBlogger(){
    const siteUrl = $('#siteUrl').value.trim();
    $('#groups').innerHTML = '';
    createGroup({ua:'*', allow:['/'], disallow:['/search']}, false);
    $('#includeComments').checked = true;
    // Sitemaps
    if(siteUrl){
      const u = sanitizeOrigin(siteUrl);
      $('#sitemaps').value = u + '/sitemap.xml';
      $('#host').value = new URL(u).host;
    }else{
      $('#sitemaps').value = '/sitemap.xml';
    }
    $('#blockMobileParam').checked = false;
  }
  function applyPresetOpen(){
    $('#groups').innerHTML = '';
    createGroup({ua:'*', allow:['/'], disallow:[]}, false);
    $('#includeComments').checked = true;
    $('#blockMobileParam').checked = false;
  }
  function applyPresetBlockAll(){
    $('#groups').innerHTML = '';
    createGroup({ua:'*', allow:[], disallow:['/']}, false);
    $('#includeComments').checked = true;
    $('#blockMobileParam').checked = false;
  }

  // Bad bots toggle: add/remove groups with Disallow: /
  function toggleBadBots(){
    const existing = new Set($$('.ua .ua-name').map(i => i.value.trim()));
    let added = 0, removed = 0;
    // If at least one BAD_BOT already present with Disallow: /, remove all; else add all.
    const present = BAD_BOTS.some(b => existing.has(b));
    if(present){
      $$('.ua').forEach(g => {
        const name = g.querySelector('.ua-name').value.trim();
        if(BAD_BOTS.includes(name)){
          g.remove();
          removed++;
        }
      });
      toast(`Removed ${removed} bad-bot groups`);
    }else{
      BAD_BOTS.forEach(b => {
        createGroup({ua:b, allow:[], disallow:['/']}, true);
        added++;
      });
      toast(`Added ${added} bad-bot groups`);
    }
  }

  function sanitizeOrigin(u){
    try{
      const url = new URL(u);
      return url.origin;
    }catch(e){
      return u.replace(/\/+$/,'');
    }
  }

  function normalizePath(p){
    // Convert full URL to path?query
    try{
      if(/^https?:/i.test(p)){
        const u = new URL(p);
        return (u.pathname || '/') + (u.search || '');
      }
    }catch(e){}
    // Ensure starts with / or wildcard
    if(p.startsWith('*') || p.startsWith('/')) return p;
    if(p.startsWith('$')) return p; // allow $ end anchor
    if(p.startsWith('#')) return p; // comment
    return '/' + p;
  }

  function gather(){
    // Gather form data
    const siteUrl = $('#siteUrl').value.trim();
    const host = $('#host').value.trim();
    const sitemaps = textToLines($('#sitemaps').value);
    const cleanParam = textToLines($('#cleanParam').value);
    const includeComments = $('#includeComments').checked;
    const blockMobileParam = $('#blockMobileParam').checked;

    const groups = $$('#groups .ua').map((g,i) => {
      const ua = g.querySelector('.ua-name').value.trim() || '*';
      const delay = g.querySelector('.ua-delay').value.trim();
      const disallow = textToLines(g.querySelector('.ua-disallow').value).map(normalizePath);
      const allow = textToLines(g.querySelector('.ua-allow').value).map(normalizePath);
      return {ua, delay, disallow, allow, removable: i>0};
    });

    return {siteUrl, host, sitemaps, cleanParam, includeComments, blockMobileParam, groups};
  }

  function validate(d){
    const warns = [];
    let ok = true;
    // Site URL
    if(!d.siteUrl){
      warns.push('Enter your Site URL (e.g., https://www.thebukitbesi.com).');
      ok = false;
    }else{
      try{ new URL(d.siteUrl); }catch(e){ warns.push('Site URL is not a valid URL.'); ok = false; }
    }
    // Check duplicate UA groups
    const uas = d.groups.map(g=>g.ua.toLowerCase());
    const dup = uas.filter((x,i,arr)=>arr.indexOf(x)!==i);
    if(dup.length){ warns.push('Duplicate user‑agent groups: '+Array.from(new Set(dup)).join(', ')); }
    // Warn about Crawl-delay for Google
    if(d.groups.some(g => g.delay)) warns.push('Note: Google ignores Crawl-delay.');
    // Clean-param/Host warnings
    if(d.cleanParam.length) warns.push('Note: Clean-param is Yandex-only.');
    if(d.host) warns.push('Note: Host is primarily used by Yandex.');
    // m=1
    if(d.blockMobileParam) warns.push('“Disallow: /*?m=1” may be ignored by Google but other bots may respect it.');
    // Bad patterns: Noindex in robots.txt
    d.groups.forEach(g => {
      [...g.allow, ...g.disallow].forEach(line => {
        if(/noindex/i.test(line)) warns.push('Remove "noindex" from robots.txt. Use meta robots or X‑Robots‑Tag instead.');
      });
    });
    warningsEl.innerHTML = warns.length ? warns.map(w => '• '+w).join('<br>') : '';
    return ok;
  }

  function buildRobots(d){
    const lines = [];
    const now = new Date().toISOString().replace('T',' ').replace(/\..+/, '');
    const origin = sanitizeOrigin(d.siteUrl);

    if(d.includeComments){
      lines.push(`# robots.txt generated by Advanced Robots.txt Generator — ${now}`);
      lines.push(`# Site: ${origin}`);
    }

    // Special option
    const mobileDisallow = d.blockMobileParam ? ['/*?m=1'] : [];

    d.groups.forEach((g, idx) => {
      if(idx>0) lines.push(''); // blank line between groups
      lines.push(`User-agent: ${g.ua}`);
      (g.disallow.concat(mobileDisallow)).forEach(p => lines.push(`Disallow: ${normalizePath(p)}`));
      g.allow.forEach(p => lines.push(`Allow: ${normalizePath(p)}`));
      if(g.delay) lines.push(`Crawl-delay: ${g.delay}`);
    });

    // Sitemaps (absolute URLs recommended)
    const siteSm = d.sitemaps.length ? d.sitemaps : [];
    const smaps = siteSm.map(s => {
      // If starts with http(s), keep; else prepend origin
      if(/^https?:/i.test(s)) return s;
      if(s.startsWith('/')) return origin + s;
      return origin + '/' + s.replace(/^\/+/,'');
    });
    if(smaps.length){
      lines.push('');
      smaps.forEach(s => lines.push(`Sitemap: ${s}`));
    }

    // Host
    if(d.host){
      lines.push(`Host: ${d.host}`);
    }

    // Clean-param
    if(d.cleanParam.length){
      d.cleanParam.forEach(cp => lines.push(`Clean-param: ${cp}`));
    }

    if(d.includeComments){
      lines.push('');
      lines.push('# Notes:');
      lines.push('# - Google ignores Crawl-delay and Clean-param.');
      lines.push('# - robots.txt controls crawling, not indexing.');
    }

    return lines.join('\n');
  }

  function generate(){
    const d = gather();
    if(!validate(d)){
      output.textContent = 'Please resolve the warnings above, then click Generate.';
      return;
    }
    const txt = buildRobots(d);
    output.textContent = txt;
    saveState(d);
  }

  function copy(){
    const txt = output.textContent || '';
    if(!txt.trim()){ alert('Nothing to copy. Click Generate first.'); return; }
    if(!navigator.clipboard){ toast('Clipboard API not supported.'); return; }
    navigator.clipboard.writeText(txt)
      .then(()=>toast('Copied to clipboard ✅'))
      .catch(()=>toast('Failed to copy to clipboard ❌'));
  }

  function download(){
    const txt = output.textContent || '';
    if(!txt.trim()){ alert('Nothing to download. Click Generate first.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'}));
    a.download = 'robots.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function resetAll(){
    localStorage.removeItem(LS_KEY);
    $('#siteUrl').value = '';
    $('#host').value = '';
    $('#sitemaps').value = '';
    $('#cleanParam').value = '';
    $('#includeComments').checked = true;
    $('#blockMobileParam').checked = false;
    $('#groups').innerHTML = '';
    createGroup({ua:'*', allow:['/'], disallow:[]}, false);
    output.textContent = 'Enter your site URL and click Generate…';
    warningsEl.innerHTML = '';
  }

  function toast(msg){
    warningsEl.innerHTML = '<span class="success">'+escapeHtml(msg)+'</span>';
    setTimeout(()=>{ if(warningsEl.innerHTML.includes(msg)) warningsEl.innerHTML=''; }, 2500);
  }

  // Local storage
  function saveState(d){
    if(!$('#autosave').checked) return;
    try{ localStorage.setItem(LS_KEY, JSON.stringify(d)); }catch(e){}
  }
  function loadState(){
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){
      // First run defaults
      createGroup({ua:'*', allow:['/'], disallow:[]}, false);
      return;
    }
    try{
      const d = JSON.parse(raw);
      $('#siteUrl').value = d.siteUrl || '';
      $('#host').value = d.host || '';
      $('#sitemaps').value = linesToText(d.sitemaps || []);
      $('#cleanParam').value = linesToText(d.cleanParam || []);
      $('#includeComments').checked = !!d.includeComments;
      $('#blockMobileParam').checked = !!d.blockMobileParam;
      $('#groups').innerHTML = '';
      (d.groups || [{ua:'*',allow:['/'],disallow:[]}]).forEach((g,i) => {
        createGroup(g, i>0);
      });
      if(d.siteUrl && !$('#sitemaps').value.trim()){
        $('#sitemaps').value = sanitizeOrigin(d.siteUrl) + '/sitemap.xml';
      }
    }catch(e){
      createGroup({ua:'*', allow:['/'], disallow:[]}, false);
    }
  }

  // Events
  $('#presetBlogger').addEventListener('click', applyPresetBlogger);
  $('#presetOpen').addEventListener('click', applyPresetOpen);
  $('#presetBlockAll').addEventListener('click', applyPresetBlockAll);
  $('#toggleBadBots').addEventListener('click', toggleBadBots);
  $('#addGroup').addEventListener('click', () => createGroup({ua:'Googlebot', allow:['/'], disallow:[]}, true));
  $('#generatebtns').addEventListener('click', generate);
  $('#copybtns').addEventListener('click', copy);
  $('#downloadbtns').addEventListener('click', download);
  $('#resetbtns').addEventListener('click', resetAll);
  $('#autosave').addEventListener('change', () => { if(!$('#autosave').checked) localStorage.removeItem(LS_KEY); });

  // Remove group (event delegation)
  $('#groups').addEventListener('click', (e) => {
    if(e.target.matches('.remove-group')){
      const wrap = e.target.closest('.ua');
      if(wrap) wrap.remove();
    }
  });

  // Autofill sitemap when siteUrl changes
  $('#siteUrl').addEventListener('change', () => {
    const u = $('#siteUrl').value.trim();
    if(!u) return;
    const origin = sanitizeOrigin(u);
    if(!$('#sitemaps').value.trim()){
      $('#sitemaps').value = origin + '/sitemap.xml';
    }
    if(!$('#host').value.trim()){
      try{ $('#host').value = new URL(origin).host; }catch(e){}
    }
  });

  // Init
  loadState();
})();
