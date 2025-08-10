// html-formatter.js

(function() {
    // --- Library Imports via CDN ---
    // These are loaded dynamically, no need to add them to your HTML
    const PRETTIER_CDN = "https://unpkg.com/prettier@2.8.4/standalone.js";
    const HTML_PARSER_CDN = "https://unpkg.com/prettier@2.8.4/parser-html.js";
    const DOMPURIFY_CDN = "https://unpkg.com/dompurify@3.0.1/dist/purify.min.js";
    const MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

    // --- Element Selectors ---
    const getEl = (id) => document.getElementById(id);
    const inputCodeEl = getEl('input-code');
    const outputCodeEl = getEl('output-code');
    const processBtn = getEl('process-btn');
    const copyBtn = getEl('copy-btn');
    const cleanHtmlCheck = getEl('clean-html');
    const statusMessageEl = getEl('status-message');
    const beautifyOptionsEl = getEl('beautify-options');
    const modeBeautifyRadio = getEl('mode-beautify');
    const modeConvertRadio = getEl('mode-convert');

    // --- Dynamic Library Loader ---
    // Loads libraries on demand to keep initial page load fast
    const loadedScripts = {};
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (loadedScripts[src]) {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loadedScripts[src] = true;
                resolve();
            };
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
    }

    // --- Core Functions ---
    async function formatHtml(rawHtml, shouldClean) {
        try {
            await Promise.all([
                loadScript(PRETTIER_CDN),
                loadScript(HTML_PARSER_CDN),
                loadScript(DOMPURIFY_CDN)
            ]);
            
            let htmlToFormat = rawHtml;
            if (shouldClean) {
                // DOMPurify removes anything that could be a security risk,
                // like <script> tags, onclick events, etc.
                htmlToFormat = DOMPurify.sanitize(rawHtml);
                showStatus('HTML sanitized.', 'success');
            }

            // Prettier formats the code beautifully
            return prettier.format(htmlToFormat, {
                parser: "html",
                plugins: prettierPlugins,
                printWidth: 100,
                tabWidth: 2,
                useTabs: false,
            });
        } catch (error) {
            showStatus(`Formatting Error: ${error.message}`, 'error');
            throw error;
        }
    }

    async function convertTextToHtml(text) {
        try {
            await Promise.all([
                loadScript(MARKED_CDN),
                loadScript(PRETTIER_CDN),
                loadScript(HTML_PARSER_CDN)
            ]);

            // Marked converts Markdown-style text to raw HTML
            const rawHtml = marked.parse(text
                .replace(/^# /gm, '<h1>')
                .replace(/^## /gm, '<h2>')
                .replace(/^### /gm, '<h3>')
                .replace(/\n/g, '<br>') // Basic paragraph handling
            );

            // Then we beautify that HTML with Prettier
            return formatHtml(rawHtml, false); // No need to clean generated HTML
        } catch (error) {
            showStatus(`Conversion Error: ${error.message}`, 'error');
            throw error;
        }
    }

    // --- UI & Event Handlers ---
    function showStatus(message, type = 'info') {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-${type}`;
        setTimeout(() => {
            statusMessageEl.textContent = '';
            statusMessageEl.className = '';
        }, 3000);
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
                result = await formatHtml(input, cleanHtmlCheck.checked);
            } else {
                result = await convertTextToHtml(input);
            }
            outputCodeEl.value = result;
            showStatus('Processing complete!', 'success');
        } catch (error) {
            // Error is already shown by the core functions
            console.error(error);
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = 'Process Code';
        }
    });

    copyBtn.addEventListener('click', () => {
        const output = outputCodeEl.value;
        if (!output) return;
        navigator.clipboard.writeText(output).then(() => {
            showStatus('Copied to clipboard!', 'success');
        }, () => {
            showStatus('Failed to copy.', 'error');
        });
    });
    
    // Toggle options based on mode
    [modeBeautifyRadio, modeConvertRadio].forEach(radio => {
        radio.addEventListener('change', () => {
            beautifyOptionsEl.style.display = modeBeautifyRadio.checked ? 'block' : 'none';
            inputCodeEl.placeholder = modeBeautifyRadio.checked 
                ? '' 
                : 'Type plain text or markdown here...';
        });
    });

})();
