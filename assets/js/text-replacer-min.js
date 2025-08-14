(function () {
    // Shortcuts for DOM selection
    const $ = (s, d = document) => d.querySelector(s);
    const $$ = (s, d = document) => Array.from(d.querySelectorAll(s));

    const storeKey = 'frt_state_v1';

    // Element references
    const els = {
        input: $('#frt-input'),
        output: $('#frt-output'),
        preview: $('#frt-preview'),
        stats: $('#frt-stats'),
        error: $('#frt-error'),
        add: $('#frt-add'),
        clearRules: $('#frt-clear-rules'),
        exportRules: $('#frt-export-rules'),
        importRules: $('#frt-import-rules'),
        run: $('#frt-run'),
        swap: $('#frt-swap'),
        copy: $('#frt-copy'),
        download: $('#frt-download'),
        clear: $('#frt-clear'),
        rules: $('#frt-rules'),
        case: $('#frt-case'),
        whole: $('#frt-whole'),
        multi: $('#frt-multi'),
        highlight: $('#frt-highlight'),
        rexFind: $('#frt-rex'),
        rexRepl: $('#frt-rex-repl'),
        flagG: $('#frt-flag-g'),
        flagI: $('#frt-flag-i'),
        flagM: $('#frt-flag-m'),
        flagS: $('#frt-flag-s'),
        flagU: $('#frt-flag-u'),
        applyRex: $('#frt-apply-rex'),
    };

    // Preset transformations
    const presetsMap = {
        'remove-line-breaks': txt => txt.replace(/\r\n|\r|\n/g, ''),
        'remove-empty-lines': txt => txt.replace(/^[ \t]*[\r\n]+/gm, ''),
        'collapse-spaces': txt => txt.replace(/[ \t]{2,}/g, ' '),
        'trim-lines': txt => txt.replace(/^[ \t]+|[ \t]+$/gm, ''),
        'remove-html': txt => txt.replace(/<[^>]*>/g, ''),
    };

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function addRule(find = '', repl = '', isRegex = false) {
        const wrap = document.createElement('div');
        wrap.className = 'frt-rule';
        wrap.innerHTML = `
            <input type="text" class="frt-input frt-find" placeholder="Find text/symbol…" value="${find.replace(/"/g, '&quot;')}">
            <input type="text" class="frt-input frt-repl" placeholder="Replace with…" value="${repl.replace(/"/g, '&quot;')}">
            <div class="frt-mini">
                <label class="frt-check">
                    <input type="checkbox" class="frt-isregex" ${isRegex ? 'checked' : ''}> Regex
                </label>
                <button type="button" class="ibtn tiny ghost frt-del" title="Remove this rule">✕</button>
            </div>
        `;
        els.rules.appendChild(wrap);
    }

    function getRules() {
        return $$('.frt-rule', els.rules)
            .map(row => ({
                find: $('.frt-find', row).value,
                repl: $('.frt-repl', row).value,
                isRegex: $('.frt-isregex', row).checked,
            }))
            .filter(r => r.find !== '');
    }

    function buildRegexFromRule(rule, flags) {
        try {
            if (rule.isRegex) {
                return new RegExp(rule.find, flags);
            }
            let pattern = escapeRegExp(rule.find);
            if (els.whole.checked) {
                pattern = `\\b${pattern}\\b`;
            }
            return new RegExp(pattern, flags);
        } catch (e) {
            throw e;
        }
    }

    function highlight(text, regexes) {
        if (!regexes.length) return escapeHTML(text).replace(/\n/g, '<br>');
        let ranges = [];
        regexes.forEach(rx => {
            let m;
            rx.lastIndex = 0;
            while ((m = rx.exec(text)) !== null) {
                const start = m.index;
                const end = m.index + (m[0] || '').length;
                if (end === start) {
                    rx.lastIndex++;
                    continue;
                }
                ranges.push([start, end]);
                if (!rx.global) break;
            }
        });
        if (!ranges.length) return escapeHTML(text).replace(/\n/g, '<br>');
        ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const merged = [];
        let [cs, ce] = ranges[0];
        for (let i = 1; i < ranges.length; i++) {
            const [s, e] = ranges[i];
            if (s <= ce) {
                ce = Math.max(ce, e);
            } else {
                merged.push([cs, ce]);
                [cs, ce] = [s, e];
            }
        }
        merged.push([cs, ce]);
        let out = '';
        let pos = 0;
        for (const [s, e] of merged) {
            out += escapeHTML(text.slice(pos, s));
            out += '<mark class="frt-mark">' + escapeHTML(text.slice(s, e)) + '</mark>';
            pos = e;
        }
        out += escapeHTML(text.slice(pos));
        return out.replace(/\n/g, '<br>');
    }

    function escapeHTML(s) {
        return s.replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[m]));
    }

    function runReplace() {
        els.error.textContent = '';
        const base = els.input.value || '';
        const rules = getRules();
        let text = base;
        let total = 0;
        const flags =
            'g' +
            (els.case.checked ? '' : 'i') +
            (els.multi.checked ? 'm' : '') +
            'u';
        const rxForHighlight = [];
        try {
            rules.forEach(rule => {
                if (!rule.find) return;
                const rx = buildRegexFromRule(rule, flags);
                rxForHighlight.push(rx);
                let local = 0;
                text = text.replace(rx, function () {
                    local++;
                    return rule.repl;
                });
                total += local;
            });
        } catch (e) {
            els.error.textContent = 'Error in rule: ' + e.message;
            return;
        }
        els.output.value = text;
        els.stats.textContent = `${rules.length} rule(s) applied, ${total} replacement(s) made. Characters: ${text.length}`;
        if (els.highlight.checked) {
            els.preview.innerHTML = highlight(els.input.value, rxForHighlight);
        } else {
            els.preview.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
        }
        saveState();
    }

    function applyRegexBox() {
        els.error.textContent = '';
        const pattern = els.rexFind.value;
        const repl = els.rexRepl.value;
        if (!pattern) {
            els.error.textContent = 'Provide a RegEx pattern.';
            return;
        }
        const flags =
            (els.flagG.checked ? 'g' : '') +
            (els.flagI.checked ? 'i' : '') +
            (els.flagM.checked ? 'm' : '') +
            (els.flagS.checked ? 's' : '') +
            (els.flagU.checked ? 'u' : '');
        let rx;
        try {
            rx = new RegExp(pattern, flags || 'g');
        } catch (e) {
            els.error.textContent = 'Invalid RegEx: ' + e.message;
            return;
        }
        let cnt = 0;
        const src = els.input.value || '';
        const out = src.replace(rx, function () {
            cnt++;
            return repl;
        });
        els.output.value = out;
        els.stats.textContent = `RegEx applied (${flags || 'g'}), ${cnt} replacement(s).`;
        if (els.highlight.checked) {
            els.preview.innerHTML = highlight(src, [rx]);
        } else {
            els.preview.innerHTML = escapeHTML(out).replace(/\n/g, '<br>');
        }
        saveState();
    }

    function doPreset(key) {
        const fn = presetsMap[key];
        if (!fn) return;
        const src = els.input.value || '';
        const out = fn(src);
        els.output.value = out;
        els.stats.textContent = `Preset applied: ${key.replace(/-/g, ' ')}. Characters: ${out.length}`;
        els.preview.innerHTML = escapeHTML(out).replace(/\n/g, '<br>');
        saveState();
    }

    function copyResult() {
        const val = els.output.value;
        if (!val) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(val).then(() => {
                els.stats.textContent = 'Result copied to clipboard.';
            }).catch(() => fallbackCopy(val));
        } else {
            fallbackCopy(val);
        }
        function fallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                els.stats.textContent = 'Result copied to clipboard.';
            } catch (e) { }
            document.body.removeChild(ta);
        }
    }

    function downloadTxt() {
        const blob = new Blob([els.output.value || ''], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'find-replace.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    }

    function swapIO() {
        const tmp = els.input.value;
        els.input.value = els.output.value;
        els.output.value = tmp || '';
        els.preview.innerHTML = escapeHTML(els.input.value).replace(/\n/g, '<br>');
        els.stats.textContent = 'Swapped input and output.';
        saveState();
    }

    function clearAll() {
        els.input.value = '';
        els.output.value = '';
        els.preview.innerHTML = '';
        els.stats.textContent = '';
        els.error.textContent = '';
        els.rules.innerHTML = '';
        addRule('', '', false);
        saveState();
    }

    function saveState() {
        const state = {
            input: els.input.value,
            output: els.output.value,
            rules: getRules(),
            opts: {
                cs: els.case.checked,
                whole: els.whole.checked,
                multi: els.multi.checked,
                hi: els.highlight.checked,
            },
            rex: {
                f: els.rexFind.value,
                r: els.rexRepl.value,
                g: els.flagG.checked,
                i: els.flagI.checked,
                m: els.flagM.checked,
                s: els.flagS.checked,
                u: els.flagU.checked,
            },
        };
        try {
            localStorage.setItem(storeKey, JSON.stringify(state));
        } catch (e) { }
    }

    function loadState() {
        try {
            const state = JSON.parse(localStorage.getItem(storeKey) || 'null');
            if (!state) {
                addRule();
                return;
            }
            els.input.value = state.input || '';
            els.output.value = state.output || '';
            els.rules.innerHTML = '';
            (state.rules || []).forEach(r => addRule(r.find, r.repl, r.isRegex));
            if (!state.rules || !state.rules.length) addRule();
            els.case.checked = !!(state.opts && state.opts.cs);
            els.whole.checked = !!(state.opts && state.opts.whole);
            els.multi.checked = !!(state.opts && state.opts.multi);
            els.highlight.checked = state.opts ? !!state.opts.hi : true;
            if (state.rex) {
                els.rexFind.value = state.rex.f || '';
                els.rexRepl.value = state.rex.r || '';
                els.flagG.checked = state.rex.g !== false;
                els.flagI.checked = !!state.rex.i;
                els.flagM.checked = !!state.rex.m;
                els.flagS.checked = !!state.rex.s;
                els.flagU.checked = state.rex.u !== false;
            }
            els.preview.innerHTML = escapeHTML(els.input.value).replace(/\n/g, '<br>');
        } catch (e) {
            addRule();
        }
    }

    // Rule buttons (delegate)
    els.rules.addEventListener('click', e => {
        if (e.target.classList.contains('frt-del')) {
            e.target.closest('.frt-rule').remove();
            saveState();
        }
    });

    // Actions
    els.add.addEventListener('click', () => {
        addRule();
        saveState();
    });

    els.clearRules.addEventListener('click', () => {
        els.rules.innerHTML = '';
        addRule();
        saveState();
    });

    els.run.addEventListener('click', runReplace);
    els.applyRex.addEventListener('click', applyRegexBox);
    els.swap.addEventListener('click', swapIO);
    els.copy.addEventListener('click', copyResult);
    els.download.addEventListener('click', downloadTxt);
    els.clear.addEventListener('click', clearAll);

    $('#frt').addEventListener('input', e => {
        if (e.target.matches('.frt-input, .frt-textarea, input[type="checkbox"]')) saveState();
    });

    $$('.frt-presets .ibtn').forEach(btn =>
        btn.addEventListener('click', () => doPreset(btn.dataset.preset))
    );

    // Import/Export rules
    els.exportRules.addEventListener('click', () => {
        const data = JSON.stringify(getRules(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'find-replace-rules.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    });

    els.importRules.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'application/json';
        inp.onchange = () => {
            const file = inp.files && inp.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const arr = JSON.parse(reader.result);
                    if (!Array.isArray(arr)) throw new Error('Invalid rules JSON');
                    els.rules.innerHTML = '';
                    arr.forEach(r => addRule(r.find || '', r.repl || '', !!r.isRegex));
                    saveState();
                } catch (err) {
                    els.error.textContent = 'Import error: ' + err.message;
                }
            };
            reader.readAsText(file);
        };
        inp.click();
    });

    // Init
    loadState();
})();
