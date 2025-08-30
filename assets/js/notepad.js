(() => {
  'use strict';

  /* ===== Layer 0: Domain Lock (inline, Blogger-safe) ===== */
  const DOMAIN_LOCK = true;
  if (DOMAIN_LOCK) {
    const ALLOWED = new Set(["thebukitbesi.com","www.thebukitbesi.com","www.blogger.com","localhost","127.0.0.1"]);
    const host = (location.hostname||"").toLowerCase();
    if (!ALLOWED.has(host)) {
      document.addEventListener("DOMContentLoaded", () => {
        const m = document.createElement("div");
        m.style.cssText = "font:600 16px system-ui;padding:24px;border:1px solid #eee;border-radius:12px;margin:16px;background:#fff";
        m.textContent = "This tool is licensed only for thebukitbesi.com";
        document.body.innerHTML = ""; document.body.appendChild(m);
      });
      throw new Error("Host not allowed");
    }
  }

  /* ===== App ===== */
  const $ = (s, el=document) => el.querySelector(s);
  const app = $('#ib-notepad-app'); if (!app) return;

  const ta = $('#ib-text', app);
  const wordsEl = $('#ib-words', app);
  const charsEl = $('#ib-chars', app);
  const readEl  = $('#ib-read', app);
  const savedEl = $('#ib-saved', app);
  const snapsSel= $('#ib-snaps', app);
  const mdView  = $('#ib-md', app);

  const qInput = $('#ib-q', app);
  const rInput = $('#ib-r', app);
  const btnFindNext = $('#ib-find-next', app);
  const btnReplaceNext = $('#ib-replace-next', app);
  const btnReplaceAll = $('#ib-replace-all', app);
  const btnClearFind = $('#ib-clear-find', app);

  const keySuffix = new URLSearchParams(location.search).get('key') || location.pathname || 'default';
  const STORE_KEY = `ibNotepad::${keySuffix}`;
  const SNAP_KEY  = `ibNotepadSnaps::${keySuffix}`;
  const SNAP_LIMIT = 20;

  const fmt = new Intl.NumberFormat(undefined);
  const nowISO = () => new Date().toISOString();
  const niceTime = (d) => new Date(d).toLocaleString();
  const dash = '\u2014'; // em dash (prevents Blogger from showing &#8212;)
  const setSaved = (d=null) => { savedEl.textContent = `Last saved ${dash} ${d ? niceTime(d) : 'never'}`; };

  const getData = () => JSON.parse(localStorage.getItem(STORE_KEY) || '{"content":""}');
  const setData = (obj) => localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  const getSnaps = () => JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
  const setSnaps = (arr) => localStorage.setItem(SNAP_KEY, JSON.stringify(arr.slice(0, SNAP_LIMIT)));

  const debounce = (fn, ms=600) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(() => fn(...a), ms); }; };
  const countWords = (s) => (s.trim().match(/\S+/g)||[]).length;

  const updateStats = () => {
    const v = ta.value;
    const w = countWords(v);
    const c = v.length;
    const r = Math.max(0, Math.ceil(w / 220));
    wordsEl.textContent = `Words: ${fmt.format(w)}`;
    charsEl.textContent = `Chars: ${fmt.format(c)}`;
    readEl.textContent  = `Read: ${fmt.format(r)} min`;
    if (!mdView.hidden) renderMarkdown();
  };

  const save = () => { setData({ content: ta.value, ts: nowISO() }); setSaved(new Date()); };
  const autoSave = debounce(save, 800);

  const renderSnaps = () => {
    const snaps = getSnaps();
    snapsSel.innerHTML = '<option value="">Snapshots…</option>' + snaps
      .map(s => `<option value="${s.id}">${new Date(s.ts).toLocaleString()}</option>`).join('');
  };

  const createSnapshot = () => {
    const snaps = getSnaps();
    snaps.unshift({ id: Date.now().toString(36), ts: nowISO(), content: ta.value });
    setSnaps(snaps); renderSnaps();
  };

  const download = (ext='txt') => {
    const name = `note-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${ext}`;
    const blob = new Blob([ta.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const loadSnapshot = (id) => {
    const s = getSnaps().find(x => x.id === id);
    if (!s) return;
    if (confirm('Replace current content with this snapshot? A new snapshot will be created first.')) {
      createSnapshot(); ta.value = s.content; updateStats(); save();
    }
  };

  // === Find/Replace helpers ===
  const getSel = () => [ta.selectionStart, ta.selectionEnd];
  const setSel = (s, e) => { ta.focus(); ta.setSelectionRange(s, e); };

  const indexOfNext = (needle, from) => {
    if (!needle) return -1;
    const v = ta.value;
    const start = Math.max(from, 0);
    const i = v.indexOf(needle, start);
    if (i >= 0) return i;
    return v.indexOf(needle, 0); // wrap
  };

  btnFindNext.addEventListener('click', () => {
    const q = qInput.value; if (!q) return;
    const [, end] = getSel();
    const i = indexOfNext(q, end);
    if (i >= 0) setSel(i, i + q.length);
  });

  btnReplaceNext.addEventListener('click', () => {
    const q = qInput.value; if (!q) return;
    const repl = rInput.value ?? '';
    let [s, e] = getSel();
    const v = ta.value;
    if (v.slice(s, e) !== q) {
      const i = indexOfNext(q, e);
      if (i < 0) return;
      s = i; e = i + q.length; setSel(s, e);
    }
    ta.setRangeText(repl, s, e, 'end');
    updateStats(); autoSave();
  });

  btnReplaceAll.addEventListener('click', () => {
    const q = qInput.value; if (!q) return;
    const repl = rInput.value ?? '';
    const v = ta.value;
    const n = (v.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g'))||[]).length;
    if (!n) return;
    ta.value = v.split(q).join(repl);
    updateStats(); autoSave();
    // place caret at end
    setSel(ta.value.length, ta.value.length);
  });

  btnClearFind.addEventListener('click', () => { qInput.value=''; rInput.value=''; ta.focus(); });

  // === Markdown preview (lightweight) ===
  function renderMarkdown(){
    const md = ta.value;
    const esc = (t)=>t.replace(/[&<>]/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;" }[m]));
    const lines = md.split(/\r?\n/);
    let out=[], inUL=false, inOL=false, inCode=false, code=[];
    const closeLists = () => {
      if (inUL){ out.push('</ul>'); inUL=false; }
      if (inOL){ out.push('</ol>'); inOL=false; }
    };
    for (let i=0;i<lines.length;i++){
      let line = lines[i];
      if (line.trim().startsWith('```')){
        if (inCode){ out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>'); code=[]; inCode=false; }
        else { closeLists(); inCode=true; }
        continue;
      }
      if (inCode){ code.push(line); continue; }

      // headings
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m){ closeLists(); const lvl=m[1].length; out.push(`<h${lvl}>${esc(m[2])}</h${lvl}>`); continue; }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)){
        if (!inOL){ closeLists(); out.push('<ol>'); inOL=true; }
        out.push('<li>'+esc(line.replace(/^\s*\d+\.\s+/,''))+'</li>'); continue;
      }
      // unordered list
      if (/^\s*[-*]\s+/.test(line)){
        if (!inUL){ closeLists(); out.push('<ul>'); inUL=true; }
        out.push('<li>'+esc(line.replace(/^\s*[-*]\s+/,''))+'</li>'); continue;
      }
      // blank line
      if (!line.trim()){ closeLists(); out.push(''); continue; }

      // inline: **bold**, *italic*, `code`, links [t](u)
      let html = esc(line)
        .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g,'<em>$1</em>')
        .replace(/`([^`]+?)`/g,'<code>$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" rel="nofollow noopener" target="_blank">$1</a>');
      out.push(`<p>${html}</p>`);
    }
    closeLists();
    mdView.innerHTML = out.join('\n');
  }

  // === Bindings ===
  $('#ib-new', app).addEventListener('click', () => {
    if (ta.value.trim() && !confirm('Clear the note? A snapshot will be created first.')) return;
    if (ta.value.trim()) createSnapshot();
    ta.value=''; updateStats(); save();
  });
  $('#ib-save', app).addEventListener('click', save);
  $('#ib-snapshot', app).addEventListener('click', createSnapshot);
  $('#ib-export-txt', app).addEventListener('click', () => download('txt'));
  $('#ib-export-md', app).addEventListener('click', () => download('md'));
  $('#ib-copy', app).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ta.value); savedEl.textContent = 'Copied to clipboard.'; }
    catch { savedEl.textContent = 'Copy failed.'; }
  });
  $('#ib-print', app).addEventListener('click', () => window.print());
  $('#ib-mono', app).addEventListener('click', (e) => {
    ta.classList.toggle('ib-mono');
    e.currentTarget.setAttribute('aria-pressed', ta.classList.contains('ib-mono'));
  });
  snapsSel.addEventListener('change', (e) => { if (e.target.value) loadSnapshot(e.target.value); });

  // Wrap toggle
  const wrapBtn = $('#ib-wrap', app);
  wrapBtn.addEventListener('click', (e) => {
    const nowOff = ta.getAttribute('wrap') === 'off';
    if (nowOff) { ta.setAttribute('wrap', 'soft'); e.currentTarget.textContent = 'Wrap: On'; }
    else { ta.setAttribute('wrap', 'off'); e.currentTarget.textContent = 'Wrap: Off'; }
    e.currentTarget.setAttribute('aria-pressed', String(nowOff));
  });

  // Date/Time
  $('#ib-insert-date', app).addEventListener('click', () => {
    const iso = new Date().toLocaleString();
    const [s,e] = [ta.selectionStart, ta.selectionEnd];
    ta.setRangeText(iso, s, e, 'end'); updateStats(); autoSave();
  });

  // Fullscreen
  const fullBtn = $('#ib-full', app);
  fullBtn.addEventListener('click', async () => {
    try {
      document.addEventListener('fullscreenchange', () => {
  const isFS = document.fullscreenElement === app;
  fullBtn.textContent = isFS ? 'Exit Fullscreen' : 'Fullscreen';

  // Force light theme in fullscreen for max readability on mobile
  if (isFS) app.setAttribute('data-theme','light');
  else app.removeAttribute('data-theme'); // fall back to system (or your site) preference
});

  // MD toggle
  const mdBtn = $('#ib-md-toggle', app);
  mdBtn.addEventListener('click', () => {
    mdView.hidden = !mdView.hidden;
    mdBtn.setAttribute('aria-pressed', String(!mdView.hidden));
    if (!mdView.hidden) renderMarkdown();
  });

  // Autosave + stats + live MD when visible
  ta.addEventListener('input', () => { updateStats(); autoSave(); });

  // Ctrl/Cmd+S
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  // Init
  const data = getData();
  if (data.content) ta.value = data.content;
  setSaved(data.ts ? new Date(data.ts) : null);
  updateStats(); renderSnaps();
})();
