// Video Schema Generator JavaScript
(function() {
    'use strict';

    // --- GRANDMASTER HELPER FUNCTION ---
    // This calculates the correct time and adds the local timezone (e.g., +08:00)
    function getLocalISOString(dateInput) {
        // Create a date object from the input, set to midnight local time
        const date = new Date(dateInput + 'T00:00:00'); 
        
        // If date is invalid (empty), fallback to right now
        if (isNaN(date.getTime())) {
            return new Date().toISOString(); 
        }

        const offset = date.getTimezoneOffset();
        const absOffset = Math.abs(offset);
        const h = String(Math.floor(absOffset / 60)).padStart(2, '0');
        const m = String(absOffset % 60).padStart(2, '0');
        const sign = offset > 0 ? '-' : '+'; // Inverted in JS

        return date.getFullYear() + '-' +
               String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0') + 'T' +
               // Defaulting to 08:00 AM (common for publishing) or keep 00:00
               // Here we use the actual hours set above (00:00:00)
               String(date.getHours()).padStart(2, '0') + ':' +
               String(date.getMinutes()).padStart(2, '0') + ':' +
               String(date.getSeconds()).padStart(2, '0') +
               sign + h + ':' + m;
    }

    // Form submission handler
    document.getElementById('videoSchemaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        generateSchema();
    });

    // Generate schema function
    function generateSchema() {
        
        // Get the raw date from the picker
        const rawDate = document.getElementById('uploadDate').value;
        
        // Use our new Helper Function to process the date
        const processedDate = getLocalISOString(rawDate);

        const formData = {
            name: document.getElementById('videoName').value,
            description: document.getElementById('videoDescription').value,
            thumbnailUrl: document.getElementById('thumbnailUrl').value,
            uploadDate: processedDate, // <--- CHANGED THIS LINE
            duration: document.getElementById('duration').value,
            contentUrl: document.getElementById('videoUrl').value,
            embedUrl: document.getElementById('embedUrl').value || document.getElementById('videoUrl').value
        };

        // Create schema object
        const schema = {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": formData.name,
            "description": formData.description,
            "thumbnailUrl": formData.thumbnailUrl,
            "uploadDate": formData.uploadDate,
            "duration": formData.duration,
            "contentUrl": formData.contentUrl,
            "embedUrl": formData.embedUrl
        };

        // Add optional content URL if different from main URL
        const altContentUrl = document.getElementById('contentUrl').value;
        if (altContentUrl && altContentUrl !== formData.contentUrl) {
            schema.contentUrl = altContentUrl;
        }

        // Display generated schema
        const schemaJson = JSON.stringify(schema, null, 2);
        const scriptTag = '<script type="application/ld+json">\n' + schemaJson + '\n<\/script>';

        document.getElementById('generatedSchema').textContent = scriptTag;
        document.getElementById('outputSection').style.display = 'block';
        document.getElementById('successMessage').style.display = 'block';

        // Hide success message after 3 seconds
        setTimeout(function() {
            document.getElementById('successMessage').style.display = 'none';
        }, 3000);

        // Scroll to output
        document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
    }

    // Copy to clipboard function
    window.copyToClipboard = function() {
        const schemaText = document.getElementById('generatedSchema').textContent;
        const textarea = document.createElement('textarea');
        textarea.value = schemaText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        // Update button text
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(function() {
            copyBtn.textContent = originalText;
        }, 2000);
    };

    // Reset form function
    window.resetForm = function() {
        document.getElementById('videoSchemaForm').reset();
        document.getElementById('outputSection').style.display = 'none';
        document.getElementById('successMessage').style.display = 'none';
        // Reset date to today after form reset
        document.getElementById('uploadDate').valueAsDate = new Date();
    };

    // Set today's date as default
    document.getElementById('uploadDate').valueAsDate = new Date();
})();