(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const state = {
    image: null,
    imgEl: null,
    canvas: null,
    ctx: null,
    dims: { w: 0, h: 0 },
    palette: [],
    stats: { brightness: 0, contrast: 0, saturation: 0 },
    composition: { x: 0.5, y: 0.5, region: 'center' },
    ratio: 'auto', // Will be updated to a specific ratio like '16:9' after analysis
    tags: [],
  };

  // Pre-defined color names for palette mapping
  const colorNames = [
    {n:'black',r:0,g:0,b:0},{n:'white',r:255,g:255,b:255},{n:'gray',r:128,g:128,b:128},
    {n:'red',r:220,g:38,b:38},{n:'orange',r:245,g:130,b:32},{n:'amber',r:245,g:158,b:11},
    {n:'yellow',r:250,g:204,b:21},{n:'lime',r:163,g:230,b:53},{n:'green',r:34,g:197,b:94},
    {n:'teal',r:20,g:184,b:166},{n:'cyan',r:6,g:182,b:212},{n:'sky',r:14,g:165,b:233},
    {n:'blue',r:37,g:99,b:235},{n:'indigo',r:79,g:70,b:229},{n:'violet',r:139,g:92,b:246},
    {n:'purple',r:147,g:51,b:234},{n:'magenta',r:217,g:70,b:239},{n:'pink',r:236,g:72,b:153},
    {n:'rose',r:244,g:63,b:94},{n:'brown',r:121,g:85,b:72},{n:'beige',r:225,g:195,b:146},
    {n:'gold',r:212,g:175,b:55},{n:'silver',r:192,g:192,b:192},{n:'bronze',r:205,g:127,b:50},
    {n:'navy',r:15,g:23,b:42},{n:'olive',r:107,g:142,b:35},{n:'maroon',r:128,g:0,b:0},
    {n:'peach',r:255,g:178,b:146},{n:'coral',r:255,g:127,b:80},{n:'turquoise',r:64,g:224,b:208},
    {n:'lavender',r:181,g:126,b:220}
  ];

  // Load defaults from local storage
  const defaults = {
    model: localStorage.getItem('ipg-model') || 'sdxl',
    style: localStorage.getItem('ipg-style') || 'photographic',
    light: localStorage.getItem('ipg-light') || 'natural light',
    mood: localStorage.getItem('ipg-mood') || 'vibrant',
    shot: localStorage.getItem('ipg-shot') || '',
    ar: localStorage.getItem('ipg-ar') || 'auto',
    detail: localStorage.getItem('ipg-detail') || 'standard',
    neg: localStorage.getItem('ipg-neg') || 'on',
  };

  function initUI() {
    state.canvas = $('#ipg-canvas');
    state.ctx = state.canvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent reads

    // Tab functionality
    const tabs = $$('.ipg-tab');
    tabs.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => { b.classList.remove('ipg-tab-active'); b.setAttribute('aria-selected', 'false'); });
        btn.classList.add('ipg-tab-active'); btn.setAttribute('aria-selected', 'true');
        $('#ipg-img2prompt').hidden = idx !== 0;
        $('#ipg-text2img').hidden = idx !== 1;
      });
    });

    // File input, drag & drop, paste handling
    const drop = $('#ipg-drop'), fileInput = $('#ipg-file'), browse = $('#ipg-browse');
    browse.addEventListener('click', () => fileInput.click());
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) loadImageFile(e.target.files[0]);
    });

    ['dragover', 'dragenter'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('ipg-drag'); }));
    ['dragleave', 'drop'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove('ipg-drag'); }));
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.[0]) loadImageFile(e.dataTransfer.files[0]);
    });

    document.addEventListener('paste', (e) => {
      if (!$('#ipg-text2img').hidden) return; // Only paste images in the Image -> Prompt tab
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.includes('image')) {
          const file = item.getAsFile();
          if (file) {
            loadImageFile(file);
            break;
          }
        }
      }
    });
    
    // Tagging functionality
    const tagInput = $('#ipg-tag-input');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = tagInput.value.trim().replace(/,$/, '');
        if (val) addTag(val);
        tagInput.value = '';
      }
    });

    // Mirror controls between the two tabs and set defaults
    const controlMap = [
      ['#ipg-model', '#ipg-model2'], ['#ipg-style', '#ipg-style2'],
      ['#ipg-light', '#ipg-light2'], ['#ipg-mood', '#ipg-mood2'],
      ['#ipg-shot', '#ipg-shot2'], ['#ipg-ar', '#ipg-ar2'],
      ['#ipg-detail', '#ipg-detail2'], ['#ipg-neg', '#ipg-neg2']
    ];
    controlMap.forEach(([a, b]) => {
      const elA = $(a), elB = $(b);
      [elA, elB].forEach(el => el.addEventListener('change', () => {
        const otherEl = el === elA ? elB : elA;
        if(otherEl.querySelector(`option[value="${el.value}"]`)) { // Prevent errors if option doesn't exist
            otherEl.value = el.value;
        }
        persistSettings();
      }));
      const key = a.replace('#ipg-', '');
      const defaultVal = defaults[key] || elA.value;
      elA.value = defaultVal;
      // Only set mirrored value if it exists as an option
      if(elB.querySelector(`option[value="${defaultVal}"]`)) {
          elB.value = defaultVal;
      }
    });
    
    // Action buttons
    $('#ipg-generate1').addEventListener('click', genFromImage);
    $('#ipg-copy1').addEventListener('click', () => copyText('#ipg-output1', '#ipg-copy1'));
    $('#ipg-download1').addEventListener('click', () => downloadText($('#ipg-output1').value, 'image-to-prompt.txt'));

    $('#ipg-generate2').addEventListener('click', genFromText);
    $('#ipg-copy2').addEventListener('click', () => copyText('#ipg-output2', '#ipg-copy2'));
    $('#ipg-download2').addEventListener('click', () => downloadText($('#ipg-output2').value, 'text-to-image-prompt.txt'));
    
    // Set initial state
    $('#ipg-updated').textContent = new Date().toISOString().slice(0, 10);
    setButtonState('#ipg-generate1', 'Load Image First', true);
  }

  function setButtonState(btnId, text, disabled) {
    const btn = $(btnId);
    if(btn) {
        btn.textContent = text;
        btn.disabled = disabled;
    }
  }

  function persistSettings() {
    const keys = ['model', 'style', 'light', 'mood', 'shot', 'ar', 'detail', 'neg'];
    keys.forEach(k => {
      const el = $('#ipg-' + k);
      if (el) localStorage.setItem('ipg-' + k, el.value);
    });
  }

  function addTag(tag) {
    if (!tag) return;
    const lowerTag = tag.toLowerCase();
    if (!state.tags.includes(lowerTag)) {
      state.tags.push(lowerTag);
      renderTags();
    }
  }

  function removeTag(tag) {
    state.tags = state.tags.filter(t => t !== tag);
    renderTags();
  }

  function renderTags() {
    const wrap = $('#ipg-tags');
    wrap.innerHTML = '';
    state.tags.forEach(tag => {
      const el = document.createElement('span');
      el.className = 'ipg-tag';
      const safeTag = escapeHtml(tag);
      el.innerHTML = `<span>#${safeTag}</span><button aria-label="Remove ${safeTag}" title="Remove">×</button>`;
      el.querySelector('button').addEventListener('click', () => removeTag(tag));
      wrap.appendChild(el);
    });
  }

  function loadImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.imgEl = img;
        drawAndAnalyze(img);
        
        // Auto-tag from filename
        const name = (file.name || '').replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').trim();
        if (name) {
          name.split(/\s+/).filter(w => w.length > 2 && isNaN(w)).slice(0, 5).forEach(addTag);
        }
      };
      img.onerror = () => {
        alert('Could not load the image file. It might be corrupted.');
        setButtonState('#ipg-generate1', 'Load Error', true);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
        alert('Failed to read the file.');
    };
    reader.readAsDataURL(file);
  }

  function drawAndAnalyze(img) {
    setButtonState('#ipg-generate1', 'Analyzing...', true);
    try {
        const maxSide = 900;
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        state.canvas.width = w;
        state.canvas.height = h;
        state.ctx.drawImage(img, 0, 0, w, h);
        state.dims = { w, h };

        analyzeImage();
        renderStats();
        setButtonState('#ipg-generate1', 'Generate Prompt', false);
    } catch(error) {
        console.error("Image analysis failed:", error);
        alert("Sorry, could not analyze this image. It might be in an unsupported format. Please try another one.");
        setButtonState('#ipg-generate1', 'Analysis Failed', true);
    }
  }

  function analyzeImage() {
    const { w, h } = state.dims;
    const sampleScale = Math.min(1, 256 / Math.max(w, h));
    const sw = Math.max(16, Math.round(w * sampleScale)), sh = Math.max(16, Math.round(h * sampleScale));
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw; tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(state.canvas, 0, 0, sw, sh);
    const data = tempCtx.getImageData(0, 0, sw, sh).data;

    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 30) pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    const palette = kmeansPalette(pixels, 5);
    state.palette = palette.map(p => ({
      r: p[0], g: p[1], b: p[2],
      hex: rgbToHex(p[0], p[1], p[2]),
      name: nearestColorName(p[0], p[1], p[2])
    }));
    renderPalette();

    const { meanLuma, stdLuma, meanSat } = measureStats(pixels);
    state.stats = {
      brightness: Math.round((meanLuma / 255) * 100),
      contrast: Math.round((stdLuma / 128) * 100),
      saturation: Math.round(meanSat * 100)
    };
    
    state.composition = sobelComposition(tempCtx, sw, sh);
    state.ratio = reduceRatio(state.dims.w, state.dims.h);
  }
  
  function renderPalette() {
    const wrap = $('#ipg-colors');
    wrap.innerHTML = '';
    state.palette.forEach(c => {
      const el = document.createElement('span');
      el.className = 'ipg-swatch';
      el.innerHTML = `<span class="ipg-swatch-dot" style="background:${c.hex}"></span><span>${c.name}</span><span style="opacity:.6">${c.hex}</span>`;
      wrap.appendChild(el);
    });
  }

  function renderStats() {
    $('#ipg-stats').innerHTML = `
      Brightness: <b>${state.stats.brightness}%</b> · Contrast: <b>${state.stats.contrast}%</b> · Saturation: <b>${state.stats.saturation}%</b><br/>
      Composition: <b>${state.composition.region}</b> · Aspect: <b>${state.ratio}</b> (${state.dims.w}×${state.dims.h})
    `;
  }
  
  // --- Analysis Algorithms (k-means, stats, sobel) ---
  // These are complex and appear correct, so they remain largely unchanged.
  function kmeansPalette(pixels, k=5) {
    if (!pixels.length) return [[128,128,128]];
    const centers = [];
    const used = new Set();
    while (centers.length < k && centers.length < pixels.length) {
      const idx = Math.floor(Math.random() * pixels.length);
      if (!used.has(idx)) { centers.push(pixels[idx].slice()); used.add(idx); }
    }
    let assignments = new Array(pixels.length).fill(0);
    for (let iter=0; iter<10; iter++) {
      for (let i=0; i<pixels.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c=0; c<centers.length; c++) {
          const d = (pixels[i][0]-centers[c][0])**2+(pixels[i][1]-centers[c][1])**2+(pixels[i][2]-centers[c][2])**2;
          if (d < bestD) { bestD = d; best = c; }
        }
        assignments[i] = best;
      }
      const sums = Array.from({length:k}, () => [0,0,0,0]);
      for (let i=0; i<pixels.length; i++) {
        const g = assignments[i];
        sums[g][0]+=pixels[i][0]; sums[g][1]+=pixels[i][1]; sums[g][2]+=pixels[i][2]; sums[g][3]+=1;
      }
      for (let c=0; c<k; c++) {
        if (sums[c][3] > 0) centers[c] = [Math.round(sums[c][0]/sums[c][3]), Math.round(sums[c][1]/sums[c][3]), Math.round(sums[c][2]/sums[c][3])];
      }
    }
    const sizes = Array.from({length:k}, () => 0);
    assignments.forEach(a => sizes[a]++);
    return centers.map((c,i) => ({ c, i, size: sizes[i] })).sort((a,b) => b.size - a.size).map(e => e.c);
  }

  function measureStats(pixels) {
    if (!pixels.length) return { meanLuma:128, stdLuma:32, meanSat:.3 };
    let sumL=0, sumL2=0, sumSat=0;
    for (const [r,g,b] of pixels) {
      const l = 0.2126*r + 0.7152*g + 0.0722*b;
      sumL += l; sumL2 += l*l;
      sumSat += rgbToHsl(r,g,b).s;
    }
    const n = pixels.length;
    const meanL = sumL/n;
    const varL = Math.max(0, sumL2/n - meanL*meanL);
    return { meanLuma: meanL, stdLuma: Math.sqrt(varL), meanSat: sumSat/n };
  }

  function sobelComposition(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    const gxk = [-1,0,1,-2,0,2,-1,0,1], gyk = [-1,-2,-1,0,0,0,1,2,1];
    let sumMag = 0, sumX = 0, sumY = 0;
    const gray = new Float32Array(w*h);
    for (let i=0, p=0; i<d.length; i+=4, p++) gray[p] = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];

    for (let y=1; y<h-1; y++) {
      for (let x=1; x<w-1; x++) {
        let gx=0, gy=0, k=0;
        for (let j=-1; j<=1; j++) {
          for (let i=-1; i<=1; i++) {
            const v = gray[(y+j)*w + (x+i)];
            gx += v * gxk[k]; gy += v * gyk[k]; k++;
          }
        }
        const mag = Math.sqrt(gx*gx + gy*gy);
        if (mag > 20) { sumMag += mag; sumX += x * mag; sumY += y * mag; }
      }
    }
    const cx = sumMag > 0 ? sumX / sumMag : w/2;
    const cy = sumMag > 0 ? sumY / sumMag : h/2;
    const nx = cx/w, ny = cy/h;
    const horiz = nx < 0.33 ? 'left third' : nx > 0.66 ? 'right third' : 'center';
    const vert  = ny < 0.33 ? 'top' : ny > 0.66 ? 'bottom' : 'middle';
    const region = (horiz === 'center' && vert === 'middle') ? 'center' : `${vert}-${horiz}`;
    return { x: nx, y: ny, region };
  }

  // --- Utility Functions ---
  function nearestColorName(r,g,b) {
    let best = 'color', bestD = Infinity;
    for (const c of colorNames) {
      const d = (r-c.r)**2 + (g-c.g)**2 + (b-c.b)**2;
      if (d < bestD) { bestD = d; best = c.n; }
    }
    return best;
  }
  function rgbToHex(r,g,b) { return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1).padStart(6,'0')}`; }
  function rgbToHsl(r,g,b) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0, l=(max+min)/2;
    if(max!==min){
      const d=max-min;
      s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){
        case r: h=(g-b)/d+(g<b?6:0); break;
        case g: h=(b-r)/d+2; break;
        case b: h=(r-g)/d+4; break;
      }
      h/=6;
    }
    return{h,s,l};
  }
  function reduceRatio(w, h) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const g = gcd(w, h);
    return `${w / g}:${h / g}`;
  }
  
  async function copyText(sel, btnSel) {
    const ta = $(sel);
    if (!ta || !ta.value) return;
    const originalText = $(btnSel).textContent;
    try {
      await navigator.clipboard.writeText(ta.value);
      setButtonState(btnSel, 'Copied!', false);
      setTimeout(() => setButtonState(btnSel, originalText, false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Could not copy text to clipboard.');
    }
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // ★ FIX: Correctly handles 'auto' value before an image is processed.
  function getSelectedAR(id = '#ipg-ar') {
    const v = $(id).value;
    if (v === 'auto') {
        // Use calculated ratio if available and not the initial 'auto', else fallback.
        return (state.ratio && state.ratio !== 'auto') ? state.ratio : '1:1';
    }
    return v;
  }
  
  // --- Prompt Generation Logic ---
  function composeDescriptors({ style, light, mood, shot, detail }, paletteWords) {
    const parts = [shot, style, mood, light].filter(Boolean);
    if (detail && detail !== 'standard') parts.push(detail);
    if (paletteWords?.length) parts.push(`palette of ${paletteWords.join(', ')}`);
    return parts.join(', ');
  }

  function negativesFor(model) {
    if (model === 'midjourney') return '--no text, watermark, logo, blurry, duplicate';
    if (model === 'dalle') return ''; // DALL·E doesn't use a separate negative prompt field.
    return 'low quality, blurry, jpeg artifacts, watermark, text, logo, duplicate, out of frame'; // SDXL
  }
  
  function paramsFor(model, ar) {
    if (model === 'midjourney') return ` --ar ${ar} --v 6.0`;
    if (model === 'sdxl') return ` [ar: ${ar}] [cfg: 5.5] [steps: 25]`;
    if (model === 'dalle') return ` (aspect ratio ${ar})`;
    return '';
  }

  function genFromImage() {
    if (!state.imgEl) {
      alert('Please load an image first.');
      return;
    }
    const model = $('#ipg-model').value, style = $('#ipg-style').value,
          light = $('#ipg-light').value, mood = $('#ipg-mood').value,
          shot = $('#ipg-shot').value, detail = $('#ipg-detail').value,
          negOn = $('#ipg-neg').value === 'on', ar = getSelectedAR('#ipg-ar');

    const subject = state.tags.length ? state.tags.join(', ') : '(unspecified subject)';
    const paletteWords = [...new Set(state.palette.slice(0, 3).map(p => p.name))]; // Unique, top 3 colors
    const descriptors = composeDescriptors({style, light, mood, shot, detail}, paletteWords);
    const posComp = state.composition.region !== 'center' ? `composition centered on the ${state.composition.region},` : '';
    const statsText = `high contrast, vibrant saturation`; // Simplified for better prompting

    let base = `${subject}, ${descriptors}, ${posComp} ${statsText}`;
    let prompt = '';

    if (model === 'midjourney') {
      prompt = `${base}${paramsFor(model, ar)}`;
      if (negOn) prompt += ` ${negativesFor(model)}`;
    } else if (model === 'sdxl') {
      prompt = `Prompt: ${base}.`;
      if (negOn) prompt += `\nNegative prompt: ${negativesFor(model)}.`;
      prompt += `\nSettings:${paramsFor(model, ar)}`;
    } else { // DALL·E
      prompt = `${base}${paramsFor(model, ar)}`;
    }

    $('#ipg-output1').value = prompt.replace(/, ,/g, ',').replace(/,\s*$/, '').trim();
  }

  function genFromText() {
    const idea = ($('#ipg-idea').value || '').trim();
    if (!idea) {
      alert('Please describe your idea first.');
      return;
    }
    const model = $('#ipg-model2').value, style = $('#ipg-style2').value,
          light = $('#ipg-light2').value, mood = $('#ipg-mood2').value,
          shot = $('#ipg-shot2').value, detail = $('#ipg-detail2').value,
          negOn = $('#ipg-neg2').value === 'on', ar = $('#ipg-ar2').value;

    const descriptors = composeDescriptors({style, light, mood, shot, detail}, null);
    let base = `${idea}, ${descriptors}`;
    let prompt = '';

    if (model === 'midjourney') {
        prompt = `${base}${paramsFor(model, ar)}`;
        if (negOn) prompt += ` ${negativesFor(model)}`;
    } else if (model === 'sdxl') {
        prompt = `Prompt: ${base}.`;
        if (negOn) prompt += `\nNegative prompt: ${negativesFor(model)}.`;
        prompt += `\nSettings:${paramsFor(model, ar)}`;
    } else { // DALL·E
        prompt = `${base}${paramsFor(model, ar)}`;
    }
    
    $('#ipg-output2').value = prompt.replace(/, ,/g, ',').replace(/,\s*$/, '').trim();
  }
  
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s] || s));
  }

  // Initialize the app once the DOM is ready
  document.addEventListener('DOMContentLoaded', initUI);
})();