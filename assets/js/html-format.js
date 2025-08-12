// --- JavaScript for HTML Formatter/Minifier Tool ---

// Function to clean and indent HTML (Simplified Beautifier)
function beautifyHTML(html) {
    // Basic regex based beautifier - might not handle all edge cases perfectly
    let indent = '  '; // Indentation string (2 spaces)
    let formatted = '';
    let tagStack = []; // Track tag nesting

    // Remove comments first for easier processing
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    // Add newlines after tags for processing
    html = html.replace(/(>)/g, '$1\n').replace(/(<br\s*\/?>)/g, '$1\n'); // Add newline after >, <br>
    html = html.replace(/<(\/?[a-z][^>]*?)>/gi, '<$1>\n'); // Newline after tags
    html = html.replace(/\n\s*\n/g, '\n'); // Collapse multiple empty lines

    // Trim lines and indent
    let lines = html.split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (!line) return; // Skip empty lines

        let closingTagMatch = line.match(/^<\/(.*)>$/);
        let openingTagMatch = line.match(/^<([a-z][^>]*?)>$/i);
        let selfClosingMatch = line.match(/^<([a-z][^>]*?)\/>$/i);

        // Handle indentation based on tag stack
        if (closingTagMatch) {
            if (tagStack.length > 0) {
                tagStack.pop(); // Pop last opening tag
            }
            formatted += indent.repeat(tagStack.length) + line + '\n';
        } else if (openingTagMatch && !openingTagMatch[1].startsWith('meta') && !openingTagMatch[1].startsWith('link') && !openingTagMatch[1].startsWith('input') && !openingTagMatch[1].startsWith('hr') && !openingTagMatch[1].startsWith('img') && !openingTagMatch[1].startsWith('br') && !openingTagMatch[1].startsWith('!--') /* Check it's not a comment start */) {
             // Check if it's a block element potentially? This is complex without a parser.
             // Simple approach: indent most opening tags.
             formatted += indent.repeat(tagStack.length) + line + '\n';
             tagStack.push(openingTagMatch[1]); // Push opening tag
        } else if (selfClosingMatch) {
             formatted += indent.repeat(tagStack.length) + line + '\n';
        }
        else {
            // Might be text content or tags on the same line
            formatted += indent.repeat(tagStack.length) + line + '\n';
        }
    });

    // Final cleanup of excessive newlines potentially added
    return formatted.trim().replace(/\n{3,}/g, '\n\n');
}


// Function to minify HTML
function minifyHTML(html) {
    // 1. Remove comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    // 2. Remove spaces between tags
    html = html.replace(/>\s+</g, '><');
    // 3. Remove newlines, tabs, and excessive spaces within the code, but be careful with attributes
    html = html.replace(/\n|\r|\t/g, ''); // Remove all standard whitespace chars
    html = html.replace(/\s\s+/g, ' '); // Replace multiple spaces with single space
    // 4. Trim leading/trailing whitespace
    return html.trim();
}

// Function to copy text to clipboard
function copyToClipboard(text) {
    // Use temporary textarea element
    let textArea = document.createElement("textarea");
    textArea.value = text;

    // Make it readonly to be safe.
    textArea.setAttribute('readonly', '');
    // Hide it off-screen
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';

    document.body.appendChild(textArea);
    textArea.focus();

    // Check if the browser supports Clipboard API
    if (navigator.clipboard && textArea.value) {
      navigator.clipboard.writeText(textArea.value)
        .then(() => {
           // Success feedback (optional)
           // alert('Copied!');
        })
        .catch(err => {
          console.error('Clipboard API error:', err);
          // Fallback for older browsers might be needed if Clipboard API fails
          try {
            textArea.select();
            document.execCommand('copy');
            // alert('Copied (fallback)!');
          } catch (err2) {
            console.error('Fallback copy error:', err2);
            alert('Failed to copy. Please copy manually.');
          }
        });
    } else {
        // Fallback for browsers without Clipboard API
        try {
           textArea.select();
           document.execCommand('copy');
           // alert('Copied (fallback)!');
        } catch (err) {
          console.error('Fallback copy error:', err);
          alert('Failed to copy. Please copy manually.');
        }
    }

    // Clean up the temporary element
    document.body.removeChild(textArea);
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const inputTextArea = document.getElementById('inputHtml');
    const outputTextArea = document.getElementById('outputHtml');
    const beautifyBtn = document.getElementById('beautifyBtn');
    const minifyBtn = document.getElementById('minifyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn'); // Get the copy button

    if (beautifyBtn) {
        beautifyBtn.addEventListener('click', () => {
            if (inputTextArea && inputTextArea.value) {
                outputTextArea.value = beautifyHTML(inputTextArea.value);
                 if (copyBtn) copyBtn.style.display = 'inline-block'; // Show copy button
            } else {
                 outputTextArea.value = '';
                 if (copyBtn) copyBtn.style.display = 'none';
            }
        });
    }

    if (minifyBtn) {
        minifyBtn.addEventListener('click', () => {
            if (inputTextArea && inputTextArea.value) {
                outputTextArea.value = minifyHTML(inputTextArea.value);
                 if (copyBtn) copyBtn.style.display = 'inline-block';
            } else {
                outputTextArea.value = '';
                 if (copyBtn) copyBtn.style.display = 'none';
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            inputTextArea.value = '';
            outputTextArea.value = '';
             if (copyBtn) copyBtn.style.display = 'none';
        });
    }

     if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (outputTextArea && outputTextArea.value) {
                copyToClipboard(outputTextArea.value);
                // Optional: Provide user feedback
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }
        });
    }

    // Make copy button visible only when there's output
    outputTextArea.addEventListener('input', () => {
        if (copyBtn && outputTextArea.value.trim() !== '') {
            copyBtn.style.display = 'inline-block';
        } else if (copyBtn) {
            copyBtn.style.display = 'none';
        }
    });

});
