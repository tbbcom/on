document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements for performance
    const elements = {
        tabKWSP: document.getElementById('pencen-calc-tabKWSP'),
        tabJPA: document.getElementById('pencen-calc-tabJPA'),
        calculatorKWSP: document.getElementById('pencen-calc-calculatorKWSP'),
        calculatorJPA: document.getElementById('pencen-calc-calculatorJPA'),
        btnKWSP: document.getElementById('pencen-calc-btnKWSP'),
        btnJPA: document.getElementById('pencen-calc-btnJPA'),
        resultArea: document.getElementById('pencen-calc-resultArea'),
        resultKWSP: document.getElementById('pencen-calc-resultKWSP'),
        resultJPA: document.getElementById('pencen-calc-resultJPA'),
        resultValueKWSP: document.getElementById('pencen-calc-result-value-kwsp'),
        resultValueJPAMonthly: document.getElementById('pencen-calc-result-value-jpa-monthly'),
        resultValueJPAGratuity: document.getElementById('pencen-calc-result-value-jpa-gratuity'),
        inputsKWSP: {
            umurSemasa: document.getElementById('pencen-calc-umurSemasa'),
            umurSara: document.getElementById('pencen-calc-umurSara'),
            simpananSemasa: document.getElementById('pencen-calc-simpananSemasa'),
            gajiBulanan: document.getElementById('pencen-calc-gajiBulanan'),
            kenaikanGaji: document.getElementById('pencen-calc-kenaikanGaji'),
            kadarDividen: document.getElementById('pencen-calc-kadarDividen'),
        },
        inputsJPA: {
            gajiPokokTerakhir: document.getElementById('pencen-calc-gajiPokokTerakhir'),
            tempohPerkhidmatan: document.getElementById('pencen-calc-tempohPerkhidmatan'),
        },
        sliderValues: {
            kenaikanGaji: document.getElementById('pencen-calc-kenaikanGajiValue'),
            kadarDividen: document.getElementById('pencen-calc-kadarDividenValue'),
        }
    };

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (num) => `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const updateSliderValue = (type) => {
        if (type === 'kenaikanGaji') {
            elements.sliderValues.kenaikanGaji.textContent = elements.inputsKWSP.kenaikanGaji.value;
        } else if (type === 'kadarDividen') {
            elements.sliderValues.kadarDividen.textContent = elements.inputsKWSP.kadarDividen.value;
        }
    };

    // --- CORE FUNCTIONS ---
    const switchTab = (tabName) => {
        const isKWSP = tabName === 'KWSP';
        elements.calculatorKWSP.style.display = isKWSP ? 'block' : 'none';
        elements.tabKWSP.classList.toggle('active', isKWSP);
        elements.resultKWSP.style.display = isKWSP ? 'block' : 'none';
        
        elements.calculatorJPA.style.display = !isKWSP ? 'block' : 'none';
        elements.tabJPA.classList.toggle('active', !isKWSP);
        elements.resultJPA.style.display = !isKWSP ? 'block' : 'none';
        
        elements.resultArea.style.display = 'none'; // Hide result when switching tabs
    };

    const calculateKWSP = () => {
        const umurSemasa = parseInt(elements.inputsKWSP.umurSemasa.value);
        const umurSara = parseInt(elements.inputsKWSP.umurSara.value);
        const simpananSemasa = parseFloat(elements.inputsKWSP.simpananSemasa.value);
        const gajiBulanan = parseFloat(elements.inputsKWSP.gajiBulanan.value);
        const kenaikanGaji = parseFloat(elements.inputsKWSP.kenaikanGaji.value) / 100;
        const kadarDividen = parseFloat(elements.inputsKWSP.kadarDividen.value) / 100;

        if ([umurSemasa, umurSara, simpananSemasa, gajiBulanan].some(isNaN)) {
            alert("Sila masukkan semua nilai KWSP yang sah.");
            return;
        }
        
        // EPF contribution rates (Employee + Employer)
        const carumanRate = 0.11 + 0.13;
        let unjuranSimpanan = simpananSemasa;
        let gajiTerkini = gajiBulanan;
        const tempohSimpanan = umurSara - umurSemasa;

        if (tempohSimpanan < 0) {
            alert("Umur sasaran bersara mestilah lebih tinggi dari umur semasa.");
            return;
        }

        for (let i = 0; i < tempohSimpanan; i++) {
            let carumanTahunan = (gajiTerkini * carumanRate) * 12;
            unjuranSimpanan = (unjuranSimpanan + carumanTahunan) * (1 + kadarDividen);
            gajiTerkini *= (1 + kenaikanGaji);
        }

        elements.resultValueKWSP.textContent = formatCurrency(unjuranSimpanan);
        elements.resultArea.style.display = 'block';
        elements.resultKWSP.style.display = 'block';
        elements.resultJPA.style.display = 'none';
    };

    const calculateJPA = () => {
        const gajiPokokTerakhir = parseFloat(elements.inputsJPA.gajiPokokTerakhir.value);
        let tempohTahun = parseInt(elements.inputsJPA.tempohPerkhidmatan.value);

        if (isNaN(gajiPokokTerakhir) || isNaN(tempohTahun)) {
            alert("Sila masukkan semua nilai JPA yang sah.");
            return;
        }
        
        let tempohBulan = tempohTahun * 12;
        // Max service period for calculation is 360 months (30 years)
        if (tempohBulan > 360) {
            tempohBulan = 360; 
        }

        const pencenBulanan = (1 / 600) * tempohBulan * gajiPokokTerakhir;
        const ganjaranPerkhidmatan = (7.5 / 100) * tempohBulan * gajiPokokTerakhir;

        elements.resultValueJPAMonthly.textContent = formatCurrency(pencenBulanan);
        elements.resultValueJPAGratuity.textContent = formatCurrency(ganjaranPerkhidmatan);
        elements.resultArea.style.display = 'block';
        elements.resultKWSP.style.display = 'none';
        elements.resultJPA.style.display = 'block';
    };

    // --- EVENT LISTENERS ---
    elements.tabKWSP.addEventListener('click', () => switchTab('KWSP'));
    elements.tabJPA.addEventListener('click', () => switchTab('JPA'));
    elements.btnKWSP.addEventListener('click', calculateKWSP);
    elements.btnJPA.addEventListener('click', calculateJPA);
    elements.inputsKWSP.kenaikanGaji.addEventListener('input', () => updateSliderValue('kenaikanGaji'));
    elements.inputsKWSP.kadarDividen.addEventListener('input', () => updateSliderValue('kadarDividen'));

    // --- INITIALIZATION ---
    switchTab('KWSP'); // Set the default view to KWSP
});
