(function() {
    // --- Element Cache ---
    const urlInput = document.getElementById('githubUrl');
    const outputDiv = document.getElementById('outputLink');
    const messageDiv = document.getElementById('message');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');

    // --- Core Functions ---

    function showMessage(text, type = 'error') {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
    }

    function clearTool() {
        urlInput.value = '';
        outputDiv.style.display = 'none';
        outputDiv.innerHTML = '';
        messageDiv.style.display = 'none';
        urlInput.focus();
    }
    function convertToJsDelivr() {
        const input = urlInput.value.trim();
        messageDiv.style.display = 'none';

        if (!input) {
            showMessage('Please paste a GitHub URL first.');
            return;
        }

        let user, repo, branch, filePath;
        if (input.includes('raw.githubusercontent.com')) {
            // Pattern 1: Handle raw links
            try {
                const url = new URL(input);
                const pathParts = url.pathname.split('/').filter(Boolean);
                if (pathParts.length < 4) throw new Error('Invalid raw URL structure.');
                [user, repo, branch, ...filePath] = pathParts;
                filePath = filePath.join('/');
            } catch (e) {
                showMessage('Invalid raw.githubusercontent.com URL.');
                return;
            }

        } else if (input.includes('github.com') && input.includes('/blob/')) {
            // Pattern 2: Handle standard repo links (e.g., /user/repo/blob/branch/file.js)
            try {
                const url = new URL(input);
                const pathParts = url.pathname.split('/blob/');
                if (pathParts.length < 2) throw new Error('Invalid GitHub repo URL structure.');
                
                const repoInfo = pathParts[0].split('/').filter(Boolean);
                const fileInfo = pathParts[1].split('/');

                if (repoInfo.length < 2 || fileInfo.length < 2) throw new Error('Incomplete GitHub repo URL.');

                user = repoInfo[0];
                repo = repoInfo[1];
                branch = fileInfo[0];
                filePath = fileInfo.slice(1).join('/');

            } catch (e) {
                showMessage('Invalid github.com file URL. Ensure it contains "/blob/".');
                return;
            }
        } else {
            // If neither pattern matches
            showMessage('Invalid URL. Please use a standard GitHub file or raw link.');
            return;
        }
        
        // If parsing failed for any reason
        if (!user || !repo || !branch || !filePath) {
            showMessage('Could not parse the URL. Please check the format.');
            return;
        }

        // --- Construct the final URL (this part is the same for both inputs) ---
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${filePath}`;

        outputDiv.style.display = 'block';
        outputDiv.innerHTML = `
            <strong>✅ Your jsDelivr CDN Link:</strong><br>
            <a href="${cdnUrl}" target="_blank" rel="noopener noreferrer">${cdnUrl}</a>
            <br>
            <button id="copyBtn" class="copy-btn" data-url="${cdnUrl}" style="margin-top:10px;">Copy Link</button>
        `;
    }

    function copyLink(url, buttonElement) {
        if (!navigator.clipboard) {
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

    // --- Event Listeners Setup (No changes needed here) ---
    generateBtn.addEventListener('click', convertToJsDelivr);
    clearBtn.addEventListener('click', clearTool);

    urlInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            convertToJsDelivr();
        }
    });

    outputDiv.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'copyBtn') {
            const urlToCopy = event.target.dataset.url;
            copyLink(urlToCopy, event.target);
        }
    });

})();
