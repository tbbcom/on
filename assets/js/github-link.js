(function() {
    // --- Element Cache ---
    // Cache all DOM elements we need to interact with for better performance.
    const urlInput = document.getElementById('githubUrl');
    const outputDiv = document.getElementById('outputLink');
    const messageDiv = document.getElementById('message');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');

    // --- Core Functions ---

    /**
     * Displays a message to the user.
     * @param {string} text - The message to show.
     * @param {string} type - The message type, either 'error' or 'success'.
     */
    function showMessage(text, type = 'error') {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`; // The class also controls visibility
    }

    /**
     * Clears the input field and all output/messages.
     */
    function clearTool() {
        urlInput.value = '';
        outputDiv.style.display = 'none';
        outputDiv.innerHTML = '';
        messageDiv.style.display = 'none';
        urlInput.focus();
    }

    /**
     * Converts the raw GitHub URL to a jsDelivr CDN link.
     */
    function convertToJsDelivr() {
        const input = urlInput.value.trim();
        messageDiv.style.display = 'none'; // Hide previous messages on new attempt

        if (!input) {
            showMessage('Please paste a URL first.');
            return;
        }

        // Use a more robust regex to validate the base URL
        if (!/^https?:\/\/raw\.githubusercontent\.com\//.test(input)) {
            showMessage('Invalid URL. Please use a "raw.githubusercontent.com" link.');
            return;
        }

        try {
            const url = new URL(input);
            const pathParts = url.pathname.split('/').filter(p => p);

            if (pathParts.length < 3) { // User, Repo, and at least one file/branch part
                showMessage('Invalid URL structure. It should be user/repo/branch/file.');
                return;
            }

            const user = pathParts[0];
            const repo = pathParts[1];
            const branch = pathParts[2];
            const filePath = pathParts.slice(3).join('/');
            const cdnUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${filePath}`;

            outputDiv.style.display = 'block';
            outputDiv.innerHTML = `
                <strong>✅ Your jsDelivr CDN Link:</strong><br>
                <a href="${cdnUrl}" target="_blank" rel="noopener noreferrer">${cdnUrl}</a>
                <br>
                <button id="copyBtn" class="copy-btn" data-url="${cdnUrl}" style="margin-top:10px;">Copy Link</button>
            `;
        } catch (e) {
            showMessage('The URL is malformed. Please check and try again.');
        }
    }
    
    /**
     * Copies text to the clipboard and provides user feedback.
     * @param {string} url - The URL to copy.
     * @param {HTMLElement} buttonElement - The button that was clicked.
     */
    function copyLink(url, buttonElement) {
        if (!navigator.clipboard) {
            // Fallback for very old browsers or insecure contexts (http)
            prompt('Could not copy automatically. Please copy this link:', url);
            return;
        }

        navigator.clipboard.writeText(url).then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copied!';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            prompt('Copy failed. Please copy this link manually:', url);
        });
    }

    // --- Event Listeners Setup ---
    // This is the modern, preferred way to handle events.

    // 1. Listen for clicks on the main "Generate" and "Clear" buttons.
    generateBtn.addEventListener('click', convertToJsDelivr);
    clearBtn.addEventListener('click', clearTool);

    // 2. Listen for the "Enter" key in the input field.
    urlInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevents form submission
            convertToJsDelivr();
        }
    });

    // 3. Use Event Delegation for the dynamically created "Copy" button.
    // This single listener on the parent div efficiently handles clicks for any
    // child element, including ones that don't exist yet.
    outputDiv.addEventListener('click', function(event) {
        // Check if the clicked element is our copy button
        if (event.target && event.target.id === 'copyBtn') {
            const urlToCopy = event.target.dataset.url; // Get URL from data attribute
            copyLink(urlToCopy, event.target);
        }
    });

})();
