(function(){
  'use strict';

  // Config
  const MAX_DISPLAY_BMI = 35; // scale cap for display
  const ASIA_CATS = [
    {label:'Underweight', min:0, max:18.4, color:'#60a5fa', risk:'Possible nutritional deficiency risk.'},
    {label:'Healthy', min:18.5, max:22.9, color:'#34d399', risk:'Lower risk of weight-related disease.'},
    {label:'Overweight (At Risk)', min:23, max:24.9, color:'#f59e0b', risk:'Increased metabolic risk; monitor waist & lifestyle.'},
    {label:'Obese I', min:25, max:29.9, color:'#ef4444', risk:'Moderate to high risk; seek lifestyle changes.'},
    {label:'Obese II', min:30, max:60, color:'#b91c1c', risk:'High to very high risk; consult a healthcare professional.'}
  ];

  // Elements
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const container = $('#bmi-my');
  const unitRadios = $$('input[name="unit"]', container);

  const metricFields = $$('.metric-only', container);
  const imperialFields = $$('.imperial-only', container);

  const heightCm = $('#height-cm', container);
  const heightFt = $('#height-ft', container);
  const heightIn = $('#height-in', container);

  const weightKg = $('#weight-kg', container);
  const weightLb = $('#weight-lb', container);

  const waistCm = $('#waist-cm', container);
  const waistIn = $('#waist-in', container);

  const age = $('#age', container);
  const sex = $('#sex', container);

  const calcBtn = $('#calc-btn', container);
  const resetBtn = $('#reset-btn', container);
  const copyBtn = $('#copy-link', container);
  const printBtn = $('#print-btn', container);

  const errorBox = $('#form-error', container);

  const bmiValueEl = $('#bmi-value', container);
  const bmiCatEl = $('#bmi-category', container);
  const idealRangeEl = $('#ideal-range', container);
  const whtrEl = $('#whtr', container);
  const bmiPrimeEl = $('#bmi-prime', container);
  const riskNoteEl = $('#risk-note', container);

  const scale = $('#bmi-scale', container);
  const needle = $('#bmi-needle', container);
  const needleLabel = $('#needle-label', container);

  // Build scale segments dynamically
  function buildScale() {
    // Clear existing segs except needle
    Array.from(scale.children).forEach(el => { if (!el.classList.contains('needle')) el.remove(); });

    // Use Asia cats but cap to MAX_DISPLAY_BMI for the bar
    const segs = [
      {label:'Underweight', start:0, end:18.5, color:'#60a5fa'},
      {label:'Healthy', start:18.5, end:22.9, color:'#34d399'},
      {label:'Overweight (At Risk)', start:23, end:25, color:'#f59e0b'},
      {label:'Obese I', start:25, end:30, color:'#ef4444'},
      {label:'Obese II', start:30, end:MAX_DISPLAY_BMI, color:'#b91c1c'},
    ];
    for (const s of segs) {
      const widthPct = ((Math.min(s.end, MAX_DISPLAY_BMI) - Math.max(s.start, 0)) / MAX_DISPLAY_BMI) * 100;
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.width = widthPct + '%';
      seg.style.background = s.color;
      seg.title = `${s.label}: ${s.start}–${s.end}`;
      scale.insertBefore(seg, needle);
    }
  }
  buildScale();

  function getUnit() {
    const u = unitRadios.find(r => r.checked)?.value || 'metric';
    return u;
  }

  function showUnit(u) {
    if (u === 'metric') {
      metricFields.forEach(el => el.classList.remove('hidden'));
      imperialFields.forEach(el => el.classList.add('hidden'));
    } else {
      metricFields.forEach(el => el.classList.add('hidden'));
      imperialFields.forEach(el => el.classList.remove('hidden'));
    }
  }

  unitRadios.forEach(r => r.addEventListener('change', () => {
    showUnit(getUnit());
    calculate(); // live recalc on unit switch
  }));

  // Helpers
  const clamp = (v,min,max) => Math.min(Math.max(v,min),max);
  const toNum = v => {
    const n = parseFloat(String(v).replace(/,/g,'').trim());
    return Number.isFinite(n) ? n : null;
  };
  const cmToM = cm => cm / 100;
  const ftInToCm = (ft, inch) => (ft * 12 + inch) * 2.54;
  const lbToKg = lb => lb * 0.45359237;
  const inToCm = inch => inch * 2.54;
  const kgToLb = kg => kg / 0.45359237;

  function classifyBMI(bmi) {
    for (const c of ASIA_CATS) {
      if (bmi >= c.min && bmi <= c.max) return c;
    }
    return ASIA_CATS[ASIA_CATS.length-1];
  }

  function validInputs(unit) {
    let errors = [];
    if (unit === 'metric') {
      const h = toNum(heightCm.value);
      const w = toNum(weightKg.value);
      if (h == null || h < 90 || h > 250) errors.push('Height must be between 90 and 250 cm.');
      if (w == null || w < 20 || w > 300) errors.push('Weight must be between 20 and 300 kg.');
    } else {
      const ft = toNum(heightFt.value);
      const inch = toNum(heightIn.value);
      const wlb = toNum(weightLb.value);
      const totalIn = (ft ?? 0) * 12 + (inch ?? 0);
      if (ft == null || inch == null || totalIn < 36 || totalIn > 96) errors.push('Height must be between 3 ft and 8 ft.');
      if (wlb == null || wlb < 44 || wlb > 660) errors.push('Weight must be between 44 and 660 lb.');
    }
    return errors;
  }

  function calculate() {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
    const unit = getUnit();

    const errs = validInputs(unit);
    if (errs.length) {
      showResults(null);
      errorBox.textContent = errs.join(' ');
      errorBox.classList.remove('hidden');
      return;
    }

    let hCm, wKg, waistCmVal = null;
    if (unit === 'metric') {
      hCm = toNum(heightCm.value);
      wKg = toNum(weightKg.value);
      waistCmVal = toNum(waistCm.value);
    } else {
      const ft = toNum(heightFt.value);
      const inch = toNum(heightIn.value);
      const wlb = toNum(weightLb.value);
      hCm = ftInToCm(ft, inch);
      wKg = lbToKg(wlb);
      const win = toNum(waistIn.value);
      waistCmVal = win != null ? inToCm(win) : null;
    }

    const hM = cmToM(hCm);
    const bmi = wKg / (hM*hM);

    // Ideal weight range for Asia "Healthy" BMI: 18.5–22.9
    const minKg = 18.5 * hM * hM;
    const maxKg = 22.9 * hM * hM;

    // WHtR
    const whtr = (waistCmVal && hCm) ? (waistCmVal / hCm) : null;

    showResults({ unit, bmi, hCm, wKg, minKg, maxKg, whtr });

    try {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'bmi_calculated',
          bmi: Number(bmi.toFixed(1)),
          unit,
          sex: sex.value || 'na',
          age: toNum(age.value) || null
        });
      }
    } catch(_) {}
  }

  function showResults(data) {
    if (!data) {
      bmiValueEl.textContent = '—';
      bmiCatEl.textContent = '—';
      bmiCatEl.style.background = '#fff';
      needle.style.left = '0%';
      needleLabel.textContent = '—';
      idealRangeEl.textContent = 'Enter height to see healthy range.';
      whtrEl.textContent = 'Add your waist to refine risk.';
      bmiPrimeEl.textContent = 'BMI Prime: —';
      riskNoteEl.textContent = '—';
      return;
    }
    const {unit, bmi, hCm, wKg, minKg, maxKg, whtr} = data;
    const bmi1 = Number(bmi.toFixed(1));
    const cat = classifyBMI(bmi1);

    bmiValueEl.textContent = bmi1.toFixed(1);
    bmiCatEl.textContent = cat.label;
    bmiCatEl.style.background = cat.color + '22';
    bmiCatEl.style.borderColor = cat.color;
    bmiCatEl.style.color = '#111827';

    // Needle position
    const pos = clamp(bmi1, 0, MAX_DISPLAY_BMI) / MAX_DISPLAY_BMI * 100;
    needle.style.left = pos + '%';
    needleLabel.textContent = bmi1.toFixed(1);

    // Ideal range display (kg and lb)
    let ideal = `${minKg.toFixed(1)} – ${maxKg.toFixed(1)} kg`;
    if (unit === 'imperial') {
      ideal += ` (${kgToLb(minKg).toFixed(0)} – ${kgToLb(maxKg).toFixed(0)} lb)`;
    }
    idealRangeEl.textContent = ideal;

    // WHtR
    if (whtr) {
      let whtrCat = '';
      if (whtr < 0.40) whtrCat = 'Low (possible under‑nutrition)';
      else if (whtr < 0.50) whtrCat = 'Healthy';
      else if (whtr < 0.60) whtrCat = 'Increased risk';
      else whtrCat = 'High risk';
      whtrEl.textContent = `WHtR: ${whtr.toFixed(2)} (${whtrCat})`;
    } else {
      whtrEl.textContent = 'Add your waist to refine risk.';
    }

    // BMI Prime
    const bmiPrime = bmi1 / 25;
    bmiPrimeEl.textContent = `BMI Prime: ${bmiPrime.toFixed(2)}`;

    // Risk note
    let risk = cat.risk;
    // Refine with sex-specific waist if provided
    const waistProvided = (unit === 'metric' ? toNum(waistCm.value) : toNum(waistIn.value)) != null;
    if (waistProvided && whtr) {
      const sx = sex.value;
      let waistRisk = '';
      const waist = (unit === 'metric') ? toNum(waistCm.value) : toNum(waistIn.value) * 2.54;
      const femaleHigh = 80, maleHigh = 90;
      if (sx === 'female' && waist >= femaleHigh) waistRisk = 'Waist suggests elevated risk for women (≥80 cm). ';
      if (sx === 'male' && waist >= maleHigh) waistRisk = 'Waist suggests elevated risk for men (≥90 cm). ';
      if (!sx && whtr >= 0.5) waistRisk = 'Waist‑to‑height ratio ≥0.5 indicates increased risk. ';
      risk = waistRisk + risk;
    }
    riskNoteEl.textContent = risk;
  }

  // Events
  calcBtn.addEventListener('click', calculate);
  // Live calc on input changes
  [heightCm, weightKg, heightFt, heightIn, weightLb, waistCm, waistIn, age, sex].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      // only auto-calc when inputs look valid-ish
      calculate();
    });
  });

  resetBtn.addEventListener('click', () => {
    setTimeout(() => {
      showUnit(getUnit());
      showResults(null);
      errorBox.classList.add('hidden');
      errorBox.textContent = '';
    }, 0);
  });

  // Copy shareable link
  copyBtn.addEventListener('click', async () => {
    const unit = getUnit();
    const params = new URLSearchParams();
    params.set('u', unit);
    if (unit === 'metric') {
      if (heightCm.value) params.set('h', String(heightCm.value).trim());
      if (weightKg.value) params.set('w', String(weightKg.value).trim());
      if (waistCm.value) params.set('waist', String(waistCm.value).trim());
    } else {
      const ft = heightFt.value || '';
      const inch = heightIn.value || '';
      if (ft || inch) params.set('hft', ft), params.set('hin', inch);
      if (weightLb.value) params.set('wlb', String(weightLb.value).trim());
      if (waistIn.value) params.set('waist_in', String(waistIn.value).trim());
    }
    if (age.value) params.set('age', String(age.value).trim());
    if (sex.value) params.set('sex', String(sex.value).trim());

    const base = location.href.split('#')[0].split('?')[0];
    const url = `${base}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied!';
      setTimeout(() => copyBtn.textContent = 'Copy shareable link', 1500);
      if (navigator.share) {
        // optional native share hint on mobile
        // await navigator.share({ title: document.title, url });
      }
    } catch (e) {
      alert('Copy failed. You can manually copy this link:\n' + url);
    }
  });

  printBtn.addEventListener('click', () => window.print());

  // Prefill from query string
  function prefillFromQuery() {
    const q = new URLSearchParams(location.search);
    const u = q.get('u');
    if (u === 'imperial' || u === 'metric') {
      unitRadios.forEach(r => r.checked = (r.value === u));
      showUnit(u);
    }
    if ((q.get('h') && q.get('w')) || (q.get('hft') && q.get('wlb'))) {
      if (getUnit() === 'metric') {
        if (q.get('h')) heightCm.value = q.get('h');
        if (q.get('w')) weightKg.value = q.get('w');
        if (q.get('waist')) waistCm.value = q.get('waist');
      } else {
        if (q.get('hft')) heightFt.value = q.get('hft');
        if (q.get('hin')) heightIn.value = q.get('hin');
        if (q.get('wlb')) weightLb.value = q.get('wlb');
        if (q.get('waist_in')) waistIn.value = q.get('waist_in');
      }
      if (q.get('age')) age.value = q.get('age');
      if (q.get('sex')) sex.value = q.get('sex');
      calculate();
    }
  }

  // Init
  showUnit(getUnit());
  prefillFromQuery();

})();
