/*
 * Any2PDF – Vanilla JS, Client-Side Converter
 * Refined & Updated by Gemini for TheBukitBesi
 * Version: 2.0.0 (August 2025)
 */
(function() {
    'use strict';

    // Centralized Dependencies for easy updates
    const DEPS = {
        // PDF.js for reading PDFs (v4+)
        pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs",
        pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs",
        // Mammoth for DOCX to HTML/Text
        mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
        // docx for creating DOCX files
        docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/dist/docx.min.js",
        // JSZip for creating ZIP files (for PDF -> PNGs)
        jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        // jsPDF & html2canvas for creating PDFs from images/HTML
        jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
        html2canvas: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
    };

    // --- DOM Elements & State ---
    const els = {
        root: document.getElementById('ix-pdfconverter'),
        drop: document.getElementById('ix-drop'),
        file: document.getElementById('ix-file'),
        to: document.getElementById('ix-to'),
        convert: document.getElementById('ix-convert'),
        clear: document.getElementById('ix-clear'),
        queue: document.getElementById('ix-queue'),
        log: document.getElementById('ix-log'),
        quickBtns: document.querySelectorAll('.ix-quick-btn'),
        opt: {
            combine: document.getElementById('ix-combine'),
            autoname: document.getElementById('ix-autoname'),
            pagesize: document.getElementById('ix-pagesize'),
            orientation: document.getElementById('ix-orientation'),
            margin: document.getElementById('ix-margin')
        }
    };

    const state = {
        files: [],
        busy: false,
        loadedDeps: new Set() // Track loaded scripts
    };

    const SUPPORTED = {
        images: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
        docx: ['docx'],
        pdf: ['pdf'],
        text: ['txt', 'md', 'csv', 'log'],
        html: ['html', 'htm']
    };

    // --- Utility Functions ---
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    function log(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'style="color: #e53e3e;"' : '';
        els.log.innerHTML = `<div class="ix-chip" ${color}>[${time}] ${msg}</div>` + els.log.innerHTML;
    }

    function humanBytes(n = 0) {
        if (!n) return '0 B';
        const u = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        while (n >= 1024 && i < u.length - 1) {
            n /= 1024;
            i++;
        }
        return `${n.toFixed(n > 100 ? 0 : n > 10 ? 1 : 2)} ${u[i]}`;
    }

    function getFileMeta(name = '') {
        const i = name.lastIndexOf('.');
        const ext = i > -1 ? name.slice(i + 1).toLowerCase() : '';
        const base = i > -1 ? name.slice(0, i) : name;
        return { base, ext, name };
    }

    function createOutName(inName, outExt, combined = false) {
        const { base } = getFileMeta(inName);
        if (els.opt.autoname.checked) {
            return combined ? `${base}-combined.${outExt}` : `${base}.${outExt}`;
        }
        return combined ? `combined-output.${outExt}` : `${base}.${outExt}`;
    }

    function downloadBlob(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 1000);
    }

    function loadImage(src) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = src;
        });
    }

    // --- UI & State Management ---
    function createItem(file) {
        const item = document.createElement('div');
        item.className = 'ix-item';
        item.innerHTML = `
      <div>
        <div class="ix-item-name">${file.name}</div>
        <div class="ix-item-meta">${humanBytes(file.size)}</div>
        <div class="ix-progress"><b></b></div>
      </div>
      <div class="ix-item-acts">
        <button class="ibtn ibutton-ghost ix-remove">Remove</button>
      </div>`;
        $('.ix-remove', item).addEventListener('click', () => {
            state.files = state.files.filter(f => f !== file);
            item.remove();
        });
        els.queue.appendChild(item);
        return item;
    }

    function setProgress(item, pct) {
        const bar = $('.ix-progress > b', item);
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }

    function enqueue(files) {
        if (!files.length) return;
        files.forEach(f => {
            state.files.push(f);
            createItem(f);
        });
        log(`${files.length} file(s) added.`);
    }

    // --- Dependency Loader ---
    async function loadDependency(name) {
        if (state.loadedDeps.has(name)) return;

        const url = DEPS[name];
        if (!url) throw new Error(`Dependency '${name}' not defined.`);

        if (url.endsWith('.mjs')) { // Handle ES Modules
            if (!window[name]) {
                const module = await
                import (url);
                window[name] = module;
            }
        } else { // Handle traditional scripts
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = url;
                s.async = true;
                s.onload = resolve;
                s.onerror = () => reject(new Error('Failed to load ' + url));
                document.head.appendChild(s);
            });
        }
        state.loadedDeps.add(name);
    }

    // --- FileReader Promises ---
    const readAs = (file, method) => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr[method](file);
    });
    const readAsArrayBuffer = (file) => readAs(file, 'readAsArrayBuffer');
    const readAsText = (file) => readAs(file, 'readAsText');
    const readAsDataURL = (file) => readAs(file, 'readAsDataURL');


    // --- Core Converters ---

    // 1) Images -> PDF
    async function imagesToPdf(files, item) {
        await loadDependency('jspdf');
        const { jsPDF } = window.jspdf;

        const opt = {
            pagesize: els.opt.pagesize.value,
            orientation: els.opt.orientation.value,
            margin: parseInt(els.opt.margin.value, 10) || 10
        };

        const images = [];
        for (let i = 0; i < files.length; i++) {
            const dataURL = await readAsDataURL(files[i]);
            images.push({ file: files[i], dataURL });
            setProgress(item, 10 + Math.round((i / files.length) * 30));
        }

        const mmToPt = (mm) => (mm * 72) / 25.4;
        const marginPt = mmToPt(opt.margin);
        const format = opt.pagesize === 'letter' ? 'letter' : 'a4';

        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format });
        if (doc.hotfixes) doc.hotfixes.splice(doc.hotfixes.indexOf("px_scaling"), 1); // fix for some versions

        const pageSizePt = (fmt, orient) => {
            const sizes = { a4: { w: 595.28, h: 841.89 }, letter: { w: 612, h: 792 } };
            const page = sizes[fmt] || sizes.a4;
            return orient === 'landscape' ? { w: page.h, h: page.w } : page;
        };

        for (let i = 0; i < images.length; i++) {
            const imgData = await loadImage(images[i].dataURL);
            let pageOrientation = opt.orientation === 'auto' ? (imgData.width > imgData.height ? 'landscape' : 'portrait') : opt.orientation;

            if (i > 0) doc.addPage(format, pageOrientation);
            else doc.setPage(1);

            const page = pageSizePt(format, pageOrientation);
            const wMax = page.w - marginPt * 2;
            const hMax = page.h - marginPt * 2;
            const scale = Math.min(wMax / imgData.width, hMax / imgData.height, 1);
            const w = imgData.width * scale;
            const h = imgData.height * scale;
            const x = (page.w - w) / 2;
            const y = (page.h - h) / 2;

            doc.addImage(images[i].dataURL, 'JPEG', x, y, w, h);
            setProgress(item, 50 + Math.round((i / images.length) * 40));
        }

        const blob = doc.output('blob');
        const name = createOutName(images[0].file.name, 'pdf', files.length > 1);
        return { blob, name };
    }

    // 2) DOCX -> HTML/Text
    async function docxTo(file, item, format) {
        await loadDependency('mammoth');
        const arrayBuffer = await readAsArrayBuffer(file);
        setProgress(item, 25);
        let result, blob;

        if (format === 'html') {
            result = await mammoth.convertToHtml({ arrayBuffer });
            const html = `<!doctype html><meta charset="utf-8"><title>${file.name}</title><body>${result.value}</body>`;
            blob = new Blob([html], { type: 'text/html' });
        } else {
            result = await mammoth.extractRawText({ arrayBuffer });
            blob = new Blob([result.value || ''], { type: 'text/plain' });
        }
        setProgress(item, 80);
        return { blob, name: createOutName(file.name, format) };
    }

    // 3) DOCX -> PDF (via HTML)
    async function docxToPdf(file, item) {
        // Step 1: DOCX -> HTML
        const { blob: htmlBlob } = await docxTo(file, item, 'html');
        const html = await htmlBlob.text();
        setProgress(item, 50);

        // Step 2: HTML -> PDF
        return await htmlToPdf(html, file.name, item, 50);
    }
    
    // 4) HTML or TXT -> PDF (Generic handler)
    async function contentToPdf(file, item, isHtml=false) {
        const content = await readAsText(file);
        let element;
        if (isHtml) {
            element = document.createElement('div');
            element.innerHTML = content;
        } else {
            element = document.createElement('pre');
            element.textContent = content;
            element.style.whiteSpace = 'pre-wrap';
            element.style.fontFamily = 'monospace';
        }
        return await htmlToPdf(element, file.name, item);
    }


    // 5) PDF -> TXT/HTML
    async function pdfToText(file, item, asHtml = false) {
        await loadDependency('pdfjs');
        const pdfjsLib = window.pdfjs.default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = DEPS.pdfjsWorker;

        const data = await readAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ');
            text += '\n\n';
            setProgress(item, 10 + Math.round((i / pdf.numPages) * 70));
        }

        if (asHtml) {
            const safeText = text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title></head><body><pre>${safeText}</pre></body></html>`;
            return { blob: new Blob([html], { type: 'text/html' }), name: createOutName(file.name, 'html') };
        }
        return { blob: new Blob([text], { type: 'text/plain' }), name: createOutName(file.name, 'txt') };
    }
    
    // 6) PDF -> DOCX (via TXT)
    async function pdfToDocx(file, item) {
        const { blob: txtBlob } = await pdfToText(file, item, false);
        const text = await txtBlob.text();
        setProgress(item, 85);
        return await textToDocx(text, file.name, item, 85);
    }

    // 7) PDF -> PNGs
    async function pdfToPngs(file, item) {
        await Promise.all([loadDependency('pdfjs'), loadDependency('jszip')]);
        const pdfjsLib = window.pdfjs.default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = DEPS.pdfjsWorker;

        const data = await readAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const zip = new JSZip();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            zip.file(`page-${String(i).padStart(3, '0')}.png`, blob);
            setProgress(item, 10 + Math.round((i / pdf.numPages) * 80));
        }
        const content = await zip.generateAsync({ type: 'blob' });
        return { blob: content, name: createOutName(file.name, 'zip') };
    }
    
    // 8) HTML Element -> PDF
    async function htmlToPdf(elementOrHtml, baseFileName, item, progressStart = 0) {
        await Promise.all([loadDependency('jspdf'), loadDependency('html2canvas')]);
        
        const holder = document.createElement('div');
        holder.style.width = '210mm'; // A4 width
        holder.style.background = '#fff';
        holder.style.padding = '10mm';
        
        if (typeof elementOrHtml === 'string') {
            holder.innerHTML = elementOrHtml;
        } else {
            holder.appendChild(elementOrHtml);
        }
        document.body.appendChild(holder);

        const opt = {
            margin: parseInt(els.opt.margin.value, 10) || 10,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: {
                unit: 'mm',
                format: els.opt.pagesize.value === 'letter' ? 'letter' : 'a4',
                orientation: els.opt.orientation.value === 'landscape' ? 'landscape' : 'portrait'
            }
        };

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(opt.jsPDF);
        const canvas = await html2canvas(holder, opt.html2canvas);
        
        const imgData = canvas.toDataURL(opt.image.type, opt.image.quality);
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth() - (opt.margin * 2);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        doc.addImage(imgData, 'JPEG', opt.margin, opt.margin, pdfWidth, pdfHeight);
        
        document.body.removeChild(holder);
        setProgress(item, progressStart + 45);
        
        return { blob: doc.output('blob'), name: createOutName(baseFileName, 'pdf') };
    }

    // 9) Text content -> DOCX
    async function textToDocx(text, baseFileName, item, progressStart = 0) {
        await loadDependency('docx');
        const paragraphs = (text || '').split(/\r?\n/).map(line =>
            new docx.Paragraph({ children: [new docx.TextRun(line)] })
        );
        const doc = new docx.Document({ sections: [{ children: paragraphs }] });
        const blob = await docx.Packer.toBlob(doc);
        setProgress(item, progressStart + 10);
        return { blob, name: createOutName(baseFileName, 'docx') };
    }


    // --- Main Process ---
    async function convertFile(file, to, item) {
        const { ext } = getFileMeta(file.name);
        setProgress(item, 5);
        if (!ext) throw new Error('Unknown file type');

        const isImg = SUPPORTED.images.includes(ext);
        const isDocx = SUPPORTED.docx.includes(ext);
        const isPdf = SUPPORTED.pdf.includes(ext);
        const isText = SUPPORTED.text.includes(ext);
        const isHtml = SUPPORTED.html.includes(ext);

        if (to === 'pdf') {
            if (isImg) return await imagesToPdf([file], item);
            if (isDocx) return await docxToPdf(file, item);
            if (isText) return await contentToPdf(file, item, false);
            if (isHtml) return await contentToPdf(file, item, true);
        }
        if (to === 'docx') {
            if (isPdf) return await pdfToDocx(file, item);
            if (isText) return await textToDocx(await readAsText(file), file.name, item);
        }
        if (to === 'txt') {
            if (isPdf) return await pdfToText(file, item, false);
            if (isDocx) return await docxTo(file, item, 'txt');
        }
        if (to === 'html') {
            if (isPdf) return await pdfToText(file, item, true);
            if (isDocx) return await docxTo(file, item, 'html');
        }
        if (to === 'png' && isPdf) {
            return await pdfToPngs(file, item);
        }

        throw new Error(`Unsupported route: ${ext} -> ${to}`);
    }

    async function processQueue() {
        if (state.busy) return;
        if (!state.files.length) return alert('Please add at least one file.');

        state.busy = true;
        els.convert.disabled = true;
        log('Starting conversion...');

        try {
            const to = els.to.value;
            const combine = els.opt.combine.checked;
            const files = [...state.files];
            const areAllImages = files.every(f => SUPPORTED.images.includes(getFileMeta(f.name).ext));

            if (files.length > 1 && to === 'pdf' && combine && areAllImages) {
                const firstItem = $('.ix-item', els.queue);
                const { blob, name } = await imagesToPdf(files, firstItem);
                downloadBlob(blob, name);
                setProgress(firstItem, 100);
                log('Done: Combined images -> PDF');
            } else {
                const items = $$('.ix-item', els.queue);
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const item = items[i];
                    try {
                        const { blob, name } = await convertFile(file, to, item);
                        downloadBlob(blob, name);
                        setProgress(item, 100);
                        log(`Done: ${file.name} → ${name}`);
                    } catch (err) {
                        console.error(`Failed to convert ${file.name}:`, err);
                        log(`Error: ${file.name} → ${err.message}`, 'error');
                        setProgress(item, 0);
                    }
                }
            }
        } catch (err) {
            console.error('A critical error occurred:', err);
            log('A critical error occurred. Check the console.', 'error');
        } finally {
            state.busy = false;
            els.convert.disabled = false;
        }
    }


    // --- Event Listeners ---
    function init() {
        if (!els.root) return; // Don't run if the widget isn't on the page

        // Drag & Drop
        const dropZone = els.drop;
        ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => {
            e.preventDefault(); e.stopPropagation(); dropZone.style.borderColor = 'var(--ix-accent)';
        }));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => {
            e.preventDefault(); e.stopPropagation(); dropZone.style.borderColor = 'var(--ix-border)';
        }));
        dropZone.addEventListener('drop', e => enqueue(Array.from(e.dataTransfer.files || [])));

        // File Input & Buttons
        els.file.addEventListener('change', e => {
            enqueue(Array.from(e.target.files || []));
            e.target.value = '';
        });

        els.quickBtns.forEach(btn => btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (preset === 'pdf-docx') els.to.value = 'docx';
            if (preset === 'docx-pdf') els.to.value = 'pdf';
            if (preset === 'img-pdf') {
                els.to.value = 'pdf';
                els.opt.combine.checked = true;
            }
            if (preset === 'pdf-txt') els.to.value = 'txt';
            els.file.click();
        }));

        els.convert.addEventListener('click', processQueue);
        els.clear.addEventListener('click', () => {
            state.files = [];
            els.queue.innerHTML = '';
            log('Queue cleared.');
        });
        
        log('Converter ready.');
    }

    // Run on page load
    document.addEventListener('DOMContentLoaded', init);

})();
