// html-formatter.js

(function() {
    // Library sources
    const PRETTIER_CDN = "https://unpkg.com/prettier@2.8.4/standalone.js";
    const HTML_PARSER_CDN = "https://unpkg.com/prettier@2.8.4/parser-html.js";
    const DOMPURIFY_CDN = "https://unpkg.com/dompurify@3.0.1/dist/purify.min.js";
    const MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

    // Element selectors
    const getEl = (id) => document.getElementById(id);
    const inputCodeEl = getEl('input-code');
    const outputCodeEl = getEl('output-code');
    const processBtn = getEl('process-btn');
    const copyBtn = getEl('copy-btn');
    const cleanHtmlCheck = getEl('clean-html');
    const statusMessageEl = getEl('status-message');
    const beautifyOptionsEl = getEl('beautify-options');
    const modeBeautifyRadio = getEl('mode-beautify');

    // --- Core Logic with Fixes ---

    const loadedScripts = {};
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (loadedScripts[src]) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => { loadedScripts[src] = true; resolve(); };
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
    }

    async function beautify(html) {
        // This function now ONLY formats. It expects valid HTML.
        await Promise.all([loadScript(PRETTIER_CDN), loadScript(HTML_PARSER_CDN)]);
        return prettier.format(html, {
            parser: "html",
            plugins: prettierPlugins,
            printWidth: 120,
            tabWidth: 2,
            useTabs: false,
        });
    }

    async function sanitize(html) {
        // This function now ONLY sanitizes.
        await loadScript(DOMPURIFY_CDN);
        return DOMPurify.sanitize(html);
    }

    async function convertTextToHtml(text) {
        // **FIXED:** Removed faulty .replace() logic. Relies on the robust Marked engine.
        await loadScript(MARKED_CDN);
        const rawHtml = marked.parse(text);
        // After converting, beautify the result for clean output.
        return beautify(rawHtml);
    }

    // --- UI & Event Handlers ---

    function showStatus(message, type = 'info') {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-${type} show`;
        setTimeout(() => { statusMessageEl.className = ''; }, 4000);
    }

    processBtn.addEventListener('click', async () => {
        const input = inputCodeEl.value.trim();
        if (!input) {
            showStatus('Input is empty.', 'error');
            return;
        }

        processBtn.disabled = true;
        processBtn.textContent = 'Processing...';
        outputCodeEl.value = '';

        try {
            let result = '';
            if (modeBeautifyRadio.checked) {
                let htmlToProcess = input;
                // Step 1: Sanitize IF the user explicitly requests it.
                if (cleanHtmlCheck.checked) {
                    htmlToProcess = await sanitize(htmlToProcess);
                }
                // Step 2: Try to beautify the (potentially sanitized) HTML.
                result = await beautify(htmlToProcess);

            } else { // Convert Mode
                result = await convertTextToHtml(input);
            }
            
            outputCodeEl.value = result;
            if (result) showStatus('Processing complete!', 'success');

        } catch (error) {
            // **NEW:** Graceful error handling.
            console.error("Formatting Error:", error);
            const friendlyError = "Error: Input is not valid HTML. The formatter requires standards-compliant code with no unclosed tags or invalid nesting.";
            outputCodeEl.value = friendlyError;
            showStatus("Formatting failed. Please check your input HTML.", "error");
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = 'Process Code';
        }
    });

    copyBtn.addEventListener('click', () => {
        const output = outputCodeEl.value;
        if (!output || output.startsWith('Error:')) return;
        navigator.clipboard.writeText(output).then(
            () => showStatus('Copied to clipboard!', 'success'),
            () => showStatus('Failed to copy.', 'error')
        );
    });
    
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            beautifyOptionsEl.style.display = modeBeautifyRadio.checked ? 'flex' : 'none';
            inputCodeEl.placeholder = modeBeautifyRadio.checked 
                ? '' 
                : 'Type plain text or markdown here...';
        });
    });
})();
