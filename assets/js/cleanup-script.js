// AdSense Cleanup Script
// Watches for dynamically added ad containers and removes them if they are empty or unfilled.

document.addEventListener('DOMContentLoaded', () => {
    const cleanupAds = (mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    // Target the ad container, typically an <ins> element
                    if (node.nodeType === 1 && node.classList.contains('adsbygoogle')) {
                        // Give Ad a moment to fill the ad
                        setTimeout(() => {
                            // Check if the container is empty or marked as unfilled
                            const isUnfilled = node.getAttribute('data-ad-status') === 'unfilled';
                            const isEmpty = node.innerHTML.trim() === '';

                            if (isUnfilled || isEmpty) {
                                console.log('AdSense Cleanup: Removing empty ad container.', node);
                                // For better layout stability, hide instead of remove
                                node.style.display = 'none';
                                
                                // Optional: If the parent is now empty, hide it too
                                const parent = node.parentElement;
                                if (parent && parent.innerText.trim() === '') {
                                    parent.style.display = 'none';
                                }
                            }
                        }, 2000); // 2-second delay to check for ad fill
                    }
                });
            }
        }
    };

    const observer = new MutationObserver(cleanupAds);
    const config = { childList: true, subtree: true };

    observer.observe(document.body, config);
    console.log('AdSense Cleanup Observer is active.');
});
