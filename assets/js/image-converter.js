            if (convertedFiles.length > 1) downloadAllWrap.hidden = false;
        });
        zipBtn.addEventListener('click', () => {
            const zip = new JSZip();
            convertedFiles.forEach(f => zip.file(f.name, dataURLtoBlob(f.dataUrl)));
            zip.generateAsync({ type: "blob" }).then(content => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(content);
                a.download = `tbb-converted-images.zip`;
                a.click();
                URL.revokeObjectURL(a.href);
            });
        });

        // Initial state
        qualityWrap.hidden = !['image/jpeg', 'image/webp'].includes(formatSelect.value);
        convertBtn.disabled = true;
        updateQualitySlider();
    });
