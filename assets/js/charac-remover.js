/*
 * Character Remover Tool v2.1
 * Author: TheBukitBesi
 * Fixes:
 * - Replaced inefficient global event listeners with targeted listeners for each control.
 * - Corrected regex sanitization for custom character and word removal.
 * - Optimized the order of operations in the main processing function.
 * - Ensured consistent state updates and feedback.
 */
(function () {
    // Abort if the main container is not found
    const root = document.getElementById('char-remover');
    if (!root) return;

    // Helper to query within the tool's scope
    const $ = (selector) => root.querySelector(selector);

    // --- DOM Element Cache ---
    const elements = {
        input: $('#cr-input'),
        output: $('#cr-output'),
        inputStats: $('#cr-input-stats'),
        outputStats: $('#cr-output-stats'),
        feedback: $('#cr-feedback'),
        status: $('#cr-status'),
        controlsForm: $('#cr-controls'),
        copyBtn: $('#cr-copy'),
        downloadBtn: $('#cr-download'),
        swapBtn: $('#cr-swap'),
        clearBtn: $('#cr-clear'),
    };

    const options = {
        removeNumbers: $('#cr-remove-numbers'),
        removeLetters: $('#cr-remove-letters'),
        removePunct: $('#cr-remove-punct'),
        removeSymbols: $('#cr-remove-symbols'),
        removeEmoji: $('#cr-remove-emoji'),
        stripHtml: $('#cr-strip-html'),
        removeUrls: $('#cr-remove-urls'),
        removeEmails: $('#cr-remove-emails'),
        removeDiacritics: $('#cr-remove-diacritics'),
        trimLines: $('#cr-trim-lines'),
        collapseSpaces: $('#cr-collapse-spaces'),
        removeLinebreaks: $('#cr-remove-linebreaks'),
        tabsToSpaces: $('#cr-tabs-to-spaces'),
        tabSize: $('#cr-tabsize'),
        uniqueLines: $('#cr-unique-lines'),
        uniqueCI: $('#cr-unique-ci'),
        sortLines: $('#cr-sort-lines'),
        customChars: $('#cr-custom-chars'),
        customWords: $('#cr-custom-words'),
        wordsCI: $('#cr-words-ci'),
        caseSelect: $('#cr-case'),
    };

    // --- Feature Detection ---
    const hasUnicodePropEscapes = (() => {
        try {
            new RegExp('\\p{L}', 'u');
            return true;
        } catch (e) {
            return false;
        }
    })();

    // --- Utility Functions ---
    const getStats = (text) => {
        const charCount = text.length;
        const wordCount = (text.match(/\S+/g) || []).length;
        const lineCount = charCount ? (text.match(/\n/g) || []).length + 1 : 0;
        const byteCount = new Blob([text]).size;
        return { charCount, wordCount, lineCount, byteCount };
    };

    const updateStats = () => {
        const inputStats = getStats(elements.input.value);
        const outputStats = getStats(elements.output.value);
        elements.inputStats.textContent = `Chars: ${inputStats.charCount} | Words: ${inputStats.wordCount} | Lines: ${inputStats.lineCount} | Bytes: ${inputStats.byteCount}`;
        elements.outputStats.textContent = `Chars: ${outputStats.charCount} | Words: ${outputStats.wordCount} | Lines: ${outputStats.lineCount} | Bytes: ${outputStats.byteCount}`;
    };

    const sanitizeForRegexClass = (s) => (s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const sanitizeForRegexBoundary = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const removeDiacritics = (str) =>
        str.normalize ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;

    const toTitleCase = (str) =>
        str.replace(/\b(\w)(\w*)/g, (_, first, rest) => first.toUpperCase() + rest.toLowerCase());
    
    const toTitleCaseUnicode = (str) =>
        str.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

    const showFeedback = (el, message, duration = 1500) => {
        el.textContent = message;
        setTimeout(() => { el.textContent = ''; }, duration);
    };

    // --- Main Processing Logic ---
    const processText = () => {
        let text = elements.input.value;

        // --- Pre-processing / Content Removal ---
        if (options.tabsToSpaces.checked) {
            const tabSize = Math.max(1, parseInt(options.tabSize.value, 10) || 2);
            text = text.replace(/\t/g, ' '.repeat(tabSize));
        }
        if (options.stripHtml.checked) text = text.replace(/<[^>]*>/g, '');
        if (options.removeUrls.checked) text = text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi, '');
        if (options.removeEmails.checked) text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '');
        if (options.removeDiacritics.checked) text = removeDiacritics(text);

        // --- Character Class Removals ---
        let removals = [];
        if (options.removeNumbers.checked) removals.push('0-9');
        if (options.removeLetters.checked) removals.push(hasUnicodePropEscapes ? '\\p{L}' : 'A-Za-z');
        if (options.removePunct.checked) removals.push(hasUnicodePropEscapes ? '\\p{P}' : '!"#$%&\'()*+,\\-./:;<=>?@[\\]^_`{|}~');
        if (options.removeSymbols.checked) removals.push(hasUnicodePropEscapes ? '\\p{S}' : '$\\+<=>^`|~');
        if (options.removeEmoji.checked) removals.push('\\u200d\\u2640-\\u2642\\u2600-\\u27bf\\u{1f300}-\\u{1f9ff}');
        
        const customChars = sanitizeForRegexClass(options.customChars.value);
        if (customChars) removals.push(customChars);

        if (removals.length > 0) {
            const regex = new RegExp(`[${removals.join('')}]`, hasUnicodePropEscapes ? 'gu' : 'g');
            text = text.replace(regex, '');
        }

        // --- Custom Word Removal ---
        const customWordsRaw = options.customWords.value.trim();
        if (customWordsRaw) {
            const words = customWordsRaw.split(/[\n,]+/).map(w => w.trim()).filter(Boolean);
            if (words.length) {
                const pattern = '\\b(' + words.map(sanitizeForRegexBoundary).join('|') + ')\\b';
                const flags = options.wordsCI.checked ? 'gi' : 'g';
                text = text.replace(new RegExp(pattern, flags), '');
            }
        }
        
        // --- Line-based Operations ---
        let lines = text.split(/\r\n|\r|\n/);

        if (options.trimLines.checked) lines = lines.map(line => line.trim());
        
        if (options.uniqueLines.checked) {
            const seen = new Set();
            lines = lines.filter(line => {
                const key = options.uniqueCI.checked ? line.toLowerCase() : line;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        
        const sortOrder = options.sortLines.value;
        if (sortOrder !== 'none') {
            lines.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            if (sortOrder === 'desc') lines.reverse();
        }

        text = lines.join('\n');
        
        // --- Post-processing / Final Formatting ---
        if (options.removeLinebreaks.checked) text = text.replace(/(\r\n|\n|\r)/g, ' ').trim();
        if (options.collapseSpaces.checked) text = text.replace(/[ ]{2,}/g, ' ');

        const caseTransform = options.caseSelect.value;
        if (caseTransform === 'upper') text = text.toUpperCase();
        else if (caseTransform === 'lower') text = text.toLowerCase();
        else if (caseTransform === 'title') {
            text = hasUnicodePropEscapes ? toTitleCaseUnicode(text) : toTitleCase(text);
        }

        elements.output.value = text;
        updateStats();
    };
    
    // --- Preset Application ---
    const applyPreset = (presetType) => {
        elements.controlsForm.reset();
        options.trimLines.checked = true; // Keep this default
        
        let text = elements.input.value;
        let result = '';

        if (presetType === 'digits') {
            result = text.replace(/\D/g, '');
        } else if (presetType === 'letters') {
            const re = hasUnicodePropEscapes ? /[^\p{L}]+/gu : /[^a-zA-Z]+/g;
            result = text.replace(re, ' ');
        } else if (presetType === 'alnum') {
            const re = hasUnicodePropEscapes ? /[^\p{L}\p{N}]+/gu : /[^a-zA-Z0-9]+/g;
            result = text.replace(re, ' ');
        } else if (presetType === 'alnumspace') {
            const re = hasUnicodePropEscapes ? /[^\p{L}\p{N}\s]+/gu : /[^a-zA-Z0-9\s]+/g;
            result = text.replace(re, ' ');
        }

        elements.output.value = result.replace(/\s{2,}/g, ' ').trim();
        updateStats();
        showFeedback(elements.status, 'Preset applied!', 1200);
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        // Main trigger: when user types in the input box
        elements.input.addEventListener('input', processText);

        // All other form controls trigger a re-process
        Object.values(options).forEach(el => {
            const eventType = (el.type === 'text' || el.type === 'number') ? 'input' : 'change';
            el.addEventListener(eventType, processText);
        });
        
        // Action Buttons
        elements.copyBtn.addEventListener('click', () => {
            if (!elements.output.value) return;
            navigator.clipboard.writeText(elements.output.value).then(() => {
                showFeedback(elements.feedback, 'Copied to clipboard!');
            }).catch(() => showFeedback(elements.feedback, 'Copy failed!'));
        });

        elements.downloadBtn.addEventListener('click', () => {
            const data = elements.output.value;
            const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cleaned-text.txt';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
        });

        elements.swapBtn.addEventListener('click', () => {
            const temp = elements.input.value;
            elements.input.value = elements.output.value;
            elements.output.value = temp;
            processText();
        });

        elements.clearBtn.addEventListener('click', () => {
            elements.input.value = '';
            elements.controlsForm.reset();
            options.trimLines.checked = true; // Restore default
            processText(); // This will clear the output and stats
            elements.input.focus();
        });
        
        // Preset Buttons
        root.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
        });
    };

    // --- Initialization ---
    setupEventListeners();
    processText(); // Initial run to set stats for empty state

})();
