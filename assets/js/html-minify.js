
/**
 * HTML Minifier
 * © 2025 The Bukit Besi
 * All Rights Reserved. Unauthorized copying, distribution, or use of this code is strictly prohibited.
 * For inquiries, contact https://thebukitbesi.com
 */
(function () {
  "use strict";

  // DOM
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const inputEl = $('#ibb-input');
  const outputEl = $('#ibb-output');
  const runBtn = $('#ibb-run');
  const copyBtn = $('#ibb-copy');
  const downloadBtn = $('#ibb-download');
  const fileInput = $('#ibb-file');
  const sampleBtn = $('#ibb-sample');
  const resetBtn = $('#ibb-reset');
  const autoChk = $('#ibb-auto');
  const permalinkBtn = $('#ibb-permalink');
  const inSizeEl = $('#ibb-in-size');
  const outSizeEl = $('#ibb-out-size');
  const savedEl = $('#ibb-saved');
  const timeEl = $('#ibb-time');
  const statusEl = $('#ibb-status');
  const liveEl = $('#ibb-live');

  // Options (minify)
  const optRemoveComments = $('#ibb-opt-remove-comments');
  const optKeepConditional = $('#ibb-opt-keep-conditional');
  const optCollapseWhitespace = $('#ibb-opt-collapse-whitespace');
  const optTrimText = $('#ibb-opt-trim-text');
  const optRemoveAttrQuotes = $('#ibb-opt-remove-attr-quotes');
  const optBooleanAttrs = $('#ibb-opt-boolean-attrs');
  const optRemoveEmptyAttrs = $('#ibb-opt-remove-empty-attrs');
  const optSortAttrs = $('#ibb-opt-sort-attrs');
  const optRemoveOptionalEnds = $('#ibb-opt-remove-optional-ends');
  const optMinifyInlineCSS = $('#ibb-opt-minify-inline-css');
  const optMinifyInlineJS = $('#ibb-opt-minify-inline-js');
  const optPreserveRaw = $('#ibb-opt-preserve-raw');

  // Options (beautify)
  const optIndent = $('#ibb-opt-indent');
  const optWrap = $('#ibb-opt-wrap');
  const optEndNewline = $('#ibb-opt-end-newline');
  const optAttrsOnNewline = $('#ibb-opt-attrs-on-newline');
  const optFormatInlineCSS = $('#ibb-opt-format-inline-css');
  const optPreserveRawBeautify = $('#ibb-opt-preserve-raw-beautify');

  // Mode
  const modeRadios = $$('input[name="mode"]');

  // Constants
  const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const RAW_TAGS = new Set(['script','style','pre','textarea']);

  // Utils
  const debounce = (fn, ms = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };
  const formatBytes = (n) => {
    if (!n) return '0 B';
    const units = ['B','KB','MB','GB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i ? 2 : 0)} ${units[i]}`;
  };
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // Basic CSS minifier (safe-ish)
  function minifyCSS(css) {
    try {
      return css
        .replace(/\/\*[\s\S]*?\*\//g, '')             // remove comments
        .replace(/\s+([{}:;,>~=])\s+/g, '$1')         // trim space around operators
        .replace(/\s{2,}/g, ' ')                      // collapse spaces
        .replace(/\s*([{}:;,>~=])\s*/g, '$1')         // remove unnecessary spaces
        .replace(/;}/g, '}')                          // remove last semicolon
        .trim();
    } catch { return css; }
  }

  // Very conservative JS minifier; avoids touching strings/regex as much as possible
  function minifyJS(js) {
    try {
      // Remove block comments not in strings
      // Tokenize strings to placeholders
      const placeholders = [];
      const token = (s) => `__JSTOKEN_${placeholders.push(s)-1}__`;
      let out = '';
      let i = 0, inStr = false, quote = '', esc = false, inRegex = false;

      // First: protect strings and regex
      while (i < js.length) {
        const ch = js[i], next = js[i+1];
        if (inStr) {
          out += ch;
          if (!esc && ch === quote) { inStr = false; quote = ''; }
          esc = !esc && ch === '\\';
          i++; continue;
        }
        if (inRegex) {
          out += ch;
          if (!esc && ch === '/') { inRegex = false; }
          esc = !esc && ch === '\\';
          i++; continue;
        }
        if ((ch === '\'' || ch === '"' || ch === '`')) {
          // start string
          const start = i; quote = ch; inStr = true; esc = false;
          let j = i + 1, body = ch;
          let e = false;
          for (; j < js.length; j++) {
            const c = js[j]; body += c;
            if (!e && c === quote) { j++; break; }
            e = !e && c === '\\';
          }
          const t = token(body);
          placeholders.push(body);
          out += t;
          i = j; inStr = false; quote = ''; continue;
        }
        if (ch === '/' && next && next !== '/' && next !== '*') {
          // try detect regex literal: previous char suggests start of expression
          const prev = out.trim().slice(-1);
          if (!prev || '([,{=:+-!*?|&;'.includes(prev)) {
            // capture regex literal
            let j = i + 1, body = '/';
            let e = false, inClass = false;
            for (; j < js.length; j++) {
              const c = js[j];
              body += c;
              if (!e) {
                if (c === '[') inClass = true;
                if (c === ']') inClass = false;
                if (c === '/' && !inClass) { j++; break; }
              }
              e = !e && c === '\\';
            }
            // include flags
            while (j < js.length && /[gimsuy]/.test(js[j])) { body += js[j]; j++; }
            const t = token(body);
            placeholders.push(body);
            out += t;
            i = j; continue;
          }
        }
        out += ch;
        i++;
      }

      // Remove comments (line and block)
      out = out
        .replace(/\/\*[\s\S]*?\*\//g, '')             // block comments
        .replace(/(^|[^\:])\/\/.*$/gm, '$1');         // line comments unless part of protocol or label

      // Collapse whitespace
      out = out
        .replace(/\s+/g, ' ')
        .replace(/\s*([=+\-*/%<>!?:;,{}()[```])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();

      // Restore placeholders
      out = out.replace(/__JSTOKEN_(\d+)__/g, (_, n) => placeholders[Number(n)] || '');
      return out;
    } catch { return js; }
  }

  // Protect raw content (script/style/pre/textarea)
  function protectRaw(html, opts, forBeautify = false) {
    const buckets = [];
    const makeToken = (name, idx) => `__IBB_RAW_${name.toUpperCase()}_${idx}__`;

    function capture(tag) {
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      html = html.replace(re, (m) => {
        let content = m;
        const idx = buckets.push({ tag, content }) - 1;
        return makeToken(tag, idx);
      });
    }
    ['script','style','pre','textarea'].forEach(capture);
    return {
      html,
      restore(str, transformMap = {}) {
        return str.replace(/__IBB_RAW_(SCRIPT|STYLE|PRE|TEXTAREA)_(\d+)__/g, (m, t, n) => {
          const item = buckets[Number(n)];
          if (!item) return m;
          let c = item.content;
          const tag = item.tag.toLowerCase();
          // Optionally minify/format inner content based on options
          if (!forBeautify) {
            if (tag === 'style' && opts.minifyInlineCSS) {
              c = c.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/i, (_, a, b, z) => `${a}${minifyCSS(b)}${z}`);
            }
            if (tag === 'script' && opts.minifyInlineJS) {
              // skip JSON type or templates
              const isJSON = /^\s*<script\b[^>]*type=["']?(?:application|text)\/(?:json|ld\+json)/i.test(c);
              if (!isJSON) {
                c = c.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/i, (_, a, b, z) => `${a}${minifyJS(b)}${z}`);
              }
            }
          } else {
            if (tag === 'style' && opts.formatInlineCSS) {
              c = c.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/i, (_, a, b, z) => `${a}${beautifyCSS(b, opts)}${z}`);
            }
          }
          return c;
        });
      }
    };
  }

  // Attribute processing helpers
  function parseTag(tagSrc) {
    // returns { name, attrs: [{name, value, quoted, raw}], selfClose }
    const tagMatch = tagSrc.match(/^<\s*\/?\s*([a-zA-Z0-9:-]+)/);
    if (!tagMatch) return null;
    const name = tagMatch[1].toLowerCase();
    const isClose = /^<\s*\//.test(tagSrc);
    const selfClose = /\/\s*>$/.test(tagSrc) || VOID_TAGS.has(name);
    const attrs = [];
    if (!isClose) {
      const rest = tagSrc.replace(/^<\s*\/?\s*[a-zA-Z0-9:-]+/, '').replace(/\/?\s*>$/, '');
      const re = /([^\s"'>\/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let m;
      while ((m = re.exec(rest))) {
        const n = m[1];
        const v = m[3] ?? m[4] ?? m[5] ?? null;
        const quoted = !!(m[2] && (m[2].startsWith('"') || m[2].startsWith("'")));
        attrs.push({ name: n, value: v, quoted, raw: m[0] });
      }
    }
    return { name, attrs, selfClose, isClose };
  }

  function rebuildTag(node, opts) {
    const name = node.name;
    let attrs = node.attrs.slice();

    // remove duplicates (keep last)
    const seen = new Map();
    for (let i = attrs.length - 1; i >= 0; i--) {
      const key = attrs[i].name.toLowerCase();
      if (seen.has(key)) attrs.splice(i, 1);
      else seen.set(key, true);
    }
    attrs.reverse();

    // remove redundant / empty / boolean handling
    attrs = attrs.filter(a => {
      const n = a.name.toLowerCase();
      const v = a.value;
      if (opts.booleanAttrs && v !== null && (v === '' || v.toLowerCase() === n)) {
        a.value = null; a.quoted = false; // boolean attr
      }
      // remove empty attributes except safe list
      if (opts.removeEmptyAttrs && (v === '' || v === null)) {
        const keep = /^aria-|^data-|^(value|alt|content|name)$/.test(n);
        if (!keep) return false;
      }
      // remove default types
      if ((n === 'type') && v && /^(text\/javascript|application\/javascript)$/i.test(v) && name === 'script') return false;
      if ((n === 'type') && v && /^text\/css$/i.test(v) && name === 'style') return false;
      if (n === 'language' && name === 'script') return false;
      return true;
    });

    if (opts.sortAttrs) {
      attrs.sort((a, b) => a.name.localeCompare(b.name));
    }

    // minify inline style=""
    if (opts.minifyInlineCSS) {
      const styleAttr = attrs.find(a => a.name.toLowerCase() === 'style' && typeof a.value === 'string');
      if (styleAttr) {
        styleAttr.value = minifyCSS(styleAttr.value);
        styleAttr.quoted = styleAttr.quoted || /[\s"'>=]/.test(styleAttr.value);
      }
    }

    // unquote safe attribute values
    const safeVal = v => /^[a-zA-Z0-9._\-/:]+$/.test(v);
    const rebuiltAttrs = attrs.map(a => {
      if (a.value === null) return a.name; // boolean
      let v = a.value;
      if (opts.removeAttrQuotes && typeof v === 'string' && safeVal(v)) {
        return `${a.name}=${v}`;
      }
      // prefer double quotes
      return `${a.name}="${(v ?? '').replace(/"/g, '&quot;')}"`;
    }).join(' ');

    const start = `<${name}${rebuiltAttrs ? ' ' + rebuiltAttrs : ''}`;
    const end = node.selfClose && !RAW_TAGS.has(name) && !/^html|head|body$/.test(name) ? ' />' : '>';
    if (node.isClose) return `</${name}>`;
    return start + end;
  }

  // Minifier
  function minifyHTML(html, opts) {
    const t0 = now();
    let original = html;

    // Protect raw segments
    const protectedBlocks = protectRaw(html, {
      minifyInlineCSS: opts.minifyInlineCSS,
      minifyInlineJS: opts.minifyInlineJS
    });
    html = protectedBlocks.html;

    // Remove HTML comments (optionally keep IE conditionals)
    if (opts.removeComments) {
      html = html.replace(/<!--([\s\S]*?)-->/g, (m, body) => {
        const keep = opts.keepConditional && /```math
if\s+[^```]+```>|<!\s*```math
endif```/i.test(m);
        return keep ? m : '';
      });
    }

    // Collapse whitespace between tags only (safe)
    if (opts.collapseWhitespace) {
      html = html.replace(/>\s+</g, '><');
    }

    // Trim text nodes (leading/trailing)
    if (opts.trimText) {
      html = html.replace(/>\s+([^<\s][\s\S]*?)\s+</g, (m, t) => '>' + t.replace(/\s{2,}/g, ' ') + '<');
      // Trim at edges
      html = html.replace(/^\s+|\s+$/g, '');
    }

    // Process tags for attributes minification
    html = html.replace(/<[^>]+>/g, (tag) => {
      // skip protected placeholders (which look like __IBB_RAW_...>)
      if (/^__IBB_RAW_/.test(tag)) return tag;
      const node = parseTag(tag);
      if (!node || node.isClose) return tag;
      return rebuildTag(node, {
        removeAttrQuotes: opts.removeAttrQuotes,
        booleanAttrs: opts.booleanAttrs,
        removeEmptyAttrs: opts.removeEmptyAttrs,
        sortAttrs: opts.sortAttrs,
        minifyInlineCSS: opts.minifyInlineCSS
      });
    });

    // Remove optional closing tags
    if (opts.removeOptionalEnds) {
      html = html
        .replace(/<\/li>\s*(?=<li|<\/ul|<\/ol)/gi, '')
        .replace(/<\/dt>\s*(?=<dt|<dd|<\/dl)/gi, '')
        .replace(/<\/dd>\s*(?=<dt|<dd|<\/dl)/gi, '')
        .replace(/<\/option>\s*(?=<option|<\/select)/gi, '')
        .replace(/<\/tr>\s*(?=<tr|<\/tbody|<\/thead|<\/tfoot|<\/table)/gi, '')
        .replace(/<\/t[dh]>\s*(?=<t[dh]|<\/tr)/gi, '');
      // Remove stray closing of voids
      html = html.replace(/<\/(br|hr|img|input|meta|link|source|track|wbr)\s*>/gi, '');
    }

    // Restore raw segments with optional inner minification already applied
    html = protectedBlocks.restore(html);

    const t1 = now();
    return { output: html, time: Math.max(0, t1 - t0), original };
  }

  // Beautify CSS (simple)
  function beautifyCSS(css, opts) {
    const indent = ' '.repeat(Math.max(1, Number(optIndent.value || 2)));
    let level = 0;
    return css
      .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n' + m + '\n')
      .replace(/\s*{\s*/g, ' {\n')
      .replace(/\s*}\s*/g, '\n}\n')
      .replace(/\s*;\s*/g, ';\n')
      .split('\n')
      .map(line => {
        line = line.trim();
        if (!line) return '';
        if (line.startsWith('}')) level = Math.max(0, level - 1);
        const out = indent.repeat(level) + line;
        if (line.endsWith('{')) level++;
        return out;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Beautifier (simple HTML pretty-printer)
  function beautifyHTML(html, opts) {
    const t0 = now();
    const indentSize = Math.max(1, Number(opts.indent || 2));
    const wrap = Math.max(0, Number(opts.wrap || 0));
    const IND = ' '.repeat(indentSize);

    // Protect raw blocks (optionally also format inline CSS)
    const protectedBlocks = protectRaw(html, { }, true);
    html = protectedBlocks.html;

    const tokens = [];
    const re = /<!--[\s\S]*?-->|<!```math
CDATA```math
[\s\S]*?``````>|<!DOCTYPE[\s\S]*?>|<\/?[a-zA-Z0-9:-]+\b[^>]*>|[^<]+/g;
    let m;
    while ((m = re.exec(html))) tokens.push(m[0]);

    let out = [];
    let level = 0;
    let inRaw = null;

    const openTag = t => /^<([a-zA-Z0-9:-]+)\b[^>]*>$/.exec(t);
    const closeTag = t => /^<\/([a-zA-Z0-9:-]+)>$/.exec(t);
    const selfCloseTag = t => /^<([a-zA-Z0-9:-]+)\b[^>]*\/>$/.exec(t);

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      // Raw placeholders
      if (/^__IBB_RAW_/.test(tok)) {
        const restored = protectedBlocks.restore(tok, { formatInlineCSS: opts.formatInlineCSS });
        out.push(IND.repeat(level) + restored.trim());
        continue;
      }

      if (closeTag(tok)) {
        level = Math.max(0, level - 1);
        out.push(IND.repeat(level) + tok);
        continue;
      }

      if (openTag(tok)) {
        const name = openTag(tok)[1].toLowerCase();
        out.push(IND.repeat(level) + formatTag(tok, opts, wrap ? (wrap - (level * indentSize)) : 0, IND));
        if (!VOID_TAGS.has(name) && !/\/>$/.test(tok)) {
          level++;
        }
        continue;
      }

      if (selfCloseTag(tok)) {
        out.push(IND.repeat(level) + formatTag(tok, opts, wrap ? (wrap - (level * indentSize)) : 0, IND));
        continue;
      }

      if (/^<!--/.test(tok) || /^<!/.test(tok)) {
        out.push(IND.repeat(level) + tok.trim());
        continue;
      }

      // Text
      let text = tok.replace(/\s+/g, ' ').trim();
      if (text) out.push(IND.repeat(level) + text);
    }

    let result = out.join('\n');
    result = protectedBlocks.restore(result, { formatInlineCSS: opts.formatInlineCSS });
    if (opts.endNewline) result += '\n';

    const t1 = now();
    return { output: result, time: Math.max(0, t1 - t0), original: html };
  }

  function formatTag(tag, opts, wrapWidth, IND) {
    if (!opts.attrsOnNewline || wrapWidth <= 0) return tag;
    // Break attributes onto new lines when tag is long
    const node = parseTag(tag);
    if (!node || node.isClose) return tag;
    const name = node.name;
    if (!node.attrs.length) return tag;

    const attrsStr = node.attrs.map(a => {
      if (a.value == null) return a.name;
      const val = a.quoted ? (a.raw.includes('"') ? a.value : a.value) : a.value;
      return `${a.name}="${String(val).replace(/"/g,'&quot;')}"`;
    });

    const base = `<${name}`;
    const oneLine = base + ' ' + attrsStr.join(' ') + (node.selfClose ? ' />' : '>');
    if (oneLine.length <= wrapWidth) return oneLine;

    const lines = [base];
    for (const s of attrsStr) lines.push(IND + s);
    lines[lines.length-1] += node.selfClose ? ' />' : '>';
    return lines.join('\n');
  }

  // Glue
  function getMode() {
    const m = $$('input[name="mode"]').find(r => r.checked);
    return m ? m.value : 'minify';
    }
  function getMinifyOptions() {
    return {
      removeComments: optRemoveComments.checked,
      keepConditional: optKeepConditional.checked,
      collapseWhitespace: optCollapseWhitespace.checked,
      trimText: optTrimText.checked,
      removeAttrQuotes: optRemoveAttrQuotes.checked,
      booleanAttrs: optBooleanAttrs.checked,
      removeEmptyAttrs: optRemoveEmptyAttrs.checked,
      sortAttrs: optSortAttrs.checked,
      removeOptionalEnds: optRemoveOptionalEnds.checked,
      minifyInlineCSS: optMinifyInlineCSS.checked,
      minifyInlineJS: optMinifyInlineJS.checked,
      preserveRaw: optPreserveRaw.checked
    };
  }
  function getBeautifyOptions() {
    return {
      indent: Number(optIndent.value || 2),
      wrap: Number(optWrap.value || 0),
      endNewline: optEndNewline.checked,
      attrsOnNewline: optAttrsOnNewline.checked,
      formatInlineCSS: optFormatInlineCSS.checked,
      preserveRaw: optPreserveRawBeautify.checked
    };
  }

  function process() {
    const mode = getMode();
    const input = inputEl.value;
    const t0 = now();
    let res = { output: '', time: 0, original: input };

    try {
      if (!input.trim()) {
        outputEl.value = '';
        renderStats(input.length, 0, 0);
        setStatus('Ready.');
        return;
      }
      if (mode === 'minify') {
        res = minifyHTML(input, getMinifyOptions());
      } else {
        res = beautifyHTML(input, getBeautifyOptions());
      }
      outputEl.value = res.output;
      renderStats(input.length, res.output.length, res.time);
      setStatus(`${mode === 'minify' ? 'Minified' : 'Beautified'} successfully.`);
    } catch (e) {
      outputEl.value = input;
      renderStats(input.length, input.length, now() - t0);
      setStatus('Processing error (returned original).');
      console.error(e);
    }
  }
  const processDebounced = debounce(process, 220);

  function renderStats(inLen, outLen, ms) {
    inSizeEl.textContent = formatBytes(inLen);
    outSizeEl.textContent = formatBytes(outLen);
    const saved = inLen ? Math.max(0, (1 - (outLen / inLen)) * 100) : 0;
    savedEl.textContent = `${saved.toFixed(1)}%`;
    timeEl.textContent = `${Math.round(ms)} ms`;
  }
  function setStatus(msg) {
    statusEl.textContent = msg;
    liveEl.textContent = msg;
  }

  // UI: copy/download/reset/sample/upload
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outputEl.value);
      setStatus('Output copied to clipboard.');
    } catch {
      setStatus('Copy failed. Select and press Ctrl/Cmd + C.');
    }
  });
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([outputEl.value], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const mode = getMode();
    a.download = `html-${mode}-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  resetBtn.addEventListener('click', () => {
    inputEl.value = '';
    outputEl.value = '';
    renderStats(0, 0, 0);
    setStatus('Cleared.');
    history.replaceState(null, '', location.pathname);
  });
  sampleBtn.addEventListener('click', () => {
    inputEl.value =
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sample Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* sample css */
    body { font-family: system-ui, sans-serif; color: #222; }
    .box { padding: 10px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <!-- comment to be removed -->
  <div class="box" style="color: #333;   background:  white;">
    Hello <strong>world</strong>!
  </div>
  <script>
    // sample js
    function hi ( name ) { console.log('hi', name ); }
  </script>
</body>
</html>`;
    setStatus('Sample pasted.');
    autoChk.checked ? processDebounced() : null;
  });
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const text = await f.text();
    inputEl.value = text;
    setStatus(`Loaded file: ${f.name}`);
    autoChk.checked ? processDebounced() : null;
  });
  runBtn.addEventListener('click', process);
  inputEl.addEventListener('input', () => autoChk.checked ? processDebounced() : null);
  modeRadios.forEach(r => r.addEventListener('change', processDebounced));
  $$('#ibb-controls input, #ibb-controls select').forEach(el => {
    el.addEventListener('change', () => autoChk.checked ? processDebounced() : null);
  });

  // Drag & drop
  ;['dragenter','dragover'].forEach(evt => {
    document.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      setStatus('Drop your file to load...');
    });
  });
  ;['dragleave','drop'].forEach(evt => {
    document.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
    });
  });
  document.addEventListener('drop', async (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const text = await f.text();
    inputEl.value = text;
    setStatus(`Loaded file: ${f.name}`);
    autoChk.checked ? processDebounced() : null;
  });

  // Permalink (options in URL)
  function updatePermalink() {
    const params = new URLSearchParams();
    params.set('mode', getMode());
    params.set('auto', autoChk.checked ? '1' : '0');
    // minify opts
    params.set('mc', optRemoveComments.checked ? '1' : '0');
    params.set('mcc', optKeepConditional.checked ? '1' : '0');
    params.set('cw', optCollapseWhitespace.checked ? '1' : '0');
    params.set('tt', optTrimText.checked ? '1' : '0');
    params.set('raq', optRemoveAttrQuotes.checked ? '1' : '0');
    params.set('ba', optBooleanAttrs.checked ? '1' : '0');
    params.set('rea', optRemoveEmptyAttrs.checked ? '1' : '0');
    params.set('sa', optSortAttrs.checked ? '1' : '0');
    params.set('roe', optRemoveOptionalEnds.checked ? '1' : '0');
    params.set('mic', optMinifyInlineCSS.checked ? '1' : '0');
    params.set('mij', optMinifyInlineJS.checked ? '1' : '0');
    params.set('pr', optPreserveRaw.checked ? '1' : '0');
    // beautify opts
    params.set('ind', optIndent.value);
    params.set('wrap', optWrap.value);
    params.set('eol', optEndNewline.checked ? '1' : '0');
    params.set('aon', optAttrsOnNewline.checked ? '1' : '0');
    params.set('fic', optFormatInlineCSS.checked ? '1' : '0');
    params.set('prb', optPreserveRawBeautify.checked ? '1' : '0');

    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    setStatus('Permalink updated.');
  }
  permalinkBtn.addEventListener('click', updatePermalink);

  function applyFromQuery() {
    const q = new URLSearchParams(location.search);
    const get = (k, d) => q.has(k) ? q.get(k) : d;
    const setChecked = (el, k) => { el.checked = get(k, el.checked ? '1' : '0') === '1'; };

    const mode = get('mode', 'minify');
    const modeEl = mode === 'beautify' ? $('#ibb-mode-beautify') : $('#ibb-mode-minify');
    if (modeEl) modeEl.checked = true;

    autoChk.checked = get('auto','1') === '1';
    setChecked(optRemoveComments, 'mc');
    setChecked(optKeepConditional, 'mcc');
    setChecked(optCollapseWhitespace, 'cw');
    setChecked(optTrimText, 'tt');
    setChecked(optRemoveAttrQuotes, 'raq');
    setChecked(optBooleanAttrs, 'ba');
    setChecked(optRemoveEmptyAttrs, 'rea');
    setChecked(optSortAttrs, 'sa');
    setChecked(optRemoveOptionalEnds, 'roe');
    setChecked(optMinifyInlineCSS, 'mic');
    setChecked(optMinifyInlineJS, 'mij');
    setChecked(optPreserveRaw, 'pr');

    optIndent.value = get('ind', String(optIndent.value));
    optWrap.value = get('wrap', String(optWrap.value));
    setChecked(optEndNewline, 'eol');
    setChecked(optAttrsOnNewline, 'aon');
    setChecked(optFormatInlineCSS, 'fic');
    setChecked(optPreserveRawBeautify, 'prb');
  }

  applyFromQuery();
  setStatus('Ready.');
})();
