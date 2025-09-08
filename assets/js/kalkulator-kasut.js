/*
  Shoe size converter/calculator (Vanilla JS)
  - Refactored for readability and robustness
  - Debounced text inputs to avoid excessive updates
  - Safe DOM bindings (won't throw if elements missing)
*/

(function () {
  "use strict";

  // Shorthand DOM helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // Small utils
  const roundTo = (v, step = 0.5) => Math.round(v / step) * step;
  const neat = (n, dp = 2) =>
    parseFloat(parseFloat(n).toFixed(dp))
      .toString()
      .replace(/\.0+$/, "")
      .replace(/(\.\d*[1-9])0+$/, "$1");

  // Debounce helper (used only on input events)
  function debounce(fn, wait = 180) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Core conversion (adults, industry-typical approximations)
  const cmToEU = (cm) => Math.round(cm + 15);
  const cmToUSM = (cm) => roundTo(cm - 18, 0.5);
  const cmToUSW = (cm) => roundTo(cm - 17, 0.5);
  const cmToUK = (cm) => roundTo(cm - 19, 0.5);

  const EUToCM = (eu) => eu - 15;
  const USMToCM = (us) => us + 18;
  const USWToCM = (us) => us + 17;
  const UKToCM = (uk) => uk + 19;

  const normalizeGender = (g) => (g === "women" ? "women" : "men");

  function toCM(system, val, gender) {
    if (!Number.isFinite(val)) return NaN;
    switch (system) {
      case "CM":
        return val;
      case "EU":
        return EUToCM(val);
      case "US":
        return normalizeGender(gender) === "women" ? USWToCM(val) : USMToCM(val);
      case "UK":
        return UKToCM(val);
      default:
        return NaN;
    }
  }

  // In this model, 1 US size ≈ 1.0 cm step (common approximation)
  function brandAdjToCm(adjUS) {
    return parseFloat(adjUS || 0);
  }

  function widthAdjToCm(width) {
    if (width === "wide") return 0.3;
    if (width === "narrow") return -0.2;
    return 0;
  }

  function fromCM(cm, gender) {
    const eu = cmToEU(cm);
    const uk = cmToUK(cm);
    const usMen = cmToUSM(cm);
    const usWomen = cmToUSW(cm);
    const jp = roundTo(cm, 0.5); // CM/JP

    const result = {
      cm: neat(roundTo(cm, 0.1), 2),
      eu: eu,
      uk: neat(uk, 1),
      usMen: neat(usMen, 1),
      usWomen: neat(usWomen, 1),
      jp: neat(jp, 1),
    };

    // user-facing US
    result.us = normalizeGender(gender) === "women" ? result.usWomen : result.usMen;
    return result;
  }

  function tableHTML(out, gender, highlightMY = true) {
    const myEU = out.eu;
    const myCM = out.cm;
    const badge = highlightMY ? '<span class="bbesi-badge">MY disaran</span>' : "";
    const usLabel = normalizeGender(gender) === "women" ? "US (Perempuan)" : "US (Lelaki)";

    return `
      <div class="bbesi-note">
        Anggaran penukaran standard. Cuba di kedai jika boleh. ${badge}
      </div>
      <table class="bbesi-table">
        <caption class="sr-only">Hasil penukaran saiz kasut</caption>
        <thead>
          <tr><th>Sistem</th><th>Saiz</th><th>Nota</th></tr>
        </thead>
        <tbody>
          <tr><td class="bbesi-key">MY (EU)</td><td>${myEU}</td><td>Saranan untuk pasaran Malaysia</td></tr>
          <tr><td class="bbesi-key">MY (CM / JP)</td><td>${myCM} cm</td><td>Rujukan panjang kaki</td></tr>
          <tr><td>EU</td><td>${out.eu}</td><td>&nbsp;</td></tr>
          <tr><td>${usLabel}</td><td>${out.us}</td><td>&nbsp;</td></tr>
          <tr><td>US (Lelaki)</td><td>${out.usMen}</td><td>&nbsp;</td></tr>
          <tr><td>US (Perempuan)</td><td>${out.usWomen}</td><td>&nbsp;</td></tr>
          <tr><td>UK</td><td>${out.uk}</td><td>&nbsp;</td></tr>
          <tr><td>CM (JP)</td><td>${out.jp} cm</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
    `;
  }

  // Safe event helper
  const on = (el, type, handler) => el && el.addEventListener(type, handler);

  // Tabs
  const tabBtnConvert = $("#bbesi-tabbtn-convert");
  const tabBtnFoot = $("#bbesi-tabbtn-foot");
  const tabConvert = $("#bbesi-tab-convert");
  const tabFoot = $("#bbesi-tab-foot");

  function switchTab(which) {
    if (!tabBtnConvert || !tabBtnFoot || !tabConvert || !tabFoot) return;
    const toConvert = which === "convert";
    tabConvert.hidden = !toConvert;
    tabFoot.hidden = toConvert;

    tabBtnConvert.classList.toggle("active", toConvert);
    tabBtnFoot.classList.toggle("active", !toConvert);

    tabBtnConvert.setAttribute("aria-selected", String(toConvert));
    tabBtnFoot.setAttribute("aria-selected", String(!toConvert));
  }

  on(tabBtnConvert, "click", () => switchTab("convert"));
  on(tabBtnFoot, "click", () => switchTab("foot"));

  // Convert Mode
  const g1 = $("#bbesi-gender");
  const fromSys = $("#bbesi-from-system");
  const fromVal = $("#bbesi-from-value");
  const brand1 = $("#bbesi-brand");
  const width1 = $("#bbesi-width");
  const btnConvert = $("#bbesi-btn-convert");
  const res1 = $("#bbesi-results-convert");
  const btnClear1 = $("#bbesi-btn-clear");

  function setNote1(html) {
    if (res1) res1.innerHTML = html;
  }

  function runConvert() {
    if (!g1 || !fromSys || !fromVal || !brand1 || !width1) return;

    const gender = normalizeGender(g1.value);
    const sys = fromSys.value;
    const v = parseFloat(fromVal.value);

    if (isNaN(v)) {
      setNote1('<p class="bbesi-note">Sila masukkan saiz yang sah.</p>');
      return;
    }

    let cm = toCM(sys, v, gender);
    if (isNaN(cm)) {
      setNote1('<p class="bbesi-note">Sistem atau nilai tidak sah.</p>');
      return;
    }

    // Adjustments
    const adjBrand = brandAdjToCm(parseFloat(brand1.value || 0));
    const adjWidth = widthAdjToCm(width1.value);
    cm = cm + adjBrand + adjWidth;

    const out = fromCM(cm, gender);
    setNote1(tableHTML(out, gender, true));
  }

  on(btnConvert, "click", runConvert);
  [g1, fromSys, fromVal, brand1, width1].forEach((el) => on(el, "change", runConvert));
  on(fromVal, "input", debounce(() => {
    if (fromVal.value.length) runConvert();
  }));
  on(btnClear1, "click", () => setNote1(""));

  // Foot Mode
  const g2 = $("#bbesi-gender2");
  const footVal = $("#bbesi-foot-value");
  const footUnit = $("#bbesi-foot-unit");
  const allowance = $("#bbesi-allowance");
  const brand2 = $("#bbesi-brand2");
  const width2 = $("#bbesi-width2");
  const btnFoot = $("#bbesi-btn-foot");
  const res2 = $("#bbesi-results-foot");
  const btnClear2 = $("#bbesi-btn-clear2");

  function setNote2(html) {
    if (res2) res2.innerHTML = html;
  }

  function toCMFromFoot(val, unit) {
    return unit === "in" ? val * 2.54 : val;
  }

  function runFoot() {
    if (!g2 || !footVal || !footUnit || !allowance || !brand2 || !width2) return;

    const gender = normalizeGender(g2.value);
    let v = parseFloat(footVal.value);

    if (isNaN(v)) {
      setNote2('<p class="bbesi-note">Sila masukkan panjang kaki.</p>');
      return;
    }

    const unit = footUnit.value;
    let cm = toCMFromFoot(v, unit);

    // Add allowance + brand + width
    cm =
      cm +
      parseFloat(allowance.value || 0) +
      brandAdjToCm(parseFloat(brand2.value || 0)) +
      widthAdjToCm(width2.value);

    const out = fromCM(cm, gender);

    setNote2(
      tableHTML(out, gender, true) +
        `<p class="bbesi-note">Menggunakan panjang kaki (${neat(
          toCMFromFoot(v, unit),
          2
        )} ${unit}) + allowance ${neat(parseFloat(allowance.value || 0), 1)} cm.</p>`
    );
  }

  on(btnFoot, "click", runFoot);
  [g2, footVal, footUnit, allowance, brand2, width2].forEach((el) => on(el, "change", runFoot));
  on(footVal, "input", debounce(() => {
    if (footVal.value.length) runFoot();
  }));
  on(btnClear2, "click", () => setNote2(""));

  // Auto-init with example to show UI
  setTimeout(() => {
    if (fromSys && fromVal && g1) {
      // Defaults: US men 9
      fromSys.value = "US";
      fromVal.value = "9";
      g1.value = "men";
      runConvert();
    }
  }, 0);
})();

