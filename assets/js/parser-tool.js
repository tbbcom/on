(function() {
    const root = document.getElementById('parser-unparser');
    if (!root) return;
    const $ = function(sel) { return root.querySelector(sel); };

    // --- Elements ---
    const inEl = $('#pu-in'),
        outEl = $('#pu-out');
    const inStats = $('#pu-in-stats'),
        outStats = $('#pu-out-stats');
    const statusEl = $('#pu-status'),
        fb = $('#pu-feedback');
    const modeSel = $('#pu-mode');
    const parseBtn = $('#pu-parse'),
        unparseBtn = $('#pu-unparse');
    const copyBtn = $('#pu-copy'),
        dlBtn = $('#pu-download'),
        swapBtn = $('#pu-swap'),
        clearBtn = $('#pu-clear');

    // --- Options ---
    const optJson = { indent: $('#pu-json-indent'), sort: $('#pu-json-sort') };
    const optCsv = { delim: $('#pu-csv-delim'), quote: $('#pu-csv-quote'), header: $('#pu-csv-header'), eol: $('#pu-eol') };
    const optKv = { pair: $('#pu-kv-pair'), kv: $('#pu-kv-delim') };
    const optQuery = { sort: $('#pu-query-sort'), space: $('#pu-query-space') };
    const optUrl = { mode: $('#pu-url-mode') };

    const boxes = {
        json: $('.pu-opt-json'),
        csv: $('.pu-opt-csv'),
        kv: $('.pu-opt-kv'),
        query: $('.pu-opt-query'),
        url: $('.pu-opt-url')
    };

    function showOptionsFor(mode) {
        for (const k in boxes) boxes[k].classList.remove('show');
        const boxToShow = (mode === 'csv' || mode === 'tsv') ? 'csv' : mode;
        if (boxes[boxToShow]) boxes[boxToShow].classList.add('show');
        
        // Handle TSV delimiter logic
        if (mode === 'tsv') {
            optCsv.delim.value = '\\t';
            optCsv.delim.disabled = true;
        } else {
            optCsv.delim.disabled = false;
            if (optCsv.delim.value === '\\t') optCsv.delim.value = ',';
        }
    }

    // --- Helpers ---
    function setStatus(msg, isError) {
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#dc2626' : 'var(--pu-muted)';
        if (msg) setTimeout(function() { statusEl.textContent = ''; }, 3000);
    }

    function feedback(msg) {
        fb.textContent = msg;
        setTimeout(function() { fb.textContent = ''; }, 1500);
    }

    function normalizeDelim(str) {
        if (str === '\\t') return '\t';
        return (str && str.length) ? str[0] : ',';
    }

    function eolValue() {
        return optCsv.eol.value === 'crlf' ? '\r\n' : '\n';
    }
    
    function sortKeysDeep(v) {
        if (Array.isArray(v)) return v.map(sortKeysDeep);
        if (v && typeof v === 'object') {
            const out = {};
            Object.keys(v).sort().forEach(function(k) { out[k] = sortKeysDeep(v[k]); });
            return out;
        }
        return v;
    }

    // --- Parsers (Text -> Object) ---
    const parsers = {
        json: (text) => JSON.parse(text),
        query: (text) => {
            let q = text || '';
            const idx = q.indexOf('?');
            if (idx >= 0) q = q.slice(idx + 1);
            const params = new URLSearchParams(q);
            const obj = {};
            params.forEach(function(val, key) {
                if (obj.hasOwnProperty(key)) {
                    if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
                    obj[key].push(val);
                } else obj[key] = val;
            });
            return obj;
        },
        csv: (text, delim, quote, header) => {
            delim = normalizeDelim(delim);
            quote = (quote && quote.length) ? quote[0] : '"';
            const rows = [], s = text || '';
            let cur = '', row = [], inQ = false, i = 0;
            while (i < s.length) {
                const ch = s[i];
                if (inQ) {
                    if (ch === quote) {
                        if (s[i + 1] === quote) { cur += quote; i++; } 
                        else { inQ = false; }
                    } else { cur += ch; }
                } else {
                    if (ch === quote) { inQ = true; } 
                    else if (ch === delim) { row.push(cur); cur = ''; } 
                    else if (ch === '\n' || ch === '\r') {
                        if (ch === '\r' && s[i + 1] === '\n') i++;
                        row.push(cur); rows.push(row); row = []; cur = '';
                    } else { cur += ch; }
                }
                i++;
            }
            if (cur.length || row.length) { row.push(cur); rows.push(row); }
            if (!header || !rows.length) return rows;
            const head = rows.shift(), out = [];
            rows.forEach(function(r) {
                const obj = {};
                head.forEach(function(h, c) {
                    obj[h != null ? String(h) : ('col' + (c + 1))] = r[c] != null ? r[c] : '';
                });
                out.push(obj);
            });
            return out;
        },
        ini: (text) => {
            const obj = {};
            let currentSection = obj;
            (text || '').split(/\r?\n/).forEach(function(line) {
                const s = line.trim();
                if (!s || s.startsWith(';') || s.startsWith('#')) return;
                const m = s.match(/^\[(.+?)\]$/); // *** CRITICAL FIX HERE ***
                if (m) {
                    currentSection = obj[m[1]] = obj[m[1]] || {};
                } else {
                    const idx = s.indexOf('=');
                    if (idx > -1) {
                        const k = s.slice(0, idx).trim(), v = s.slice(idx + 1).trim();
                        currentSection[k] = v;
                    }
                }
            });
            return obj;
        },
        kv: (text, pairDelim, kvDelim) => {
            const pd = pairDelim === '\\n' ? '\n' : pairDelim;
            const lines = (text || '').split(pd === '\n' ? /\r\n|\r|\n/ : pd);
            const obj = {};
            lines.forEach(function(line) {
                const s = String(line).trim();
                if (!s) return;
                const idx = s.indexOf(kvDelim);
                if (idx > -1) {
                    const k = s.slice(0, idx).trim(), v = s.slice(idx + 1).trim();
                    obj[k] = v;
                }
            });
            return obj;
        }
    };

    // --- Stringifiers (Object -> Text) ---
    const stringifiers = {
        json: (obj, indent, sort) => {
            const data = sort ? sortKeysDeep(obj) : obj;
            return JSON.stringify(data, null, Math.max(0, Math.min(8, indent)));
        },
        query: (obj, sort, spaceEnc) => {
            if (!obj || typeof obj !== 'object') return '';
            const keys = Object.keys(obj);
            if (sort) keys.sort();
            const parts = [];
            keys.forEach(function(k) {
                const v = obj[k];
                const pushKV = function(key, val) {
                    const ek = encodeURIComponent(key);
                    let ev = encodeURIComponent(val == null ? '' : String(val));
                    if (spaceEnc === '+') { ev = ev.replace(/%20/g, '+'); }
                    parts.push(ek + '=' + ev);
                };
                if (Array.isArray(v)) { v.forEach(item => pushKV(k, item)); }
                else { pushKV(k, v); }
            });
            return parts.join('&');
        },
        csv: (data, delim, quote, header, eol) => {
            delim = normalizeDelim(delim);
            quote = (quote && quote.length) ? quote[0] : '"';
            eol = eol || '\n';
            let rows = [];
            if (!Array.isArray(data)) data = [];

            if (data.length && typeof data[0] === 'object' && !Array.isArray(data[0])) {
                const cols = Object.keys(data.reduce((res, row) => ({...res, ...row }), {}));
                if (header) rows.push(cols);
                data.forEach(o => rows.push(cols.map(k => o[k] == null ? '' : String(o[k]))));
            } else {
                rows = data.map(row => Array.isArray(row) ? row : [row]);
            }
            const esc = (cell) => {
                const strCell = String(cell);
                const mustQuote = strCell.includes(delim) || strCell.includes('\n') || strCell.includes('\r') || strCell.includes(quote);
                return mustQuote ? `${quote}${strCell.replace(new RegExp(quote, 'g'), quote + quote)}${quote}` : strCell;
            };
            return rows.map(r => r.map(esc).join(delim)).join(eol);
        },
        ini: (obj, eol) => {
            eol = eol || '\n';
            const top = [], sections = [];
            Object.keys(obj || {}).forEach(function(k) {
                const v = obj[k];
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    const lines = ['[' + k + ']'];
                    Object.keys(v).forEach(function(kk) { lines.push(kk + '=' + (v[kk] == null ? '' : String(v[kk]))); });
                    sections.push(lines.join(eol));
                } else {
                    top.push(k + '=' + (v == null ? '' : String(v)));
                }
            });
            return top.join(eol) + (top.length && sections.length ? eol + eol : '') + sections.join(eol + eol);
        },
        kv: (obj, pairDelim, kvDelim, eol) => {
            const pd = pairDelim === '\\n' ? (eol || '\n') : pairDelim;
            const out = [];
            Object.keys(obj || {}).forEach(function(k) { out.push(k + kvDelim + (obj[k] == null ? '' : String(obj[k]))); });
            return out.join(pd);
        }
    };
    
    // --- Main Actions ---
    function doParse() {
        const mode = modeSel.value, input = inEl.value || '';
        try {
            let out = '';
            switch (mode) {
                case 'json':
                    const obj = parsers.json(input);
                    const indent = parseInt(optJson.indent.value || '2', 10);
                    out = stringifiers.json(obj, indent, optJson.sort.checked);
                    break;
                case 'query':
                case 'csv':
                case 'tsv':
                case 'ini':
                case 'kv':
                    let data;
                    if (mode === 'csv' || mode === 'tsv') {
                        data = parsers.csv(input, mode === 'tsv' ? '\\t' : optCsv.delim.value, optCsv.quote.value, optCsv.header.checked);
                    } else if (mode === 'kv') {
                        data = parsers.kv(input, optKv.pair.value, optKv.kv.value);
                    } else {
                        data = parsers[mode](input);
                    }
                    // Standardized output for intermediate JSON. No longer uses JSON-mode options.
                    out = JSON.stringify(data, null, 2);
                    break;
                case 'html': out = (document.createElement('div').textContent = input, document.createElement('div').innerHTML); break;
                case 'url': out = optUrl.mode.value === 'uri' ? encodeURI(input) : encodeURIComponent(input); break;
                case 'base64': out = btoa(new TextEncoder().encode(input).reduce((s, b) => s + String.fromCharCode(b), '')); break;
            }
            outEl.value = out;
            setStatus('Parsed');
        } catch (err) {
            outEl.value = '';
            setStatus(err.message || 'Parse error', true);
        }
        updateStats();
    }

    function doUnparse() {
        const mode = modeSel.value, input = inEl.value || '';
        try {
            let out = '';
            const obj = (mode !== 'html' && mode !== 'url' && mode !== 'base64') ? JSON.parse(input) : null;

            switch (mode) {
                case 'json':
                    const indent = parseInt(optJson.indent.value || '0', 10);
                    out = stringifiers.json(obj, indent, optJson.sort.checked);
                    break;
                case 'query': out = stringifiers.query(obj, optQuery.sort.checked, optQuery.space.value); break;
                case 'csv':
                case 'tsv':
                    const delim = mode === 'tsv' ? '\\t' : optCsv.delim.value;
                    out = stringifiers.csv(obj, delim, optCsv.quote.value, optCsv.header.checked, eolValue());
                    break;
                case 'ini': out = stringifiers.ini(obj, eolValue()); break;
                case 'kv': out = stringifiers.kv(obj, optKv.pair.value, optKv.kv.value, eolValue()); break;
                case 'html': out = (new DOMParser().parseFromString(input, "text/html")).documentElement.textContent; break;
                case 'url': out = optUrl.mode.value === 'uri' ? decodeURI(input) : decodeURIComponent(input); break;
                case 'base64': out = new TextDecoder().decode(Uint8Array.from(atob(input), c => c.charCodeAt(0))); break;
            }
            outEl.value = out;
            setStatus('Unparsed');
        } catch (err) {
            outEl.value = '';
            setStatus(err.message || 'Unparse error', true);
        }
        updateStats();
    }
    
    // --- Stats & Util Events ---
    function updateStats() {
        const s = (text) => {
            const bytes = new TextEncoder().encode(text).length;
            const lines = text.length ? (text.match(/\r\n|\r|\n/g) || []).length + 1 : 0;
            return { lines: lines, bytes: bytes };
        };
        const s1 = s(inEl.value), s2 = s(outEl.value);
        inStats.textContent = `Lines: ${s1.lines} | Size: ${s1.bytes} bytes`;
        outStats.textContent = `Lines: ${s2.lines} | Size: ${s2.bytes} bytes`;
    }
    inEl.addEventListener('input', updateStats);
    outEl.addEventListener('input', updateStats);
    modeSel.addEventListener('change', function() { showOptionsFor(modeSel.value); });
    
    // --- Button Events ---
    parseBtn.addEventListener('click', doParse);
    unparseBtn.addEventListener('click', doUnparse);
    copyBtn.addEventListener('click', function() {
        if (!outEl.value) return;
        navigator.clipboard.writeText(outEl.value).then(() => feedback('Copied!'));
    });
    dlBtn.addEventListener('click', function() {
        const data = outEl.value || '';
        if (!data) return;
        const ext = {json: 'json', csv: 'csv', tsv: 'tsv', ini: 'ini'}[modeSel.value] || 'txt';
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.' + ext;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    });
    clearBtn.addEventListener('click', function() {
        inEl.value = ''; outEl.value = '';
        updateStats(); inEl.focus();
    });
    swapBtn.addEventListener('click', function() {
        const a = inEl.value, b = outEl.value;
        inEl.value = b; outEl.value = a;
        updateStats();
    });

    // --- Init ---
    showOptionsFor(modeSel.value);
    updateStats();
})();
