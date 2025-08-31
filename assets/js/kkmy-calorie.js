/*! KKMY Calorie Calculator v1.0.0 | thebukitbesi.com | Vanilla JS */
(function(){
  "use strict";
  const e=new Intl.NumberFormat("ms-MY", {
    maximumFractionDigits:0
  }
  ), t=new Intl.NumberFormat("ms-MY", {
    maximumFractionDigits:1
  }
  ), n=(e, t=document)=>t.querySelector(e), a=(e, t=document)=>Array.from(t.querySelectorAll(e)), o=(n=>{
    const a=new Intl.NumberFormat("ms-MY", {
      maximumFractionDigits:0
    }
    ), o=new Intl.NumberFormat("ms-MY", {
      maximumFractionDigits:1
    }
    ), l=(e, t=document)=>t.querySelector(e), i=(e, t=document)=>Array.from(t.querySelectorAll(e));
    if(!l("#kkmy-form"))return;
    const r=l("#kkmy-form"), c=i('input[name="unit"]', r), s=i('input[name="gender"]', r), u=l("#age", r), d=l("#height", r), m=l("#weight", r), p=l("#activity", r), g=l("#goal", r), y=l("#custom-goal-wrap", r), h=l("#custom-goal", r), f=l("#custom-goal-val", r), v=l("#macro", r), b=l("#macro-custom-wrap", r), k=l("#mc", r), x=l("#mp", r), w=l("#mf", r), E=l("#macro-sum-warn", r), S=l("#targetWeight", r), q=l("#height-label"), L=l("#weight-label"), M=l("#calcBtn", r), C=l("#resetBtn", r), B=l("#shareBtn", r), T=l("#printBtn", r), A=l("#outCal"), D=l("#outTdee"), F=l("#outBmr"), H=l("#outBmi"), I=l("#outBmiCat"), O=l("#outCg"), R=l("#outPg"), P=l("#outFg"), W=l("#outCp"), Y=l("#outPp"), _=l("#outFp"), j=l("#protRange"), J=l("#timeEstWrap"), K=l("#timeEst"), N=l("#warnWrap"), z={
      balanced:{
        c:50, p:20, f:30
      }, lowcarb:{
        c:25, p:35, f:40
      }, highprotein:{
        c:40, p:30, f:30
      }, endurance:{
        c:55, p:20, f:25
      }, keto:{
        c:5, p:25, f:70
      }
    };
    function G(){
      return c.find(e=>e.checked)?.value||"metric"
    }
    function Q(){
      return s.find(e=>e.checked)?.value||"male"
    }
    function U(e){
      const t=parseFloat(e.value);
      return Number.isFinite(t)?t:NaN
    }
    function V(){
      const e=G(), t=U(d);
      return"imperial"===e?2.54*t:t
    }
    function Z(){
      const e=G(), t=U(m);
      return"imperial"===e?.45359237*t:t
    }
    function $ (e, t, n, a){
      return 10*e+6.25*t-5*n+("male"===a?5:-161)
    }
    function ee(e, t){
      const n=t/100;
      return n<=0?NaN:e/(n*n)
    }
    function te(e){
      return Number.isFinite(e)?e<18.5?"Kurus":e<25?"Normal":e<30?"Berlebihan Berat":"Obesiti":"-"
    }
    function ne(){
      const e=g.value, t={
        maintain:0, cut10:-10, cut15:-15, cut20:-20, gain10:10, gain15:15, gain20:20
      };
      return"custom"===e?U(h)||0:t[e]??0
    }
    function ae(){
      if("custom"===v.value){
        const e=U(k)||0, t=U(x)||0, n=U(w)||0;
        return{
          c:e, p:t, f:n, valid:e+t+n===100
        }
      }
      const e=z[v.value]||z.balanced;
      return{
        ...e, valid:!0
      }
    }
    function oe(){
      const e=G();
      "imperial"===e?(q.textContent="Tinggi (inci)", L.textContent="Berat (lb)", d.min=20, d.max=100, d.step=.1, d.placeholder="cth: 67.0", m.min=50, m.max=600, m.step=.1, m.placeholder="cth: 154.0"):(q.textContent="Tinggi (cm)", L.textContent="Berat (kg)", d.min=50, d.max=250, d.step=.1, d.placeholder="cth: 170.0", m.min=20, m.max=250, m.step=.1, m.placeholder="cth: 70.0")
    }
    function le(){
      y.style.display="custom"===g.value?"":"none", b.style.display="custom"===v.value?"":"none"
    }
    function ie(){
      if(N.style.display="none", N.textContent="", ae().valid?E.style.display="":E.style.display="", !(U(u)>0&&V()>0&&Z()>0))return A.textContent=D.textContent=F.textContent=H.textContent="-", I.textContent="-", O.textContent=R.textContent=P.textContent="-", W.textContent=Y.textContent=_.textContent="-", j.textContent="Cadangan protein: - g/hari (1.6–2.2 g/kg)", void(J.style.display="none");
      const n=Q(), a=U(u), o=V(), l=Z(), i=parseFloat(p.value)||1.55, r=ne(), c=ae(), s=$(l, o, a, n), y=s*i, h=y*(1+r/100), f=ee(l, o), v=te(f), b=c.c, k=c.p, x=c.f, w=h*(b/100)/4, E=h*(k/100)/4, q=h*(x/100)/9, L=1.6*l, M=2.2*l;
      A.textContent=a?e.format(h):"-", D.textContent=e.format(y), F.textContent=e.format(s), H.textContent=t.format(f), I.textContent=v, O.textContent=e.format(w), R.textContent=e.format(E), P.textContent=e.format(q), W.textContent=b, Y.textContent=k, _.textContent=x, j.textContent="Cadangan protein: "+e.format(L)+"–"+e.format(M)+" g/hari (1.6–2.2 g/kg)";
      const C=U(S);
      if(Number.isFinite(C)&&C>0){
        const e=C-l, t=Math.abs(y-h);
        if(J.style.display="", t<1)K.textContent="Tiada defisit/surplus – pilih matlamat selain Kekal atau gunakan peratus Custom.";
        else{
          const n=7*t, a=7700, o=Math.abs(e)*a/n;
          0===e?K.textContent="Anda sudah pada berat sasaran.":K.innerHTML="Anggaran "+t.format(o)+" minggu untuk "+(e>0?"tambah":"kurang")+" "+t.format(Math.abs(e))+" kg (andaian linear)."
        }
      }
      else J.style.display="none";
      const B=Math.abs(r);
      B>=25?(N.style.display="", N.textContent="Amaran: Defisit/surplus >= 25% mungkin tidak sesuai untuk kebanyakan orang. Sila dapatkan nasihat profesional jika perlu."):"keto"===v.value&&r>0&&(N.style.display="", N.textContent="Nota: Diet keto dengan kalori surplus mungkin meningkatkan berat dengan cepat. Pantau kemajuan dan kesihatan.")
    }
    function re(){
      const e=new URLSearchParams(location.search), t=(t, n)=>{
        e.has(t)&&n(e.get(t))
      };
      t("unit", (e=>{
        ("imperial"===e?c[1]:c[0]).checked=!0, oe()
      }
      )), t("gender", (e=>{
        const t=s.find((t=>t.value===e));
        t&&(t.checked=!0)
      }
      )), t("age", (e=>u.value=e)), t("height", (e=>d.value=e)), t("weight", (e=>m.value=e)), t("activity", (e=>{
        ["1.2", "1.375", "1.55", "1.725", "1.9"].includes(e)&&(p.value=e)
      }
      )), t("goal", (e=>{
        g.value=e, le()
      }
      )), t("pct", (e=>{
        h.value=e, f.textContent=e
      }
      )), t("macro", (e=>{
        v.value=e, le()
      }
      )), t("mc", (e=>k.value=e)), t("mp", (e=>x.value=e)), t("mf", (e=>w.value=e)), t("target", (e=>S.value=e))
    }
    function ce(){
      const e=new URLSearchParams;
      return e.set("unit", G()), e.set("gender", Q()), u.value&&e.set("age", u.value), d.value&&e.set("height", d.value), m.value&&e.set("weight", m.value), e.set("activity", p.value), e.set("goal", g.value), "custom"===g.value&&e.set("pct", h.value||"0"), e.set("macro", v.value), "custom"===v.value&&(k.value&&e.set("mc", k.value), x.value&&e.set("mp", x.value), w.value&&e.set("mf", w.value)), S.value&&e.set("target", S.value), location.origin+location.pathname+"?"+e.toString()
    }
    c.forEach((e=>e.addEventListener("change", (()=>{
      oe(), ie()
    }
    )))), s.forEach((e=>e.addEventListener("change", ie))), [u, d, m, p, S].forEach((e=>e.addEventListener("input", ie))), g.addEventListener("change", (()=>{
      le(), ie()
    }
    )), h.addEventListener("input", (()=>{
      f.textContent=h.value, ie()
    }
    )), v.addEventListener("change", (()=>{
      le(), ie()
    }
    )), [k, x, w].forEach((e=>e.addEventListener("input", (()=>{
      const e=(parseFloat(k.value)||0)+(parseFloat(x.value)||0)+(parseFloat(w.value)||0);
      E.style.display="custom"===v.value&&100!==e?"":"none", ie()
    }
    ))), M.addEventListener("click", ie), T.addEventListener("click", (()=>window.print())), B.addEventListener("click", (async()=>{
      const e=ce();
      try{
        await navigator.clipboard.writeText(e), B.textContent="Pautan Disalin", setTimeout((()=>B.textContent="Salin Pautan"), 1400)
      }
      catch(t){
        alert(e)
      }
    }
    )), C.addEventListener("click", (()=>{
      setTimeout((()=>{
        oe(), le(), ie()
      }
      ), 0)
    }
    )), oe(), le(), re(), u.value||(u.value=28), d.value||(d.value=170), m.value||(m.value=70), ie()
  }
  )(n, a))
}
)();

