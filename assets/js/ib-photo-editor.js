/* IB Photo Studio (v1.0.1) — vanilla JS */
(() => {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $('#ib-canvas'), ctx = canvas.getContext('2d');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // ---------- State ----------
  /**
   * @typedef {Object} Layer
   * @property {'raster'|'shape'|'text'} type
   * @property {string} id
   * @property {string} name
   * @property {boolean} visible
   * @property {number} opacity
   * @property {string} blend
   * @property {number} x
   * @property {number} y
   * @property {number} scale
   * @property {number} rot
   * @property {{br:number,co:number,sa:number,bl:number,hu:number}} filter
   * @property {HTMLCanvasElement} [data]
   * @property {{kind:'rect'|'ellipse'|'line',color:string,size:number,stroke:boolean}} [shape]
   * @property {{value:string,color:string,size:number,weight:number,align:CanvasTextAlign,baseline:CanvasTextBaseline,font:string}} [text]
   */
  /** @type {Layer[]} */
  let layers = [];
  let active = -1;
  let tool = 'move';
  let painting = false;
  let start = {x:0,y:0};
  const paint = {color:'#2b2b2b', size:24, opacity:1};

  const history = []; let hIndex = -1; const MAX_H = 30;

  // ---------- Utils ----------
  const uid = () => 'ib_' + Math.random().toString(36).slice(2,9);
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const toFilter = f => `brightness(${f.br}) contrast(${f.co}) saturate(${f.sa}) blur(${f.bl}px) hue-rotate(${f.hu}deg)`;

  const pushHistory = () => {
    const snap = JSON.stringify(layers.map(L => ({
      ...L,
      data: L.type==='raster' ? L.data.toDataURL('image/png') : undefined
    })));
    history.splice(hIndex+1);
    history.push(snap);
    if(history.length>MAX_H) history.shift();
    hIndex = history.length-1;
  };

  const restoreFrom = (json) => {
    const arr = JSON.parse(json);
    layers = arr.map(o=>{
      const L = {...o};
      if(o.type==='raster' && o.data){
        const c = document.createElement('canvas'); const i = new Image();
        return new Promise(res=>{
          i.onload=()=>{ c.width=i.naturalWidth; c.height=i.naturalHeight; c.getContext('2d').drawImage(i,0,0); L.data=c; res(L); };
          i.src=o.data;
        });
      }
      return L;
    });
    if(layers.some(l=>l instanceof Promise)){
      Promise.all(layers).then(v=>{ layers=v; active = layers.length?0:-1; render(); syncUI(); });
    } else { active = layers.length?0:-1; render(); syncUI(); }
  };

  // ---------- Canvas sizing ----------
  function fitCanvasToContainer() {
    const wrap = canvas.parentElement;
    const w = Math.min(1400, wrap.clientWidth - 4);
    const ratio = canvas.height / canvas.width;
    const h = Math.max(360, w * ratio);
    const cssW = Math.floor(w), cssH = Math.floor(h);
    canvas.style.width = cssW+'px'; canvas.style.height = cssH+'px';
    canvas.width = Math.floor(cssW * DPR); canvas.height = Math.floor(cssH * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    render();
  }
  window.addEventListener('resize', fitCanvasToContainer);

  // ---------- Layer helpers ----------
  function baseLayer(type, name) {
    return { id: uid(), type, name, visible:true, opacity:1, blend:'source-over',
      x:0, y:0, scale:1, rot:0, filter:{br:1,co:1,sa:1,bl:0,hu:0} };
  }
  function addRasterFromImage(img, name='Image') {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    const L = baseLayer('raster', name); L.data = c;
    layers.push(L); active = layers.length-1; pushHistory(); render(); syncUI();
  }
  function addBrushLayerIfNeeded() {
    const L = baseLayer('raster', 'Paint');
    L.data = document.createElement('canvas');
    L.data.width = Math.max(1, Math.round(canvas.width/DPR));
    L.data.height= Math.max(1, Math.round(canvas.height/DPR));
    layers.push(L); active = layers.length-1;
  }
  function addShape(kind){
    const L = baseLayer('shape', kind.toUpperCase());
    L.shape = {kind, color: $('#ib-color').value, size: +$('#ib-size').value, stroke:false};
    L.x = 60; L.y = 60;
    layers.push(L); active = layers.length-1; pushHistory(); render(); syncUI();
  }
  function addTextAt(x, y){
    const L = baseLayer('text','Text');
    L.text = {value:'Double-click to edit', color: $('#ib-color').value, size: 36, weight:700, align:'left', baseline:'alphabetic', font:'system-ui'};
    L.x = x; L.y = y;
    layers.push(L); active = layers.length-1; pushHistory(); render(); syncUI();
  }

  // ---------- Render ----------
  function render() {
    const w = Math.round(canvas.width / DPR), h = Math.round(canvas.height / DPR);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.clearRect(0,0,w,h);
    for(const L of layers){
      if(!L.visible) continue;
      ctx.globalAlpha = clamp(L.opacity,0,1);
      ctx.globalCompositeOperation = L.blend || 'source-over';
      ctx.filter = toFilter(L.filter);
      ctx.save();
      ctx.translate(L.x, L.y); ctx.rotate((L.rot||0) * Math.PI/180); ctx.scale(L.scale||1, L.scale||1);
      if(L.type==='raster' && L.data){
        ctx.drawImage(L.data, 0, 0);
      } else if(L.type==='shape' && L.shape){
        ctx.lineWidth = L.shape.size; ctx.strokeStyle = L.shape.color; ctx.fillStyle = L.shape.color;
        switch(L.shape.kind){
          case 'rect': ctx.fillRect(0,0,200,140); break;
          case 'ellipse': ctx.beginPath(); ctx.ellipse(100,70,100,70,0,0,Math.PI*2); ctx.fill(); break;
          case 'line': ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(220,0); ctx.stroke(); break;
        }
      } else if(L.type==='text' && L.text){
        ctx.fillStyle = L.text.color; ctx.font = `${L.text.weight} ${L.text.size}px ${L.text.font}`;
        ctx.textAlign = L.text.align; ctx.textBaseline = L.text.baseline;
        ctx.fillText(L.text.value, 0, 0);
      }
      ctx.restore();
    }
    ctx.filter='none'; ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    ctx.restore();
  }

  // ---------- UI sync ----------
  function syncUI(){
    const list = $('#ib-layer-list'); if(!list) return;
    list.innerHTML='';
    layers.forEach((L,i)=>{
      const li = document.createElement('li'); li.dataset.index=i;
      li.className = i===active ? 'active' : '';
      li.innerHTML = `<span>${L.name} • ${L.type}</span><span>${L.visible?'👁':'🚫'}</span>`;
      li.addEventListener('click',()=>{ active=i; syncUI(); });
      list.prepend(li);
    });

    const L = layers[active] || null;
    setVal('#ib-layer-name', L?.name ?? '');
    setChecked('#ib-visible', L?.visible ?? false);
    setVal('#ib-opacity', L?.opacity ?? 1);
    setVal('#ib-blend', L?.blend ?? 'source-over');
    setVal('#ib-x', L?.x ?? 0);
    setVal('#ib-y', L?.y ?? 0);
    setVal('#ib-scale', L?.scale ?? 1);
    setVal('#ib-rot', L?.rot ?? 0);
    setVal('#ib-f-br', L?.filter.br ?? 1);
    setVal('#ib-f-co', L?.filter.co ?? 1);
    setVal('#ib-f-sa', L?.filter.sa ?? 1);
    setVal('#ib-f-bl', L?.filter.bl ?? 0);
    setVal('#ib-f-hu', L?.filter.hu ?? 0);
  }
  function setVal(sel, val){ const el=$(sel); if(el) el.value = val; }
  function setChecked(sel, val){ const el=$(sel); if(el) el.checked = val; }

  // ---------- Tool buttons ----------
  $$('.ib-tool').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('.ib-tool').forEach(s=>s.classList.remove('active'));
      b.classList.add('active'); tool = b.dataset.tool;
    });
  });
  $('#ib-color')?.addEventListener('input', e=>{ paint.color = e.target.value; });
  $('#ib-size')?.addEventListener('input', e=>{ paint.size = +e.target.value; });
  $('#ib-paint-opacity')?.addEventListener('input', e=>{ paint.opacity = +e.target.value; });

  // ---------- Pointer handlers ----------
  const pos = ev => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (canvas.width / r.width) / DPR,
      y: (ev.clientY - r.top ) * (canvas.height/ r.height)/ DPR
    };
  };

  canvas.addEventListener('pointerdown', e=>{
    const p = pos(e); start = p; painting = true;
    const L = layers[active];

    if(tool==='brush' || tool==='eraser'){
      if(!L || L.type!=='raster'){ addBrushLayerIfNeeded(); }
      drawDot(p.x, p.y, tool==='eraser');
    } else if(tool==='text'){
      addTextAt(p.x, p.y);
    }
  });
  canvas.addEventListener('pointermove', e=>{
    if(!painting) return;
    const p = pos(e);
    if(tool==='brush' || tool==='eraser'){
      strokeTo(p.x, p.y, tool==='eraser');
    } else if(tool==='move'){
      if(active<0) return;
      const L = layers[active]; const dx = p.x - start.x; const dy = p.y - start.y;
      L.x += dx; L.y += dy; start = p; render();
    }
  });
  window.addEventListener('pointerup', ()=>{ if(painting){ painting=false; pushHistory(); } });

  function drawDot(x,y,erase){
    const L = layers[active]; const c = L.data, g = c.getContext('2d');
    g.globalCompositeOperation = erase? 'destination-out':'source-over';
    g.globalAlpha = paint.opacity;
    g.fillStyle = paint.color; g.beginPath(); g.arc(x,y, paint.size/2, 0, Math.PI*2); g.fill(); render();
  }
  function strokeTo(x,y,erase){
    const L = layers[active]; const c = L.data, g = c.getContext('2d');
    g.globalCompositeOperation = erase? 'destination-out':'source-over';
    g.globalAlpha = paint.opacity;
    g.strokeStyle = paint.color; g.lineWidth = paint.size; g.lineCap='round'; g.lineJoin='round';
    g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(x,y); g.stroke(); start = {x,y}; render();
  }

  // ---------- Bind properties ----------
  bind('#ib-layer-name', e=>{ if(active<0) return; layers[active].name = e.target.value; syncUI(); });
  bind('#ib-visible',    e=>{ if(active<0) return; layers[active].visible = e.target.checked; render(); syncUI(); });
  bind('#ib-opacity',    e=>{ if(active<0) return; layers[active].opacity = +e.target.value; render(); });
  bind('#ib-blend',      e=>{ if(active<0) return; layers[active].blend = e.target.value; render(); });
  bind('#ib-x',          e=>{ if(active<0) return; layers[active].x = +e.target.value; render(); });
  bind('#ib-y',          e=>{ if(active<0) return; layers[active].y = +e.target.value; render(); });
  bind('#ib-scale',      e=>{ if(active<0) return; layers[active].scale = +e.target.value; render(); });
  bind('#ib-rot',        e=>{ if(active<0) return; layers[active].rot = +e.target.value; render(); });

  const fBr=$('#ib-f-br'), fCo=$('#ib-f-co'), fSa=$('#ib-f-sa'), fBl=$('#ib-f-bl'), fHu=$('#ib-f-hu');
  [fBr,fCo,fSa,fBl,fHu].forEach(inp=>inp&&inp.addEventListener('input', ()=>{
    if(active<0) return; const F = layers[active].filter;
    F.br=+fBr.value; F.co=+fCo.value; F.sa=+fSa.value; F.bl=+fBl.value; F.hu=+fHu.value; render();
  }));
  $('#ib-f-reset')?.addEventListener('click', ()=>{ if(active<0) return; layers[active].filter={br:1,co:1,sa:1,bl:0,hu:0}; render(); syncUI(); });

  function bind(sel, fn){ const el=$(sel); if(el) el.addEventListener('input', fn); }

  // ---------- Layer ops ----------
  $('#ib-layer-up')?.addEventListener('click', ()=>{ if(active<0) return; const i = active; if(i>=layers.length-1) return; [layers[i], layers[i+1]]=[layers[i+1], layers[i]]; active=i+1; pushHistory(); render(); syncUI(); });
  $('#ib-layer-down')?.addEventListener('click', ()=>{ if(active<=0) return; const i = active; [layers[i], layers[i-1]]=[layers[i-1], layers[i]]; active=i-1; pushHistory(); render(); syncUI(); });
  $('#ib-layer-dup')?.addEventListener('click', ()=>{ if(active<0) return; const L = layers[active];
    const C = JSON.parse(JSON.stringify({...L, id:uid()}));
    if(L.type==='raster'){ const c=document.createElement('canvas'); c.width=L.data.width; c.height=L.data.height; c.getContext('2d').drawImage(L.data,0,0); C.data=c; }
    layers.splice(active+1,0,C); active=active+1; pushHistory(); render(); syncUI(); });
  $('#ib-layer-del')?.addEventListener('click', ()=>{ if(active<0) return; layers.splice(active,1); active = Math.min(active,layers.length-1); pushHistory(); render(); syncUI(); });

  // ---------- Tool creation shortcuts ----------
  document.addEventListener('keydown', e=>{
    if(e.key==='v'||e.key==='V') selectTool('move');
    if(e.key==='b'||e.key==='B') selectTool('brush');
    if(e.key==='e'||e.key==='E') selectTool('eraser');
    if(e.key==='t'||e.key==='T') selectTool('text');
    if(e.key==='u'||e.key==='U') selectTool('rect');
    if(e.key==='o'||e.key==='O') selectTool('ellipse');
    if(e.key==='l'||e.key==='L') selectTool('line');

    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
    if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); redo(); }
  });
  function selectTool(name){
    tool = name; $$('.ib-tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===name));
  }
  // dblclick toolbar buttons to add shapes quickly
  $$('[data-tool="rect"]').forEach(b=>b.addEventListener('dblclick', ()=>addShape('rect')));
  $$('[data-tool="ellipse"]').forEach(b=>b.addEventListener('dblclick', ()=>addShape('ellipse')));
  $$('[data-tool="line"]').forEach(b=>b.addEventListener('dblclick', ()=>addShape('line')));

  // ---------- Import / New / Export / Project save-load ----------
  $('#ib-file')?.addEventListener('change', e=>{
    const f = e.target.files?.[0]; if(!f) return;
    const img = new Image();
    img.onload = ()=>{
      const ratio = img.height / img.width;
      const targetW = Math.min(1400, Math.max(640, img.width));
      const targetH = Math.max(360, Math.round(targetW * ratio));
      canvas.width = targetW*DPR; canvas.height = targetH*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
      fitCanvasToContainer();
      addRasterFromImage(img, f.name.replace(/\.[^.]+$/,''));
      pushHistory();
    };
    img.src = URL.createObjectURL(f); e.target.value = '';
  });

  $('#ib-new')?.addEventListener('click', ()=>{
    layers = []; active = -1;
    canvas.width = 1280*DPR; canvas.height=720*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
    fitCanvasToContainer(); pushHistory(); render(); syncUI();
  });

  $('#ib-export')?.addEventListener('click', ()=>{
    const fmt = $('#ib-export-format').value;
    const q = +$('#ib-export-quality').value || 0.95;
    const a = document.createElement('a');
    a.download = `ib-image-${Date.now()}.${fmt.split('/')[1].replace('jpeg','jpg')}`;
    a.href = canvas.toDataURL(fmt, q);
    a.click();
  });

  $('#ib-saveproj')?.addEventListener('click', ()=>{
    const pkg = {
      version:'1.0.1',
      canvas:{w: Math.round(canvas.width/DPR), h: Math.round(canvas.height/DPR)},
      layers: layers.map(L=>{
        const o = {...L};
        if(L.type==='raster' && L.data) o.data = L.data.toDataURL('image/png');
        return o;
      })
    };
    const blob = new Blob([JSON.stringify(pkg)], {type:'application/json'});
    const a = document.createElement('a'); a.download=`ib-project-${Date.now()}.ibx`; a.href = URL.createObjectURL(blob); a.click();
  });

  $('#ib-loadproj')?.addEventListener('change', e=>{
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader(); r.onload = ()=> {
      try{
        const pkg = JSON.parse(r.result);
        canvas.width = pkg.canvas.w*DPR; canvas.height=pkg.canvas.h*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); fitCanvasToContainer();
        layers = []; active=-1;
        (async ()=>{
          for(const L of pkg.layers){
            if(L.type==='raster' && L.data){
              const img = new Image(); await new Promise(res=>{ img.onload=res; img.src=L.data; });
              const c = document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0);
              L.data = c;
            }
            layers.push(L);
          }
          active = layers.length? layers.length-1 : -1; render(); syncUI(); pushHistory();
        })();
      }catch(err){ alert('Invalid project file'); }
    };
    r.readAsText(f); e.target.value='';
  });

  // ---------- Undo/Redo helpers ----------
  function undo(){ if(hIndex<=0) return; hIndex--; restoreFrom(history[hIndex]); }
  function redo(){ if(hIndex>=history.length-1) return; hIndex++; restoreFrom(history[hIndex]); }
  $('#ib-undo')?.addEventListener('click', undo);
  $('#ib-redo')?.addEventListener('click', redo);

  // ---------- Text inline editing ----------
  canvas.addEventListener('dblclick', e=>{
    if(active<0) return; const L = layers[active];
    if(L.type!=='text') return;
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
    const ta = $('#ib-textarea'); ta.style.left = x+'px'; ta.style.top = y+'px';
    ta.value = L.text.value; ta.classList.remove('ib-hidden'); ta.focus();
    const commit = ()=>{ L.text.value = ta.value; ta.classList.add('ib-hidden'); render(); pushHistory(); };
    ta.onblur = commit; ta.onkeydown = ev=>{ if(ev.key==='Enter' && (ev.ctrlKey||ev.metaKey)) { ev.preventDefault(); commit(); } };
  });

  // ---------- Init ----------
  $('#ib-new')?.click(); // blank doc
  fitCanvasToContainer();
})();
