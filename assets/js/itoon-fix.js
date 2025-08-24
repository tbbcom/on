
/*
 * Cartoonizer AI v5.0 by TheBukitBesi (Vanilla JS, responsive, SEO and performance tuned)
 * Notes:
 * - UI in English; Intro/Title/FAQ kept in Malay as requested.
 * - New: line opacity & color, optional grain, dynamic canvas aspect ratio, keyboard shortcuts.
 */
(function() {
  'use strict';

  const $ = s => document.querySelector(s);

  const elements = {
    app: $('#ctoon-app'),
    wrap: document.querySelector('.ctoon-canvas-wrap'),
    fileInput: $('#ctoon-file'),
    dropZone: $('#ctoon-drop'),
    presetSel: $('#ctoon-preset'),
    smoothInp: $('#ctoon-smooth'),
    levelsInp: $('#ctoon-levels'),
    edgeInp: $('#ctoon-edge'),
    thickInp: $('#ctoon-thick'),
    edgeAlphaInp: $('#ctoon-edge-alpha'),
    edgeColorInp: $('#ctoon-edge-color'),
    satInp: $('#ctoon-sat'),
    ctrInp: $('#ctoon-ctr'),
    briInp: $('#ctoon-bri'),
    gamInp: $('#ctoon-gam'),
    tmpInp: $('#ctoon-temp'),
    grainInp: $('#ctoon-grain'),

    smoothVal: $('#ctoon-smooth-val'),
    levelsVal: $('#ctoon-levels-val'),
    edgeVal: $('#ctoon-edge-val'),
    thickVal: $('#ctoon-thick-val'),
    edgeAlphaVal: $('#ctoon-edge-alpha-val'),
    satVal: $('#ctoon-sat-val'),
    ctrVal: $('#ctoon-ctr-val'),
    briVal: $('#ctoon-bri-val'),
    gamVal: $('#ctoon-gam-val'),
    tmpVal: $('#ctoon-temp-val'),
    grainVal: $('#ctoon-grain-val'),

    maxSel: $('#ctoon-max'),
    autoChk: $('#ctoon-auto'),
    runBtn: $('#ctoon-run'),
    runSticky: $('#ctoon-run-sticky'),
    resetBtn: $('#ctoon-reset'),
    canvOrig: $('#ctoon-canv-orig'),
    canvOut: $('#ctoon-canv-out'),
    ctxOrig: $('#ctoon-canv-orig').getContext('2d'),
    ctxOut: $('#ctoon-canv-out').getContext('2d'),
    afterWrap: $('#ctoon-after'),
    compare: $('#ctoon-compare'),
    loader: $('#ctoon-loader'),
    msgEl: $('#ctoon-msg'),
    timeEl: $('#ctoon-time'),
    formatSel: $('#ctoon-format'),
    qualityInp: $('#ctoon-quality'),
    qualityVal: $('#ctoon-quality-val'),
    qualityRow: $('#ctoon-quality-row'),
    dlBtn: $('#ctoon-download'),
    dlSticky: $('#ctoon-dl-sticky'),
    copyBtn: $('#ctoon-copy')
  };

  let originalImageData = null;
  let processing = false;
  let processTimer = 0;

  const clamp = (v, min, max) => v < min ? min : v > max ? max : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  const presets = {
    'default': { smooth: 1, levels: 12, edge: 55, thick: 1, edgeAlpha: 1, lineColor: '#000000', sat: 1.1, ctr: 1.05, bri: 1.0, gam: 1.0, temp: 0, grain: 0.00, mode: 'rgb', neon: false, mono: false },
    'ghibli':  { smooth: 2, levels: 14, edge: 35, thick: 1, edgeAlpha: 0.85, lineColor: '#1b1b1b', sat: 1.12, ctr: 0.98, bri: 1.05, gam: 1.02, temp: 14, grain: 0.06, mode: 'hsl', neon: false, mono: false },
    'comic':   { smooth: 1, levels: 10, edge: 70, thick: 2, edgeAlpha: 1.0, lineColor: '#000000', sat: 1.25, ctr: 1.15, bri: 1.0, gam: 1.00, temp: 5,  grain: 0.04, mode: 'rgb', neon: false, mono: false },
    'manga':   { smooth: 1, levels: 6,  edge: 80, thick: 2, edgeAlpha: 1.0, lineColor: '#000000', sat: 0.0,  ctr: 1.25, bri: 1.0, gam: 1.05, temp: 0,  grain: 0.02, mode: 'rgb', neon: false, mono: true },
    'popart':  { smooth: 1, levels: 5,  edge: 60, thick: 3, edgeAlpha: 1.0, lineColor: '#000000', sat: 2.0,  ctr: 1.2,  bri: 1.05, gam: 1.0,  temp: 10, grain: 0.00, mode: 'rgb', neon: false, mono: false },
    'sketch':  { smooth: 1, levels: 24, edge: 75, thick: 1, edgeAlpha: 1.0, lineColor: '#000000', sat: 0.0,  ctr: 1.1,  bri: 1.05, gam: 1.00, temp: 0,  grain: 0.03, mode: 'rgb', neon: false, mono: true },
    'pastel':  { smooth: 3, levels: 16, edge: 30, thick: 1, edgeAlpha: 0.9,  lineColor: '#2a2a2a', sat: 1.05, ctr: 0.95, bri: 1.08, gam: 1.03, temp: -8, grain: 0.05, mode: 'hsl', neon: false, mono: false },
    'neon':    { smooth: 2, levels: 12, edge: 65, thick: 2, edgeAlpha: 1.0, lineColor: '#000000', sat: 1.3,  ctr: 1.1,  bri: 0.95, gam: 1.00, temp: -15, grain: 0.00, mode: 'rgb', neon: true,  mono: false }
  };

  function applyPreset(name) {
    const p = presets[name] || presets.default;
    const mapping = {
      smoothInp: p.smooth, levelsInp: p.levels, edgeInp: p.edge, thickInp: p.thick,
      edgeAlphaInp: p.edgeAlpha, satInp: p.sat, ctrInp: p.ctr, briInp: p.bri, gamInp: p.gam, tmpInp: p.temp, grainInp: p.grain
    };
    Object.keys(mapping).forEach(k => { if (elements[k]) elements[k].value = mapping[k]; });
    if (elements.edgeColorInp) elements.edgeColorInp.value = p.lineColor;
    updateAllRangeUI();
    if (elements.autoChk.checked) scheduleProcess();
  }

  function updateRangeUI(el) {
    const min = parseFloat(el.min || 0), max = parseFloat(el.max || 100), val = parseFloat(el.value);
    const pct = ((val - min) / (max - min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }
  function updateValDisplays() {
    elements.smoothVal.textContent = elements.smoothInp.value;
    elements.levelsVal.textContent = elements.levelsInp.value;
    elements.edgeVal.textContent = elements.edgeInp.value;
    elements.thickVal.textContent = elements.thickInp.value;
    elements.edgeAlphaVal.textContent = (+elements.edgeAlphaInp.value).toFixed(2);
    elements.satVal.textContent = (+elements.satInp.value).toFixed(2) + '×';
    elements.ctrVal.textContent = (+elements.ctrInp.value).toFixed(2) + '×';
    elements.briVal.textContent = (+elements.briInp.value).toFixed(2) + '×';
    elements.gamVal.textContent = (+elements.gamInp.value).toFixed(2);
    elements.tmpVal.textContent = elements.tmpInp.value;
    elements.grainVal.textContent = (+elements.grainInp.value).toFixed(2);
    elements.qualityVal.textContent = (+elements.qualityInp.value).toFixed(2);
  }
  function updateAllRangeUI() {
    document.querySelectorAll('.ctoon-controls input[type="range"], .ctoon-export input[type="range"]').forEach(updateRangeUI);
    updateValDisplays();
  }
  function scheduleProcess() { clearTimeout(processTimer); processTimer = setTimeout(processImage, 150); }

  function setPreviewAspect(w, h) {
    if (w > 0 && h > 0) elements.wrap.style.aspectRatio = w + ' / ' + h;
  }

  function handleFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      elements.msgEl.textContent = 'Not an image. Please choose JPG, PNG, or WEBP.'; return;
    }
    getOrientation(file).then(orientation => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const natural = applyOrientationSize(img.naturalWidth, img.naturalHeight, orientation);
        const maxDim = parseInt(elements.maxSel.value, 10);
        const fit = fitContain(natural.w, natural.h, maxDim === 0 ? Math.max(natural.w, natural.h) : maxDim);

        setupCanvas(fit.w, fit.h);
        setPreviewAspect(fit.w, fit.h);
        drawImageOriented(elements.ctxOrig, img, fit.w, fit.h, orientation);
        URL.revokeObjectURL(url);

        originalImageData = elements.ctxOrig.getImageData(0, 0, fit.w, fit.h);
        elements.msgEl.textContent = 'Image loaded. Ready to process.';
        if (elements.autoChk.checked) scheduleProcess();
      };
      img.onerror = () => { URL.revokeObjectURL(url); elements.msgEl.textContent = 'Failed to load image. The file may be corrupted.'; };
      img.src = url;
    }).catch(() => { elements.msgEl.textContent = 'Could not read image file.'; });
  }

  function resetTool() {
    originalImageData = null;
    elements.ctxOrig.clearRect(0, 0, elements.canvOrig.width, elements.canvOrig.height);
    elements.ctxOut.clearRect(0, 0, elements.canvOut.width, elements.canvOut.height);
    elements.msgEl.textContent = 'Ready for magic. Please upload an image.';
    elements.timeEl.textContent = '';
    elements.afterWrap.style.width = '50%';
    elements.compare.value = 50;
    setPreviewAspect(16, 10);
    applyPreset('default');
  }

  function setupCanvas(w, h) {
    elements.canvOrig.width = w; elements.canvOrig.height = h;
    elements.canvOut.width = w; elements.canvOut.height = h;
  }

  function fitContain(w, h, maxDim) {
    if (!maxDim || maxDim <= 0) return { w, h };
    const m = Math.max(w, h);
    if (m <= maxDim) return { w, h };
    const s = maxDim / m;
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }

  async function processImage() {
    if (!originalImageData) { elements.msgEl.textContent = 'Please upload an image first.'; return; }
    if (processing) return;
    processing = true;
    elements.loader.classList.add('show');
    elements.msgEl.textContent = 'Processing...';

    const t0 = performance.now();

    setTimeout(() => {
      const pName = elements.presetSel.value;
      const preset = presets[pName] || presets.default;
      const settings = {
        smooth: parseInt(elements.smoothInp.value, 10),
        levels: parseInt(elements.levelsInp.value, 10),
        edgePow: parseInt(elements.edgeInp.value, 10),
        thick: parseInt(elements.thickInp.value, 10),
        edgeAlpha: parseFloat(elements.edgeAlphaInp.value),
        edgeColor: elements.edgeColorInp.value,
        sat: parseFloat(elements.satInp.value),
        ctr: parseFloat(elements.ctrInp.value),
        bri: parseFloat(elements.briInp.value),
        gam: parseFloat(elements.gamInp.value),
        temp: parseInt(elements.tmpInp.value, 10),
        grain: parseFloat(elements.grainInp.value),
        mode: preset.mode, neon: preset.neon, mono: preset.mono
      };

      const w = originalImageData.width;
      const h = originalImageData.height;
      const src = new ImageData(new Uint8ClampedArray(originalImageData.data), w, h);

      if (settings.smooth > 0) gaussianBlurRGBA(src.data, w, h, settings.smooth);
      posterize(src.data, settings.levels, settings.mode, settings.mono);

      const gray = toGrayscale(src.data, w, h);
      const grad = sobel(gray, w, h);
      const thresh = Math.round(lerp(8, 180, settings.edgePow / 100));
      const edges = edgeMask(grad, w, h, thresh);
      if (settings.thick > 1) dilate(edges, w, h, settings.thick - 1);

      colorAdjust(src.data, w, h, settings);

      if (settings.grain > 0.001) applyGrain(src.data, w, h, settings.grain);

      const lineRGB = hexToRgb(settings.edgeColor);
      overlayEdges(src.data, edges, w, h, settings.neon, lineRGB, settings.edgeAlpha);

      elements.ctxOut.putImageData(src, 0, 0);
      elements.ctxOrig.putImageData(originalImageData, 0, 0);

      const t1 = performance.now();
      elements.timeEl.textContent = `Done in ${(t1 - t0).toFixed(0)} ms`;
      elements.msgEl.textContent = 'Processing complete!';
      processing = false;
      elements.loader.classList.remove('show');
    }, 10);
  }

  function gaussianKernel(radius) {
    const sigma = Math.max(0.8, radius);
    const r = Math.max(1, Math.round(radius));
    const size = r * 2 + 1;
    const k = new Float32Array(size);
    const s2 = 2 * sigma * sigma;
    let sum = 0;
    for (let i = -r, idx = 0; i <= r; i++, idx++) {
      const v = Math.exp(-(i * i) / s2);
      k[idx] = v; sum += v;
    }
    for (let i = 0; i < size; i++) k[i] /= sum;
    return { k, r };
  }

  function gaussianBlurRGBA(data, w, h, radius) {
    const { k, r } = gaussianKernel(radius);
    const tmp = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rsum = 0, gsum = 0, bsum = 0, asum = 0;
        for (let i = -r; i <= r; i++) {
          const xi = clamp(x + i, 0, w - 1);
          const idx = (y * w + xi) * 4;
          const kv = k[i + r];
          rsum += data[idx] * kv; gsum += data[idx + 1] * kv; bsum += data[idx + 2] * kv; asum += data[idx + 3] * kv;
        }
        const o = (y * w + x) * 4;
        tmp[o] = rsum; tmp[o + 1] = gsum; tmp[o + 2] = bsum; tmp[o + 3] = asum;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let rsum = 0, gsum = 0, bsum = 0, asum = 0;
        for (let i = -r; i <= r; i++) {
          const yi = clamp(y + i, 0, h - 1);
          const idx = (yi * w + x) * 4;
          const kv = k[i + r];
          rsum += tmp[idx] * kv; gsum += tmp[idx + 1] * kv; bsum += tmp[idx + 2] * kv; asum += tmp[idx + 3] * kv;
        }
        const o = (y * w + x) * 4;
        data[o] = rsum; data[o + 1] = gsum; data[o + 2] = bsum; data[o + 3] = asum;
      }
    }
  }

  function posterize(data, levels, mode, mono) {
    const step = 255 / Math.max(1, levels - 1);
    for (let i = 0; i < data.length; i += 4) {
      if (mono) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const q = Math.round(g / step) * step;
        data[i] = data[i + 1] = data[i + 2] = q;
        continue;
      }
      if (mode === 'hsl') {
        const hsl = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
        hsl[1] = Math.round((hsl[1] * 255) / step) * step / 255;
        hsl[2] = Math.round((hsl[2] * 255) / step) * step / 255;
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        data[i] = rgb[0] * 255; data[i + 1] = rgb[1] * 255; data[i + 2] = rgb[2] * 255;
      } else {
        data[i] = Math.round(data[i] / step) * step;
        data[i + 1] = Math.round(data[i + 1] / step) * step;
        data[i + 2] = Math.round(data[i + 2] / step) * step;
      }
    }
  }

  function toGrayscale(data, w, h) {
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, px = 0; i < data.length; i += 4, px++) {
      g[px] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    return g;
  }

  function sobel(gray, w, h) {
    const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
        const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
        out[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return out;
  }

  function edgeMask(grad, w, h, threshold) {
    const mask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < grad.length; i++) mask[i] = grad[i] > threshold ? 255 : 0;
    return mask;
  }

  function dilate(mask, w, h, iterations) {
    if (iterations <= 0) return;
    const tmp = new Uint8ClampedArray(mask.length);
    for (let k = 0; k < iterations; k++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let m = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const v = mask[(y + dy) * w + (x + dx)];
              if (v > m) m = v;
            }
          }
          tmp[y * w + x] = m;
        }
      }
      mask.set(tmp);
    }
  }

  function colorAdjust(data, w, h, s) {
    const invGamma = 1.0 / s.gam;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      r = Math.pow(r, invGamma); g = Math.pow(g, invGamma); b = Math.pow(b, invGamma);
      if (!s.mono) {
        const hsl = rgbToHsl(r, g, b);
        hsl[1] = clamp(hsl[1] * s.sat, 0, 1);
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      }
      r = (r - 0.5) * s.ctr + 0.5; g = (g - 0.5) * s.ctr + 0.5; b = (b - 0.5) * s.ctr + 0.5;
      r *= s.bri; g *= s.bri; b *= s.bri;
      r += (s.temp > 0 ? s.temp / 255 : 0);
      b -= (s.temp < 0 ? s.temp / 255 : 0);
      data[i] = clamp(r * 255, 0, 255);
      data[i + 1] = clamp(g * 255, 0, 255);
      data[i + 2] = clamp(b * 255, 0, 255);
    }
  }

  function applyGrain(data, w, h, strength) {
    const k = strength * 255;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const n = pseudoRandom(x, y) - 0.5; // [-0.5, 0.5]
        const d = n * k;
        data[idx] = clamp(data[idx] + d, 0, 255);
        data[idx + 1] = clamp(data[idx + 1] + d, 0, 255);
        data[idx + 2] = clamp(data[idx + 2] + d, 0, 255);
      }
    }
  }
  function pseudoRandom(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function overlayEdges(data, mask, w, h, neon, lineRGB, alpha) {
    const [cr, cg, cb] = lineRGB;
    const A = clamp(alpha, 0, 1);
    for (let i = 0, px = 0; i < data.length; i += 4, px++) {
      if (mask[px] > 128) {
        if (neon) {
          const hue = 240 - 120 * (mask[px] / 255);
          const rgb = hslToRgb(hue / 360, 1.0, 0.5);
          data[i] = rgb[0] * 255; data[i + 1] = rgb[1] * 255; data[i + 2] = rgb[2] * 255;
        } else {
          data[i] = data[i] * (1 - A) + cr * A;
          data[i + 1] = data[i + 1] * (1 - A) + cg * A;
          data[i + 2] = data[i + 2] * (1 - A) + cb * A;
        }
      }
    }
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) { s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) return [l, l, l];
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)];
  }

  function hexToRgb(hex) {
    let h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
    return [r, g, b];
  }

  function doDownload() {
    if (!originalImageData) { elements.msgEl.textContent = 'No image to download.'; return; }
    const mime = elements.formatSel.value || 'image/png';
    const q = parseFloat(elements.qualityInp.value);
    elements.canvOut.toBlob(blob => {
      if (!blob) { elements.msgEl.textContent = 'Failed to create file.'; return; }
      const a = document.createElement('a');
      const ext = mime.split('/')[1];
      a.download = `cartoonized-by-thebukitbesi.${ext}`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, mime, q);
  }

  async function doCopy() {
    if (!navigator.clipboard || !window.ClipboardItem) { elements.msgEl.textContent = 'Copy is not supported in this browser.'; return; }
    try {
      const blob = await new Promise(res => elements.canvOut.toBlob(res, 'image/png', 1));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      elements.msgEl.textContent = 'Image copied to clipboard.';
    } catch (e) {
      console.error(e);
      elements.msgEl.textContent = 'Failed to copy image.';
    }
  }

  function getOrientation(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }
        let offset = 2, length = view.byteLength;
        while (offset < length) {
          if (view.getUint16(offset + 2, false) <= 8) { resolve(1); return; }
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) { resolve(1); return; }
            const little = view.getUint16(offset += 6, false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;
            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + i * 12, little) === 0x0112) {
                resolve(view.getUint16(offset + i * 12 + 8, little));
                return;
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) break;
          else offset += view.getUint16(offset, false);
        }
        resolve(1);
      };
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
    });
  }

  function applyOrientationSize(w, h, ori) {
    return [5, 6, 7, 8].includes(ori) ? { w: h, h: w } : { w, h };
  }
  function drawImageOriented(ctx, img, outW, outH, ori) {
    const cvs = document.createElement('canvas');
    const oc = cvs.getContext('2d');
    const srcW = img.naturalWidth, srcH = img.naturalHeight;
    const natural = applyOrientationSize(srcW, srcH, ori);
    cvs.width = natural.w; cvs.height = natural.h;
    oc.save();
    switch (ori) {
      case 2: oc.transform(-1, 0, 0, 1, natural.w, 0); break;
      case 3: oc.transform(-1, 0, 0, -1, natural.w, natural.h); break;
      case 4: oc.transform(1, 0, 0, -1, 0, natural.h); break;
      case 5: oc.transform(0, 1, 1, 0, 0, 0); break;
      case 6: oc.transform(0, 1, -1, 0, natural.h, 0); break;
      case 7: oc.transform(0, -1, -1, 0, natural.h, natural.w); break;
      case 8: oc.transform(0, -1, 1, 0, 0, natural.w); break;
    }
    oc.drawImage(img, 0, 0, srcW, srcH);
    oc.restore();
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(cvs, 0, 0, cvs.width, cvs.height, 0, 0, outW, outH);
  }

  function onKey(e) {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'p') processImage();
    if (e.key.toLowerCase() === 'd') doDownload();
    if (e.key.toLowerCase() === 'r') resetTool();
  }

  function init() {
    ['dragenter', 'dragover'].forEach(evt => elements.dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); elements.dropZone.classList.add('dragover'); }, { passive: false }));
    ['dragleave', 'drop'].forEach(evt => elements.dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); elements.dropZone.classList.remove('dragover'); }, { passive: false }));
    elements.dropZone.addEventListener('drop', e => { e.dataTransfer && e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); });

    elements.fileInput.addEventListener('change', e => e.target.files && e.target.files[0] && handleFile(e.target.files[0]));
    window.addEventListener('paste', e => {
      if (e.clipboardData) {
        const items = e.clipboardData.items; if (!items) return;
        for (const item of items) { if (item.type.includes('image')) { handleFile(item.getAsFile()); break; } }
      }
    });

    elements.presetSel.addEventListener('change', () => applyPreset(elements.presetSel.value));
    elements.compare.addEventListener('input', () => elements.afterWrap.style.width = elements.compare.value + '%');
    elements.runBtn.addEventListener('click', processImage);
    elements.runSticky.addEventListener('click', processImage);
    elements.resetBtn.addEventListener('click', resetTool);
    elements.dlBtn.addEventListener('click', doDownload);
    elements.dlSticky.addEventListener('click', doDownload);
    elements.copyBtn.addEventListener('click', doCopy);
    window.addEventListener('keydown', onKey);

    const autoInputs = [elements.maxSel, elements.edgeColorInp, ...document.querySelectorAll('.ctoon-controls input[type="range"]')];
    autoInputs.forEach(inp => inp && inp.addEventListener('input', () => {
      updateAllRangeUI();
      if (elements.autoChk.checked && inp !== elements.qualityInp) scheduleProcess();
    }));

    elements.formatSel.addEventListener('change', () => {
      const isQualityVisible = ['image/jpeg', 'image/webp'].includes(elements.formatSel.value);
      elements.qualityRow.classList.toggle('visible', isQualityVisible);
    });

    updateAllRangeUI();
    applyPreset('default');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
