/* Any2PDF – Vanilla JS, lazy-loaded libs, client-side only */
(function(){
  'use strict';

  const els = {
    root: document.getElementById('ix-any2pdf'),
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
    busy: false
  };

  const SUPPORTED = {
    images: ['png','jpg','jpeg','webp','gif'],
    docx: ['docx'],
    pdf: ['pdf'],
    text: ['txt','md','csv','log'],
    html: ['html', 'htm']
  };

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  function log(msg) {
    const time = new Date().toLocaleTimeString();
    els.log.innerHTML = `<div class="ix-chip">[${time}] ${msg}</div>` + els.log.innerHTML;
  }

  function humanBytes(n=0) {
    if (!n) return '0 B';
    const u = ['B','KB','MB','GB']; let i = 0;
    while (n >= 1024 && i < u.length-1) { n/=1024; i++; }
    return `${n.toFixed(n>100?0:n>10?1:2)} ${u[i]}`;
  }

  function extOf(name='') {
    const i = name.lastIndexOf('.');
    return i>-1 ? name.slice(i+1).toLowerCase() : '';
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

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
      </div>
    `;
    const btn = $('.ix-remove', item);
    btn.addEventListener('click', () => {
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

  // DRAG & DROP
  ['dragenter','dragover'].forEach(evt => {
    els.drop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = 'var(--ix-accent)'; });
  });
  ['dragleave','drop'].forEach(evt => {
    els.drop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = 'var(--ix-border)'; });
  });
  els.drop.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []);
    enqueue(files);
  });
  els.file.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    enqueue(files);
    e.target.value = '';
  });

  function enqueue(files) {
    if (!files.length) return;
    files.forEach(f => {
      state.files.push(f);
      createItem(f);
    });
    log(`${files.length} file(s) added.`);
  }

  // Quick presets
  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p === 'pdf-docx') els.to.value = 'docx';
      if (p === 'docx-pdf') els.to.value = 'pdf';
      if (p === 'img-pdf') { els.to.value = 'pdf'; els.opt.combine.checked = true; }
      if (p === 'pdf-txt') els.to.value = 'txt';
      els.file.click();
    });
  });

  // Convert
  els.convert.addEventListener('click', async () => {
    if (state.busy) return;
    if (!state.files.length) return alert('Please add at least one file.');
    state.busy = true;
    try {
      await processAll();
    } catch(err) {
      console.error(err);
      alert('Conversion error. See console for details.');
    } finally {
      state.busy = false;
    }
  });

  // Clear
  els.clear.addEventListener('click', () => {
    state.files = [];
    els.queue.innerHTML = '';
    log('Cleared queue.');
  });

  // Lazy-loaders
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-src', src);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.body.appendChild(s);
    });
  }
  async function needHtml2Pdf() {
    if (!window.html2pdf || !window.jspdf) {
      await loadScript('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js');
    }
    return true;
  }
  async function needMammoth() {
    if (!window.mammoth) {
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
    }
    return true;
  }
  async function needPdfJs() {
    if (!window['pdfjsLib']) {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    return true;
  }
  async function needDocxLib() {
    if (!window.docx) {
      await loadScript('https://cdn.jsdelivr.net/npm/docx@8.5.0/dist/docx.min.js');
    }
    return true;
  }
  async function needZip() {
    if (!window.JSZip) {
      await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    }
    return true;
  }

  function readAsArrayBuffer(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });
  }
  function readAsText(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsText(file);
    });
  }
  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // Converters
  async function convertFile(file, to, item) {
    const fromExt = extOf(file.name);
    setProgress(item, 5);
    if (!fromExt) throw new Error('Unknown file type');

    const isImg = SUPPORTED.images.includes(fromExt);
    const isDocx = fromExt === 'docx';
    const isPdf = fromExt === 'pdf';
    const isText = SUPPORTED.text.includes(fromExt);
    const isHtml = SUPPORTED.html.includes(fromExt);

    // Decide route
    if (isImg && to === 'pdf') return await imagesToPdf([file], item);
    if (isPdf && to === 'txt') return await pdfToTxt(file, item);
    if (isPdf && to === 'html') return await pdfToTxt(file, item, {wrapHtml:true});
    if (isPdf && to === 'docx') return await pdfToDocx(file, item);
    if (isPdf && to === 'png') return await pdfToPngs(file, item);

    if (isDocx && to === 'html') return await docxToHtml(file, item);
    if (isDocx && to === 'txt') return await docxToTxt(file, item);
    if (isDocx && to === 'pdf') return await docxToPdf(file, item);

    if (isText && to === 'pdf') return await txtToPdf(file, item);
    if (isText && to === 'docx') return await txtToDocx(file, item);

    if (isHtml && to === 'pdf') return await htmlFileToPdf(file, item);

    // Fallbacks
    if (isImg && to === 'docx') return await imagesToDocx([file], item);
    if (to === 'pdf') return await genericToPdf(file, item); // last resort
    throw new Error('Unsupported route: ' + fromExt + ' -> ' + to);
  }

  // 1) Images -> PDF (single or combined in processAll)
  async function imagesToPdf(files, item) {
    await needHtml2Pdf();
    const { jsPDF } = window.jspdf;

    const opt = {
      combine: els.opt.combine.checked,
      pagesize: els.opt.pagesize.value,
      orientation: els.opt.orientation.value,
      margin: parseInt(els.opt.margin.value, 10) || 10
    };

    // Read all images first
    const images = [];
    for (let i = 0; i < files.length; i++) {
      const dataURL = await readAsDataURL(files[i]);
      images.push({ file: files[i], dataURL });
      setProgress(item, 10 + Math.round((i/files.length)*30));
    }

    // Determine page config
    function mmToPt(mm) { return (mm * 72) / 25.4; }
    const marginPt = mmToPt(opt.margin || 0);

    const firstImg = images[0];
    const imgProbe = await loadImage(firstImg.dataURL);
    const needLandscape = imgProbe.width > imgProbe.height;
    let orientation = opt.orientation === 'auto' ? (needLandscape ? 'landscape' : 'portrait') : opt.orientation;

    let format = 'a4';
    if (opt.pagesize === 'letter') format = 'letter';
    if (opt.pagesize === 'auto') {
      // simple heuristic; keep A4 for simplicity
      format = 'a4';
    }

    const doc = new jsPDF({ orientation, unit: 'pt', format });

    for (let i = 0; i < images.length; i++) {
      const { dataURL } = images[i];
      const img = await loadImage(dataURL);
      const page = pageSizePt(format); // returns {w,h}
      const wMax = page.w - marginPt*2;
      const hMax = page.h - marginPt*2;
      const scale = Math.min(wMax/img.width, hMax/img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (page.w - w)/2;
      const y = (page.h - h)/2;

      if (i>0) {
        // set per-page orientation if needed
        const isLand = img.width > img.height;
        const o = opt.orientation==='auto' ? (isLand ? 'landscape':'portrait') : orientation;
        doc.addPage(format, o);
      }
      doc.addImage(dataURL, x, y, w, h);
      setProgress(item, 50 + Math.round((i/images.length)*40));
    }

    const blob = doc.output('blob');
    const outName = outFilename(images[0].file.name, 'pdf', files.length>1);
    return { blob, name: outName };
  }

  function pageSizePt(format='a4') {
    // jsPDF sizes in pt
    const sizes = {
      a4: {w: 595.28, h: 841.89},
      letter: {w: 612, h: 792}
    };
    return sizes[format] || sizes.a4;
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
  }

  // 2) DOCX -> HTML
  async function docxToHtml(file, item) {
    await needMammoth();
    const arrayBuffer = await readAsArrayBuffer(file);
    setProgress(item, 25);
    const r = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: [] });
    const html = `<!doctype html><meta charset="utf-8"><title>${safe(file.name)}</title><body>${r.value}</body>`;
    setProgress(item, 80);
    return { blob: new Blob([html], {type:'text/html'}), name: replaceExt(file.name, 'html') };
  }

  // 3) DOCX -> TXT (raw text)
  async function docxToTxt(file, item) {
    await needMammoth();
    const arrayBuffer = await readAsArrayBuffer(file);
    setProgress(item, 25);
    const r = await mammoth.extractRawText({ arrayBuffer });
    setProgress(item, 80);
    return { blob: new Blob([r.value || ''], {type:'text/plain'}), name: replaceExt(file.name, 'txt') };
  }

  // 4) DOCX -> PDF (via HTML -> pdf)
  async function docxToPdf(file, item) {
    const htmlObj = await docxToHtml(file, item);
    const htmlText = await htmlObj.blob.text();

    await needHtml2Pdf();
    const holder = document.createElement('div');
    holder.style.width = '794px'; // approx A4 width in px for html2canvas
    holder.style.padding = '16px';
    holder.style.background = '#fff';
    holder.className = 'ix-html2pdf';
    holder.innerHTML = htmlText;
    document.body.appendChild(holder);

    const opt = {
      margin: (parseInt(els.opt.margin.value,10)||10) / 25.4, // inches
      filename: replaceExt(file.name, 'pdf'),
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: {
        unit: 'in',
        format: (els.opt.pagesize.value === 'letter' ? 'letter' : 'a4'),
        orientation: els.opt.orientation.value === 'landscape' ? 'landscape' : 'portrait'
      }
    };

    const worker = window.html2pdf().from(holder).set(opt).toPdf();
    const pdf = await worker.get('pdf');
    const blob = pdf.output('blob');

    document.body.removeChild(holder);
    setProgress(item, 95);
    return { blob, name: replaceExt(file.name, 'pdf') };
  }

  // 5) TXT -> PDF
  async function txtToPdf(file, item) {
    await needHtml2Pdf();
    const text = await readAsText(file);
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontFamily = 'inherit';
    pre.style.lineHeight = '1.5';
    pre.textContent = text;
    document.body.appendChild(pre);

    const opt = {
      margin: (parseInt(els.opt.margin.value,10)||10)/25.4,
      filename: replaceExt(file.name, 'pdf'),
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: (els.opt.pagesize.value === 'letter' ? 'letter' : 'a4'), orientation: 'portrait' }
    };
    const worker = window.html2pdf().from(pre).set(opt).toPdf();
    const pdf = await worker.get('pdf');
    const blob = pdf.output('blob');

    document.body.removeChild(pre);
    setProgress(item, 95);
    return { blob, name: replaceExt(file.name, 'pdf') };
  }

  // 6) TXT -> DOCX
  async function txtToDocx(file, item) {
    await needDocxLib();
    const text = await readAsText(file);
    const paragraphs = (text || '').split(/\r?\n/).map(line => new docx.Paragraph({ children: [ new docx.TextRun(line) ] }));
    const doc = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await docx.Packer.toBlob(doc);
    setProgress(item, 90);
    return { blob, name: replaceExt(file.name, 'docx') };
  }

  // 7) HTML file -> PDF
  async function htmlFileToPdf(file, item) {
    await needHtml2Pdf();
    const html = await readAsText(file);
    const holder = document.createElement('div');
    holder.innerHTML = html;
    holder.style.background = '#fff';
    holder.style.padding = '16px';
    holder.className = 'ix-html2pdf';
    document.body.appendChild(holder);

    const opt = {
      margin: (parseInt(els.opt.margin.value,10)||10)/25.4,
      filename: replaceExt(file.name, 'pdf'),
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: (els.opt.pagesize.value === 'letter' ? 'letter' : 'a4'), orientation: 'portrait' }
    };
    const worker = window.html2pdf().from(holder).set(opt).toPdf();
    const pdf = await worker.get('pdf');
    const blob = pdf.output('blob');

    document.body.removeChild(holder);
    setProgress(item, 90);
    return { blob, name: replaceExt(file.name, 'pdf') };
  }

  // 8) PDF -> TXT (and optional simple HTML)
  async function pdfToTxt(file, item, opt={wrapHtml:false}) {
    await needPdfJs();
    const data = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str);
      text += strings.join(' ') + '\n\n';
      setProgress(item, 10 + Math.round((i/pdf.numPages)*70));
    }
    if (opt.wrapHtml) {
      const html = `<!doctype html><meta charset="utf-8"><title>${safe(file.name)}</title><body><pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre></body>`;
      return { blob: new Blob([html], {type:'text/html'}), name: replaceExt(file.name, 'html') };
    }
    return { blob: new Blob([text], {type:'text/plain'}), name: replaceExt(file.name, 'txt') };
  }

  // 9) PDF -> DOCX (text-only)
  async function pdfToDocx(file, item) {
    const txt = await pdfToTxt(file, item);
    await needDocxLib();
    const content = await txt.blob.text();
    const paragraphs = content.split(/\r?\n/).map(line => new docx.Paragraph({ children: [new docx.TextRun(line)] }));
    const doc = new docx.Document({ sections: [{ properties:{}, children: paragraphs }] });
    const blob = await docx.Packer.toBlob(doc);
    setProgress(item, 95);
    return { blob, name: replaceExt(file.name, 'docx') };
  }

  // 10) PDF -> PNGs (per page)
  async function pdfToPngs(file, item) {
    await needPdfJs(); await needZip();
    const data = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const zip = new JSZip();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      zip.file(`page-${String(i).padStart(3,'0')}.png`, blob);
      setProgress(item, 10 + Math.round((i/pdf.numPages)*80));
    }
    const content = await zip.generateAsync({ type: 'blob' });
    return { blob: content, name: replaceExt(file.name, 'pages.zip') };
  }

  // 11) Images -> DOCX (basic)
  async function imagesToDocx(files, item) {
    await needDocxLib();
    const children = [];
    for (let i = 0; i < files.length; i++) {
      const ar = await readAsArrayBuffer(files[i]);
      children.push(new docx.Paragraph({ children: [] }));
      children.push(new docx.ImageRun({ data: ar, transformation: { width: 600, height: 400 } }));
      setProgress(item, 10 + Math.round((i/files.length)*70));
    }
    const doc = new docx.Document({ sections: [{ properties:{}, children }] });
    const blob = await docx.Packer.toBlob(doc);
    return { blob, name: replaceExt(files[0].name, 'docx') };
  }

  // 12) Generic -> PDF (best-effort)
  async function genericToPdf(file, item) {
    const ex = extOf(file.name);
    if (SUPPORTED.text.includes(ex)) return await txtToPdf(file, item);
    if (SUPPORTED.images.includes(ex)) return await imagesToPdf([file], item);
    if (SUPPORTED.html.includes(ex)) return await htmlFileToPdf(file, item);
    // last resort: wrap as text
    const text = await readAsText(file).catch(()=> '[binary content]');
    const fallback = new File([text], replaceExt(file.name, 'txt'), {type: 'text/plain'});
    return await txtToPdf(fallback, item);
  }

  function replaceExt(name, ext) {
    const i = name.lastIndexOf('.');
    const base = i>-1 ? name.slice(0, i) : name;
    return `${base}.${ext}`;
  }
  function outFilename(name, ext, combined=false) {
    const i = name.lastIndexOf('.');
    const base = i>-1 ? name.slice(0, i) : name;
    return combined ? `${base}-combined.${ext}` : `${base}.${ext}`;
  }
  function safe(s) { return String(s || '').replace(/[<>&"]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[s])); }
  function escapeHtml(s) { return safe(s); }

  async function processAll() {
    log('Starting conversion...');
    const to = els.to.value;
    const combineImages = els.opt.combine.checked;
    const files = [...state.files];

    // If images -> pdf and combine checked, do them together
    const allImages = files.every(f => SUPPORTED.images.includes(extOf(f.name)));
    if (files.length > 1 && to === 'pdf' && combineImages && allImages) {
      // create one queue item representing all
      const firstItem = $('.ix-item', els.queue);
      const { blob, name } = await imagesToPdf(files, firstItem);
      const outName = els.opt.autoname.checked ? `images-combined.pdf` : name;
      downloadBlob(blob, outName);
      setProgress(firstItem, 100);
      log('Done: combined images -> PDF');
      return;
    }

    // Otherwise, convert individually
    const items = $$('.ix-item', els.queue);
    for (let i = 0; i < files.length; i++) {
      const item = items[i];
      try {
        const { blob, name } = await convertFile(files[i], to, item);
        const outName = els.opt.autoname.checked ? smartOutName(files[i].name, to) : name;
        downloadBlob(blob, outName);
        setProgress(item, 100);
        log(`Done: ${files[i].name} → ${outName}`);
      } catch(err) {
        console.error(err);
        log(`Error: ${files[i].name} → ${err.message}`);
      }
    }
  }

  function smartOutName(inputName, to) {
    const i = inputName.lastIndexOf('.');
    const base = i>-1 ? inputName.slice(0,i) : inputName;
    return `${base}.${to}`;
  }

})();
