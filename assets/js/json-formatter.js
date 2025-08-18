(function () {
  'use strict';

  const root = document.getElementById('tbb-json-tool');
  if (!root) return;

  // Elements
  const $ = (sel) => root.querySelector(sel);
  const input = $('#tbb-input');
  const tree = $('#tbb-tree');
  const errBox = $('#tbb-error');
  const stats = $('#tbb-stats');
  const live = $('#tbb-live');
  const tolerant = $('#tbb-tolerant');
  const autoFmt = $('#tbb-autofmt');
  const sortBtn = $('#tbb-sortkeys');
  const indentSel = $('#tbb-indent');
  const fileInput = $('#tbb-file');
  const shareOut = $('#tbb-shareout');

  const btn = {
    validate: $('#tbb-validate'),
    format: $('#tbb-format'),
    minify: $('#tbb-minify'),
    copy: $('#tbb-copy'),
    download: $('#tbb-download'),
    upload: $('#tbb-upload'),
    paste: $('#tbb-paste'),
    clear: $('#tbb-clear'),
    sample: $('#tbb-sample'),
    share: $('#tbb-share'),
  };

  // Utilities
  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  const b64EncodeUnicode = (str) =>
    btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) =>
        String.fromCharCode('0x' + p)
      )
    );

  const b64DecodeUnicode = (b64) =>
    decodeURIComponent(
      Array.from(atob(b64))
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );

  function stripComments(str) {
    // Remove // and /* */ comments outside of strings
    let out = '';
    let i = 0;
    let inStr = false;
    let strQuote = '';
    while (i < str.length) {
      const ch = str[i];
      const next = str[i + 1];

      if (!inStr && ch === '/' && next === '/') {
        // line comment
        i += 2;
        while (i < str.length && str[i] !== '\n') i++;
        continue;
      }
      if (!inStr && ch === '/' && next === '*') {
        // block comment
        i += 2;
        while (i < str.length && !(str[i] === '*' && str[i + 1] === '/')) i++;
        i += 2;
        continue;
      }

      if (!inStr && (ch === '"' || ch === "'")) {
        inStr = true;
        strQuote = ch;
        out += ch;
        i++;
        continue;
      }

      if (inStr) {
        out += ch;
        if (ch === '\\') {
          // escape next char
          if (i + 1 < str.length) {
            out += str[i + 1];
            i += 2;
            continue;
          }
        } else if (ch === strQuote) {
          inStr = false;
          strQuote = '';
        }
        i++;
        continue;
      }

      out += ch;
      i++;
    }
    return out;
  }

  function removeTrailingCommas(str) {
    // Remove trailing commas before } or ] outside of strings
    let out = '';
    let i = 0;
    let inStr = false;
    let quote = '';
    while (i < str.length) {
      const ch = str[i];

      if (!inStr && (ch === '"' || ch === "'")) {
        inStr = true;
        quote = ch;
        out += ch;
        i++;
        continue;
      }
      if (inStr) {
        out += ch;
        if (ch === '\\') {
          if (i + 1 < str.length) {
            out += str[i + 1];
            i += 2;
            continue;
          }
        } else if (ch === quote) {
          inStr = false;
          quote = '';
        }
        i++;
        continue;
      }

      if (ch === ',') {
        // lookahead for next non-space char
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) j++;
        if (j < str.length && (str[j] === '}' || str[j] === ']')) {
          // skip the comma
          i++;
          continue;
        }
      }

      out += ch;
      i++;
    }
    return out;
  }

  function sanitize(raw) {
    let s = raw;
    s = stripComments(s);
    s = removeTrailingCommas(s);
    return s;
  }

  function tryParse(raw, useTolerant) {
    const text = useTolerant ? sanitize(raw) : raw;
    const t0 = performance.now();
    try {
      const obj = JSON.parse(text);
      const ms = Math.max(0, performance.now() - t0);
      return { ok: true, obj, ms, text };
    } catch (e) {
      const ms = Math.max(0, performance.now() - t0);
      const info = parseErrorInfo(e, text);
      return { ok: false, error: e, ms, info };
    }
  }

  function parseErrorInfo(e, text) {
    let pos = null, line = null, col = null;
    let msg = String(e && e.message ? e.message : e);
    // Chrome/Edge: "Unexpected token ... in JSON at position 10"
    const m1 = msg.match(/position\s+(\d+)/i);
    // Firefox: "JSON.parse: ... at line 3 column 15 of the JSON data"
    const m2 = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);

    if (m2) {
      line = parseInt(m2[1], 10);
      col = parseInt(m2[2], 10);
      pos = positionFromLineCol(text, line, col);
    } else if (m1) {
      pos = parseInt(m1[1], 10);
      const lc = lineColFromPosition(text, pos);
      line = lc.line;
      col = lc.col;
    }
    return { msg, pos, line, col };
  }

  function lineColFromPosition(text, pos) {
    pos = Math.min(Math.max(pos, 0), text.length);
    let line = 1, col = 1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '\n') { line++; col = 1; }
      else { col++; }
    }
    return { line, col };
  }

  function positionFromLineCol(text, line, col) {
    line = Math.max(line, 1);
    col = Math.max(col, 1);
    let curLine = 1;
    let i = 0;
    while (i < text.length && curLine < line) {
      if (text[i] === '\n') curLine++;
      i++;
    }
    return Math.min(i + col - 1, text.length);
  }

  function detectIndent(str) {
    // Simple guess: check first indented line
    const lines = str.split(/\r?\n/);
    for (const ln of lines) {
      const m = ln.match(/^(\s+)\S/);
      if (m) return m[1].includes('\t') ? '\t' : ' '.repeat(Math.min(m[1].length, 8));
    }
    return '  '; // default 2 spaces
  }

  function deepSort(obj) {
    if (Array.isArray(obj)) return obj.map(deepSort);
    if (obj && typeof obj === 'object') {
      const out = {};
      Object.keys(obj).sort((a, b) => a.localeCompare(b)).forEach(k => {
        out[k] = deepSort(obj[k]);
      });
      return out;
    }
    return obj;
  }

  function makeTree(value, keyPath = '$', keyName = null) {
    // Build a tree using <details>/<summary> for accessibility
    const node = document.createElement('div');
    node.className = 'tbb-kv';

    const label = document.createElement('span');
    label.className = 'tbb-key';
    label.textContent = keyName !== null ? keyName + ': ' : '';
    label.title = keyPath;

    if (Array.isArray(value)) {
      const d = document.createElement('details');
      d.open = keyPath === '$'; // open root
      const s = document.createElement('summary');
      s.appendChild(label.cloneNode(true));
      const info = document.createElement('span');
      info.textContent = `Array(${value.length})`;
      info.style.color = 'var(--tbb-muted)';
      s.appendChild(info);
      d.appendChild(s);

      value.forEach((v, idx) => {
        d.appendChild(makeTree(v, keyPath + '[' + idx + ']', String(idx)));
      });
      return d;
    } else if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      const d = document.createElement('details');
      d.open = keyPath === '$';
      const s = document.createElement('summary');
      s.appendChild(label.cloneNode(true));
      const info = document.createElement('span');
      info.textContent = `Object(${keys.length})`;
      info.style.color = 'var(--tbb-muted)';
      s.appendChild(info);
      d.appendChild(s);

      keys.forEach((k) => {
        d.appendChild(makeTree(value[k], keyPath + '.' + k, k));
      });
      return d;
    } else {
      const wrap = document.createElement('span');
      let cls = 'tbb-type-';
      let text = '';
      if (typeof value === 'string') { cls += 'string'; text = JSON.stringify(value); }
      else if (typeof value === 'number') { cls += 'number'; text = String(value); }
      else if (typeof value === 'boolean') { cls += 'boolean'; text = String(value); }
      else if (value === null) { cls += 'null'; text = 'null'; }
      else { text = String(value); }

      const v = document.createElement('span');
      v.className = cls;
      v.textContent = text;

      const line = document.createElement('div');
      line.appendChild(label);
      line.appendChild(v);
      node.appendChild(line);
      return node;
    }
  }

  function updateTree(obj) {
    tree.innerHTML = '';
    if (obj === undefined) {
      tree.setAttribute('data-empty', 'Waiting for valid JSON…');
      return;
    }
    tree.removeAttribute('data-empty');
    tree.appendChild(makeTree(obj));
  }

  function updateStats(raw, parseMs, valid) {
    const lines = raw.split(/\r?\n/).length;
    const chars = raw.length;
    const bytes = new Blob([raw]).size;
    const prettyBytes = (n) => {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / (1024 * 1024)).toFixed(2) + ' MB';
    };
    stats.textContent =
      `Lines: ${lines} · Chars: ${chars} · Size: ${prettyBytes(bytes)} · Parse: ${parseMs.toFixed(1)} ms` +
      (valid ? ' · ✓ valid' : '');
    stats.style.color = valid ? 'var(--tbb-muted)' : 'var(--tbb-muted)';
  }

  function showError(info) {
    if (!info) { errBox.textContent = ''; return; }
    const { msg, pos, line, col } = info;
    const parts = [];
    if (line != null && col != null) parts.push(`Line ${line}, Col ${col}`);
    if (pos != null) parts.push(`Pos ${pos}`);
    errBox.textContent = 'Error: ' + msg + (parts.length ? ` (${parts.join(', ')})` : '');
    // Move caret/select at error if possible
    if (pos != null) {
      try {
        input.focus();
        input.setSelectionRange(pos, Math.min(pos + 1, input.value.length));
      } catch {}
    }
  }

  function getIndent() {
    const sel = indentSel.value;
    if (sel === 'auto') return detectIndent(input.value);
    const n = parseInt(sel, 10);
    return Number.isFinite(n) ? ' '.repeat(n) : '  ';
    }

  function doValidate() {
    const raw = input.value;
    if (!raw.trim()) {
      errBox.textContent = '';
      updateStats(raw, 0, false);
      updateTree(undefined);
      return;
    }
    const res = tryParse(raw, tolerant.checked);
    if (res.ok) {
      errBox.textContent = '';
      updateStats(raw, res.ms, true);
      updateTree(res.obj);
      return res;
    } else {
      updateStats(raw, res.ms, false);
      updateTree(undefined);
      showError(res.info);
      return res;
    }
  }

  function doFormat(minify = false) {
    const raw = input.value;
    const res = tryParse(raw, tolerant.checked);
    if (!res.ok) {
      showError(res.info);
      return;
    }
    let obj = res.obj;
    const sortOn = sortBtn.getAttribute('aria-pressed') === 'true';
    if (sortOn) obj = deepSort(obj);

    const indent = minify ? 0 : getIndent();
    const pretty = JSON.stringify(obj, null, indent);
    input.value = pretty;
    errBox.textContent = '';
    updateStats(pretty, res.ms, true);
    updateTree(obj);
  }

  // Event handlers
  btn.validate.addEventListener('click', doValidate);
  btn.format.addEventListener('click', () => doFormat(false));
  btn.minify.addEventListener('click', () => doFormat(true));

  sortBtn.addEventListener('click', () => {
    const pressed = sortBtn.getAttribute('aria-pressed') === 'true';
    sortBtn.setAttribute('aria-pressed', String(!pressed));
    // Reformat current if valid
    const res = tryParse(input.value, tolerant.checked);
    if (res.ok) doFormat(false);
  });

  btn.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      toast('Copied to clipboard.');
    } catch (e) {
      toast('Copy failed: ' + e, true);
    }
  });

  btn.download.addEventListener('click', () => {
    const blob = new Blob([input.value], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btn.upload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result || '');
      if (live.checked) doValidate();
      if (autoFmt.checked) doFormat(false);
    };
    reader.readAsText(f);
    fileInput.value = '';
  });

  btn.paste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      input.value = text;
      if (live.checked) doValidate();
      if (autoFmt.checked) doFormat(false);
    } catch (e) {
      toast('Paste failed: ' + e, true);
    }
  });

  btn.clear.addEventListener('click', () => {
    input.value = '';
    errBox.textContent = '';
    stats.textContent = '';
    updateTree(undefined);
  });

  btn.sample.addEventListener('click', () => {
    const sample = `{
  // Example JSON with comments and trailing commas
  "title": "Sample",
  "version": 1,
  "active": true,
  "tags": ["dev", "json",],
  "items": [
    { "id": 1, "name": "Alpha" },
    { "id": 2, "name": "Beta" }
  ],
  "meta": {
    "createdAt": "2024-01-01T00:00:00Z",
    "contributors": 3,
  }
}`;
    input.value = sample;
    if (live.checked) doValidate();
    if (autoFmt.checked) doFormat(false);
  });

  btn.share.addEventListener('click', () => {
    const text = input.value || '';
    if (text.length > 100000) {
      shareOut.textContent = 'Share link is too long for very large JSON. Consider hosting the file instead.';
      return;
    }
    try {
      const b64 = b64EncodeUnicode(text);
      const url = location.origin + location.pathname + '?tool=json#j=' + b64;
      shareOut.textContent = url;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      toast('Share link generated' + (navigator.clipboard ? ' and copied.' : '.'));
    } catch (e) {
      shareOut.textContent = 'Failed to generate link: ' + e;
    }
  });

  input.addEventListener('input', debounce(() => {
    if (live.checked) doValidate();
  }, 250));

  // Tiny toast via status line
  function toast(msg, isErr) {
    stats.textContent = msg;
    stats.style.color = isErr ? 'var(--tbb-danger)' : 'var(--tbb-muted)';
    setTimeout(() => {
      if (input === document.activeElement) return; // don't override while typing
      const raw = input.value;
      const res = tryParse(raw, tolerant.checked);
      updateStats(raw, res.ok ? res.ms : 0, res.ok);
    }, 1800);
  }

  // Load from hash if provided (#j=base64)
  function initFromHash() {
    const h = location.hash || '';
    const m = h.match(/#j=([\s\S]+)$/);
    if (!m) return;
    try {
      const data = b64DecodeUnicode(m[1]);
      input.value = data;
      doValidate();
      if (autoFmt.checked) doFormat(false);
      // Do not keep the hash to avoid re-parsing on reload unless desired
    } catch (e) {
      toast('Failed to load from URL hash: ' + e, true);
    }
  }

  // first render
  initFromHash();
  if (live.checked) doValidate();
})();