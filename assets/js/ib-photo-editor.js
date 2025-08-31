/* IB Photo Studio v1.2 — vanilla JS, Blogger-safe (no deps) */
(() => {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $('#ib-canvas'), ctx = canvas.getContext('2d');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // ---------------- State ----------------
  let layers = [];      // array of Layer (see typedef)
  let active = -1;      // index of active layer
  let tool = 'move';    // move|transform|crop|blend|mask-eraser|cutout|brush|eraser|text|rect|ellipse|line
  let painting = false; // pointer dragging
  let start = {x:0,y:0};
  const paint = {color:'#2b2b2b', size:36, opacity:1, feather:.6, tol:28};

  const history = []; let hIndex = -1; const MAX_H = 40;

  // crop state
  const crop = {on:false, x:100, y:100, w:640, h:360};

  // transform state
  const tf = {on:false, dragging:false, mode:'move', handle:null};

  // ---------------- Types ----------------
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
   * @property {HTMLCanvasElement} [data]     // raster bitmap
   * @property {HTMLCanvasElement} [mask]     // optional alpha mask (white show / black hide)
   * @property {{kind:'rect'|'ellipse'|'line',fill:string,stroke:string,strokeW:number,grad:'none'|'v'|'h', size:number}} [shape]
   * @property {{value:string,color:string,size:number,weight:number,align:CanvasTextAlign,baseline:CanvasTextBaseline,font:string}} [text]
   */

  // ---------------- Utils ----------------
  const uid   = () => 'ib_' + Math.random().toString(36).slice(2,9);
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rad   = (deg)=>deg*Math.PI/180;
  const toFilter = f => `brightness(${f.br}) contrast(${f.co}) saturate(${f.sa}) blur(${f.bl}px) hue-rotate(${f.hu}deg)`;

  function baseLayer(type, name) {
    return { id: uid(), type, name, visible:true, opacity:1, blend:'source-over',
      x:0, y:0, scale:1, rot:0, filter:{br:1,co:1,sa:1,bl:0,hu:0} };
  }

  function ensureMask(L){
    if(L.type!=='raster') return;
    if(!L.mask){ L.mask = document.createElement('canvas'); L.mask.width=L.data.width; L.mask.height=L.data.height;
      const g=L.mask.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,L.mask.width,L.mask.height); }
  }

  // ---------------- Canvas sizing ----------------
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

  // ---------------- Import / Create ----------------
  function addRasterFromImage(img, name='Image') {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    const L = baseLayer('raster', name); L.data = c;
    // default mask = fully visible
    L.mask = document.createElement('canvas'); L.mask.width=c.width; L.mask.height=c.height;
    L.mask.getContext('2d').fillStyle='#fff'; L.mask.getContext('2d').fillRect(0,0,c.width,c.height);
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
    L.shape = {kind, fill: $('#ib-fill')?.value || '#2b2b2b', stroke: $('#ib-stroke')?.value || '#111', strokeW:+($('#ib-stroke-w')?.value||2), grad: $('#ib-grad')?.value || 'none', size: +($('#ib-size')?.value||24)};
    L.x = 60; L.y = 60;
    layers.push(L); active = layers.length-1; pushHistory(); render(); syncUI();
  }

  function addTextAt(x, y){
    const L = baseLayer('text','Text');
    L.text = {value:'Double-click to edit', color: $('#ib-color').value, size: 36, weight:700, align:'left', baseline:'alphabetic', font:'system-ui'};
    L.x = x; L.y = y;
    layers.push(L); active = layers.length-1; pushHistory(); render(); syncUI();
  }

  // ---------------- History ----------------
  function pushHistory(label='edit'){
    const snap = JSON.stringify(layers.map(L => ({
      ...L,
      data: (L.type==='raster' && L.data) ? L.data.toDataURL('image/png') : undefined,
      mask: (L.type==='raster' && L.mask) ? L.mask.toDataURL('image/png') : undefined,
      _label: label
    })));
    history.splice(hIndex+1);
    history.push(snap);
    if(history.length>MAX_H) history.shift();
    hIndex = history.length-1;
    syncHistory();
  }
  function restoreFrom(json){
    const arr = JSON.parse(json);
    layers = arr.map(o=>{
      const L = {...o};
      if(o.type==='raster'){
        const mkCanvas = (data)=> new Promise(res=>{ const i=new Image(); i.onload=()=>{ const c=document.createElement('canvas'); c.width=i.naturalWidth; c.height=i.naturalHeight; c.getContext('2d').drawImage(i,0,0); res(c); }; i.src=data; });
        const pData = o.data ? mkCanvas(o.data) : Promise.resolve(null);
        const pMask = o.mask ? mkCanvas(o.mask) : Promise.resolve(null);
        return Promise.all([pData,pMask]).then(([d,m])=>{ L.data=d; L.mask=m; return L; });
      }
      return L;
    });
    Promise.all(layers).then(v=>{ layers=v; active = layers.length? Math.min(active, layers.length-1): -1; render(); syncUI(); syncHistory(); });
  }

  // ---------------- Rendering ----------------
  function render() {
    const w = Math.round(canvas.width / DPR), h = Math.round(canvas.height / DPR);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,w,h);

    for(const L of layers){
      if(!L.visible) continue;
      ctx.globalAlpha = clamp(L.opacity,0,1);
      ctx.globalCompositeOperation = L.blend || 'source-over';
      ctx.filter = toFilter(L.filter);
      ctx.save();
      ctx.translate(L.x, L.y); ctx.rotate(rad(L.rot||0)); ctx.scale(L.scale||1, L.scale||1);

      if(L.type==='raster' && L.data){
        // composite with mask if present
        if(L.mask){
          const off = document.createElement('canvas'); off.width=L.data.width; off.height=L.data.height;
          const og = off.getContext('2d');
          og.drawImage(L.data,0,0);
          og.globalCompositeOperation='destination-in';
          og.drawImage(L.mask,0,0);
          ctx.drawImage(off, 0, 0);
        } else {
          ctx.drawImage(L.data, 0, 0);
        }
      } else if(L.type==='shape' && L.shape){
        const S = L.shape;
        // gradient fill if chosen
        let fillStyle = S.fill;
        if(S.grad!=='none'){
          let g;
          if(S.kind==='rect' || S.kind==='ellipse'){ g = ctx.createLinearGradient(0,0, S.grad==='h'?200:0, S.grad==='v'?140:0); }
          else { g = ctx.createLinearGradient(0,0, S.grad==='h'?220:0, S.grad==='v'?0:0); }
          g.addColorStop(0, S.fill);
          g.addColorStop(1, lighten(S.fill, 0.25));
          fillStyle = g;
        }
        ctx.lineWidth = S.strokeW; ctx.strokeStyle = S.stroke; ctx.fillStyle = fillStyle;
        switch(S.kind){
          case 'rect': ctx.fillRect(0,0,200,140); if(S.strokeW>0){ ctx.strokeRect(0,0,200,140); } break;
          case 'ellipse': ctx.beginPath(); ctx.ellipse(100,70,100,70,0,0,Math.PI*2); ctx.fill(); if(S.strokeW>0){ ctx.stroke(); } break;
          case 'line': ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(220,0); if(S.strokeW>0){ ctx.stroke(); } break;
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

    if(tool==='transform' && layers[active]) drawHandles(layers[active]);
    if(crop.on) drawCropUI();
  }

  function lighten(hex, a=0.2){ // simple lighten
    const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)||[0,'44','44','44'];
    let r=parseInt(m[1],16), g=parseInt(m[2],16), b=parseInt(m[3],16);
    r=clamp(Math.round(r+(255-r)*a),0,255); g=clamp(Math.round(g+(255-g)*a),0,255); b=clamp(Math.round(b+(255-b)*a),0,255);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // ---------------- UI sync ----------------
  function syncUI(){
    // layer list
    const list = $('#ib-layer-list'); if(list){
      list.innerHTML='';
      layers.forEach((L,i)=>{
        const li=document.createElement('li'); li.dataset.index=i; li.draggable=true;
        li.className = i===active?'active':'';
        li.innerHTML = `<span>${L.name} • ${L.type}</span><span>${L.visible?'👁':'🚫'}</span>`;
        li.addEventListener('click',()=>{ active=i; syncUI(); render(); });
        // drag reorder
        li.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', String(i)); });
        li.addEventListener('dragover', e=>{ e.preventDefault(); });
        li.addEventListener('drop', e=>{
          e.preventDefault();
          const from = +e.dataTransfer.getData('text/plain'); const to = i;
          if(from===to) return; const item=layers.splice(from,1)[0]; layers.splice(to,0,item);
          active = to; pushHistory('reorder'); syncUI(); render();
        });
        list.prepend(li); // newest on top visually
      });
    }

    // properties
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
  function setVal(sel,val){ const el=$(sel); if(el!=null) el.value=val; }
  function setChecked(sel,val){ const el=$(sel); if(el!=null) el.checked=val; }

  function syncHistory(){
    const ul = $('#ib-history'); if(!ul) return;
    ul.innerHTML='';
    history.forEach((snap,idx)=>{
      const li=document.createElement('li'); li.className= idx===hIndex?'active':'';
      li.textContent = `Step ${idx+1}`;
      li.addEventListener('click', ()=>{ hIndex=idx; restoreFrom(history[hIndex]); });
      ul.appendChild(li);
    });
  }

  // ---------------- Events: tool selection ----------------
  $$('.ib-tool').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('.ib-tool').forEach(s=>s.classList.remove('active'));
      b.classList.add('active'); tool = b.dataset.tool;
      tf.on = (tool==='transform');
      crop.on = (tool==='crop');
      render();
      $('#ib-crop-overlay')?.classList.toggle('ib-hidden', !crop.on);
      $('#ib-crop-rect')?.classList.toggle('ib-hidden', !crop.on);
    });
  });

  $('#ib-color')?.addEventListener('input', e=>{ paint.color = e.target.value; });
  $('#ib-size')?.addEventListener('input', e=>{ paint.size = +e.target.value; });
  $('#ib-paint-opacity')?.addEventListener('input', e=>{ paint.opacity = +e.target.value; });
  $('#ib-feather')?.addEventListener('input', e=>{ paint.feather = +e.target.value; });
  $('#ib-tol')?.addEventListener('input', e=>{ paint.tol = +e.target.value; });

  // ---------------- Pointer helpers ----------------
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

    if(tool==='blend' || tool==='mask-eraser'){
      if(!L || L.type!=='raster') return;
      ensureMask(L);
      paintMaskAt(L, p.x, p.y, tool==='mask-eraser'); render();
    } else if(tool==='brush' || tool==='eraser'){
      if(!L || L.type!=='raster'){ addBrushLayerIfNeeded(); }
      drawDot(p.x, p.y, tool==='eraser');
    } else if(tool==='text'){
      addTextAt(p.x, p.y);
    } else if(tool==='cutout'){
      if(!L || L.type!=='raster') return;
      autoCutout(L, Math.round(p.x), Math.round(p.y), paint.tol, paint.feather);
      pushHistory('cutout'); render(); syncUI();
    } else if(tool==='transform'){
      tf.dragging = true; tf.handle = hitHandle(L, p);
    } else if(tool==='crop'){
      crop.x = p.x; crop.y = p.y; crop.w = 1; crop.h = 1; render();
    }
  });

  canvas.addEventListener('pointermove', e=>{
    if(!painting) return; const p = pos(e);
    if(tool==='blend' || tool==='mask-eraser'){
      const L = layers[active]; if(!L || L.type!=='raster') return;
      paintMaskStroke(L, start.x, start.y, p.x, p.y, tool==='mask-eraser');
      start = p; render();
    } else if(tool==='brush' || tool==='eraser'){
      strokeTo(p.x, p.y, tool==='eraser'); start=p;
    } else if(tool==='transform'){
      const L = layers[active]; if(!L) return;
      dragTransform(L, start, p); start = p; render();
    } else if(tool==='crop'){
      crop.w = p.x - crop.x; crop.h = p.y - crop.y; render();
    } else if(tool==='move'){
      if(active<0) return;
      const L = layers[active]; const dx = p.x - start.x; const dy = p.y - start.y;
      L.x += dx; L.y += dy; start = p; render();
    }
  });

  window.addEventListener('pointerup', ()=>{
    if(!painting) return; painting=false;
    if(tool==='crop'){ applyCrop(); }
    if(tool==='blend'||tool==='mask-eraser'||tool==='brush'||tool==='eraser'||tool==='transform'||tool==='move'){
      pushHistory(tool); syncUI();
    }
  });

  // ---------------- Painting (raster) ----------------
  function drawDot(x,y,erase){
    const L = layers[active]; const c = L.data, g = c.getContext('2d');
    g.globalCompositeOperation = erase? 'destination-out':'source-over';
    g.globalAlpha = paint.opacity;
    g.fillStyle = paint.color; g.beginPath(); g.arc(x,y, paint.size/2, 0, Math.PI*2); g.fill(); render();
  }
  function strokeTo(x,y,erase){
    const L = layers[active]; const c = L.data, g = c.getContext('2d');
    g.globalCompositeOperation = erase? 'destination-out':'source-over';
    g.globalAlpha = paint.opacity; g.strokeStyle = paint.color; g.lineWidth = paint.size; g.lineCap='round'; g.lineJoin='round';
    g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(x,y); g.stroke(); render();
  }

  // ---------------- Mask Painter (feathered) ----------------
  function paintMaskAt(L, x, y, erase=false){
    // draw soft radial brush on L.mask: white adds, black removes
    const g = L.mask.getContext('2d');
    const r = paint.size/2;
    const feather = clamp(paint.feather,0,1); // 0=hard, 1=very soft
    const grad = g.createRadialGradient(x,y, r*0.05, x,y, r);
    if(!erase){ grad.addColorStop(0, `rgba(255,255,255,${paint.opacity})`); grad.addColorStop(feather, `rgba(255,255,255,${paint.opacity*0.6})`); grad.addColorStop(1,'rgba(255,255,255,0)'); }
    else      { grad.addColorStop(0, `rgba(0,0,0,${paint.opacity})`);        grad.addColorStop(feather, `rgba(0,0,0,${paint.opacity*0.6})`);        grad.addColorStop(1,'rgba(0,0,0,0)'); }
    g.globalCompositeOperation='source-over';
    g.fillStyle = grad; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  function paintMaskStroke(L, x0,y0,x1,y1, erase){
    const dx=x1-x0, dy=y1-y0; const steps=Math.max(2, Math.ceil(Math.hypot(dx,dy)/(paint.size*0.5)));
    for(let i=1;i<=steps;i++){ const t=i/steps; paintMaskAt(L, x0+dx*t, y0+dy*t, erase); }
  }

  // ---------------- Auto Cutout (flood fill by color distance) ----------------
  function autoCutout(L, sx, sy, tol=28, feather=0.5){
    ensureMask(L);
    const w=L.data.width, h=L.data.height;
    const src=L.data.getContext('2d').getImageData(0,0,w,h);
    const mask=L.mask.getContext('2d').getImageData(0,0,w,h);
    const targetIdx=(sy*w+sx)*4;
    const tr=src.data[targetIdx], tg=src.data[targetIdx+1], tb=src.data[targetIdx+2];

    const q=[[sx,sy]], seen=new Uint8Array(w*h); seen[sy*w+sx]=1;
    function dist(i){ const dr=src.data[i]-tr, dg=src.data[i+1]-tg, db=src.data[i+2]-tb; return Math.sqrt(dr*dr+dg*dg+db*db); }

    while(q.length){
      const [x,y]=q.pop(); const idx=(y*w+x)*4;
      if(dist(idx)<=tol){
        // keep region: write white to mask
        mask.data[idx]=255; mask.data[idx+1]=255; mask.data[idx+2]=255; mask.data[idx+3]=255;
        // expand
        if(x>0 && !seen[y*w+x-1]){ seen[y*w+x-1]=1; q.push([x-1,y]); }
        if(x<w-1 && !seen[y*w+x+1]){ seen[y*w+x+1]=1; q.push([x+1,y]); }
        if(y>0 && !seen[(y-1)*w+x]){ seen[(y-1)*w+x]=1; q.push([x,y-1]); }
        if(y<h-1 && !seen[(y+1)*w+x]){ seen[(y+1)*w+x]=1; q.push([x,y+1]); }
      } else {
        // set outside region semi-transparent
        mask.data[idx]=mask.data[idx+1]=mask.data[idx+2]=0; mask.data[idx+3]=255;
      }
    }
    L.mask.getContext('2d').putImageData(mask,0,0);
    // Feather the mask edges quickly by blur
    fastBlur(L.mask, Math.round(6*feather+1));
  }

  // simple stack box blur
  function fastBlur(c, r){
    if(r<=1) return;
    const g=c.getContext('2d'); const w=c.width,h=c.height; const id=g.getImageData(0,0,w,h); const a=id.data;
    // horizontal pass
    for(let y=0;y<h;y++){
      let s=0, o=y*w*4;
      for(let x=-r;x<=r;x++){ s+=a[o+clamp(x,0,w-1)*4+3]; }
      for(let x=0;x<w;x++){
        a[o+x*4+3]=Math.round(s/(2*r+1));
        const xl=clamp(x-r,0,w-1), xr=clamp(x+r+1,0,w-1);
        s+=a[o+xr*4+3]-a[o+xl*4+3];
      }
    }
    // vertical pass
    for(let x=0;x<w;x++){
      let s=0;
      for(let y=-r;y<=r;y++){ s+=a[clamp(y,0,h-1)*w*4+x*4+3]; }
      for(let y=0;y<h;y++){
        a[y*w*4+x*4+3]=Math.round(s/(2*r+1));
        const yt=clamp(y-r,0,h-1), yb=clamp(y+r+1,0,h-1);
        s+=a[yb*w*4+x*4+3]-a[yt*w*4+x*4+3];
      }
    }
    g.putImageData(id,0,0);
  }

  // ---------------- Transform (handles) ----------------
  function drawHandles(L){
    const wrap = canvas.getBoundingClientRect();
    const t = ctx.getTransform();
    // compute bbox in canvas logical units
    const bw = (L.type==='raster' && L.data)? L.data.width : (L.type==='shape' ? (L.shape.kind==='line'?220:200) : 200);
    const bh = (L.type==='raster' && L.data)? L.data.height: (L.type==='shape' ? (L.shape.kind==='line'?0:140) : 60);
    const pts = [
      {x:0,y:0},{x:bw,y:0},{x:bw,y:bh},{x:0,y:bh}
    ].map(p=>applyTF(L,p.x,p.y));
    // draw box
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath();
    ctx.strokeStyle='#1d4ed8'; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }
  function applyTF(L,x,y){
    const s=L.scale||1, r=rad(L.rot||0), cx=L.x, cy=L.y;
    const xr=x*s, yr=y*s;
    const rx= xr*Math.cos(r)-yr*Math.sin(r)+cx;
    const ry= xr*Math.sin(r)+yr*Math.cos(r)+cy;
    return {x:rx,y:ry};
  }
  function hitHandle(L,p){ // simple: return 'move' always; handles can be expanded later
    return 'move';
  }
  function dragTransform(L, a, b){
    if(tf.handle==='move'){ L.x += b.x - a.x; L.y += b.y - a.y; return; }
  }

  // ---------------- Crop ----------------
  function drawCropUI(){
    const ov=$('#ib-crop-overlay'), rc=$('#ib-crop-rect'); if(!ov||!rc) return;
    const r = canvas.getBoundingClientRect();
    const css = (x)=>Math.round(x / DPR * (r.width / canvas.width));
    rc.style.left   = css(Math.min(crop.x, crop.x+crop.w))+'px';
    rc.style.top    = css(Math.min(crop.y, crop.y+crop.h))+'px';
    rc.style.width  = css(Math.abs(crop.w))+'px';
    rc.style.height = css(Math.abs(crop.h))+'px';
  }
  function applyCrop(){
    const x=Math.round(Math.min(crop.x, crop.x+crop.w));
    const y=Math.round(Math.min(crop.y, crop.y+crop.h));
    const w=Math.round(Math.abs(crop.w));
    const h=Math.round(Math.abs(crop.h));
    if(w<10||h<10){ crop.on=false; return; }
    // crop each raster (data & mask)
    for(const L of layers){
      if(L.type==='raster'){
        const cut = sliceCanvas(L.data,x-L.x,y-L.y,w,h,L);
        L.data = cut;
        if(L.mask){ L.mask = sliceCanvas(L.mask,x-L.x,y-L.y,w,h,L); }
        L.x = 0; L.y = 0;
      }
    }
    canvas.width = w*DPR; canvas.height = h*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
    crop.on=false; $('#ib-crop-overlay')?.classList.add('ib-hidden'); $('#ib-crop-rect')?.classList.add('ib-hidden');
    fitCanvasToContainer(); render(); pushHistory('crop');
  }
  function sliceCanvas(src, sx, sy, w, h, L){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d'); g.drawImage(src, -sx, -sy);
    return c;
  }

  // ---------------- Bind properties ----------------
  bind('#ib-layer-name', e=>{ if(active<0) return; layers[active].name = e.target.value; syncUI(); });
  bind('#ib-visible',    e=>{ if(active<0) return; layers[active].visible = e.target.checked; render(); syncUI(); });
  bind('#ib-opacity',    e=>{ if(active<0) return; layers[active].opacity = +e.target.value; render(); });
  bind('#ib-blend',      e=>{ if(active<0) return; layers[active].blend = e.target.value; render(); });
  bind('#ib-x',          e=>{ if(active<0) return; layers[active].x = +e.target.value; render(); });
  bind('#ib-y',          e=>{ if(active<0) return; layers[active].y = +e.target.value; render(); });
  bind('#ib-scale',      e=>{ if(active<0) return; layers[active].scale = +e.target.value; render(); });
  bind('#ib-rot',        e=>{ if(active<0) return; layers[active].rot = +e.target.value; render(); });

  // Filters
  const fBr=$('#ib-f-br'), fCo=$('#ib-f-co'), fSa=$('#ib-f-sa'), fBl=$('#ib-f-bl'), fHu=$('#ib-f-hu');
  [fBr,fCo,fSa,fBl,fHu].forEach(inp=>inp&&inp.addEventListener('input', ()=>{
    if(active<0) return; const F = layers[active].filter;
    F.br=+fBr.value; F.co=+fCo.value; F.sa=+fSa.value; F.bl=+fBl.value; F.hu=+fHu.value; render();
  }));
  $('#ib-f-reset')?.addEventListener('click', ()=>{ if(active<0) return; layers[active].filter={br:1,co:1,sa:1,bl:0,hu:0}; render(); syncUI(); });

  // Shape style
  bind('#ib-fill',    ()=>{ if(active<0||layers[active].type!=='shape') return; layers[active].shape.fill   = $('#ib-fill').value; render(); });
  bind('#ib-stroke',  ()=>{ if(active<0||layers[active].type!=='shape') return; layers[active].shape.stroke = $('#ib-stroke').value; render(); });
  bind('#ib-stroke-w',()=>{ if(active<0||layers[active].type!=='shape') return; layers[active].shape.strokeW= +$('#ib-stroke-w').value; render(); });
  bind('#ib-grad',    ()=>{ if(active<0||layers[active].type!=='shape') return; layers[active].shape.grad   = $('#ib-grad').value; render(); });

  function bind(sel, fn){ const el=$(sel); if(el) el.addEventListener('input', fn); }

  // ---------------- Layer ops ----------------
  $('#ib-layer-up')?.addEventListener('click', ()=>{ if(active<0) return; const i = active; if(i>=layers.length-1) return; [layers[i], layers[i+1]]=[layers[i+1], layers[i]]; active=i+1; pushHistory('up'); render(); syncUI(); });
  $('#ib-layer-down')?.addEventListener('click', ()=>{ if(active<=0) return; const i = active; [layers[i], layers[i-1]]=[layers[i-1], layers[i]]; active=i-1; pushHistory('down'); render(); syncUI(); });
  $('#ib-layer-dup')?.addEventListener('click', ()=>{ if(active<0) return; const L = layers[active];
    const C = JSON.parse(JSON.stringify({...L, id:uid()}));
    if(L.type==='raster'){ const c=document.createElement('canvas'); c.width=L.data.width; c.height=L.data.height; c.getContext('2d').drawImage(L.data,0,0); C.data=c; if(L.mask){ const m=document.createElement('canvas'); m.width=L.mask.width; m.height=L.mask.height; m.getContext('2d').drawImage(L.mask,0,0); C.mask=m; } }
    layers.splice(active+1,0,C); active=active+1; pushHistory('dup'); render(); syncUI(); });
  $('#ib-layer-del')?.addEventListener('click', ()=>{ if(active<0) return; layers.splice(active,1); active = Math.min(active,layers.length-1); pushHistory('del'); render(); syncUI(); });

  // ---------------- Shortcuts ----------------
  document.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(k==='v') selectTool('move');
    if(k==='f') selectTool('transform');
    if(k==='c') selectTool('crop');
    if(k==='m') selectTool('blend');
    if(k==='k') selectTool('mask-eraser');
    if(k==='a') selectTool('cutout');
    if(k==='b') selectTool('brush');
    if(k==='e') selectTool('eraser');
    if(k==='t') selectTool('text');
    if(k==='u') selectTool('rect');
    if(k==='o') selectTool('ellipse');
    if(k==='l') selectTool('line');
    if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); undo(); }
    if((e.ctrlKey||e.metaKey) && e.shiftKey && k==='z'){ e.preventDefault(); redo(); }
  });
  function selectTool(name){
    tool = name; $$('.ib-tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===name));
  }

  function undo(){ if(hIndex<=0) return; hIndex--; restoreFrom(history[hIndex]); }
  function redo(){ if(hIndex>=history.length-1) return; hIndex++; restoreFrom(history[hIndex]); }
  $('#ib-undo')?.addEventListener('click', undo);
  $('#ib-redo')?.addEventListener('click', redo);

  // ---------------- Import / New / Export ----------------
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
      pushHistory('import');
    };
    img.src = URL.createObjectURL(f); e.target.value = '';
  });

  $('#ib-new')?.addEventListener('click', ()=>{
    layers = []; active = -1;
    canvas.width = 1280*DPR; canvas.height=720*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
    fitCanvasToContainer(); pushHistory('new'); render(); syncUI();
  });

  $('#ib-export')?.addEventListener('click', ()=>{
    const fmt = $('#ib-export-format').value;
    const q = +$('#ib-export-quality').value || 0.95;
    const a = document.createElement('a');
    a.download = `ib-image-${Date.now()}.${fmt.split('/')[1].replace('jpeg','jpg')}`;
    a.href = canvas.toDataURL(fmt, q);
    a.click();
  });

  // ------------- SVG Export (vectors + embedded rasters optional) -------------
  $('#ib-export-svg')?.addEventListener('click', ()=>{
    const w = Math.round(canvas.width/DPR), h=Math.round(canvas.height/DPR);
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
    for(const L of layers){
      if(!L.visible) continue;
      const tr = `translate(${L.x} ${L.y}) rotate(${L.rot||0}) scale(${L.scale||1})`;
      if(L.type==='shape'){
        const S=L.shape;
        const fill = S.fill;
        if(S.kind==='rect'){
          parts.push(`<g transform="${tr}" opacity="${L.opacity}"><rect x="0" y="0" width="200" height="140" fill="${fill}" stroke="${S.stroke}" stroke-width="${S.strokeW}"/></g>`);
        } else if(S.kind==='ellipse'){
          parts.push(`<g transform="${tr}" opacity="${L.opacity}"><ellipse cx="100" cy="70" rx="100" ry="70" fill="${fill}" stroke="${S.stroke}" stroke-width="${S.strokeW}"/></g>`);
        } else if(S.kind==='line'){
          parts.push(`<g transform="${tr}" opacity="${L.opacity}"><line x1="0" y1="0" x2="220" y2="0" stroke="${S.stroke}" stroke-width="${S.strokeW}"/></g>`);
        }
      } else if(L.type==='text'){
        const T=L.text; const f=`${T.weight} ${T.size}px ${T.font}`;
        parts.push(`<g transform="${tr}" opacity="${L.opacity}"><text x="0" y="0" fill="${T.color}" font="${f}">${escapeXML(T.value)}</text></g>`);
      } else if(L.type==='raster' && L.data){
        // embed raster; note: mask not applied in SVG export (kept simple)
        const href = L.data.toDataURL('image/png');
        parts.push(`<g transform="${tr}" opacity="${L.opacity}"><image href="${href}" x="0" y="0"/></g>`);
      }
    }
    parts.push(`</svg>`);
    const blob = new Blob(parts, {type:'image/svg+xml'});
    const a = document.createElement('a'); a.download=`ib-vectors-${Date.now()}.svg`; a.href=URL.createObjectURL(blob); a.click();
  });
  function escapeXML(s){ return String(s).replace(/[<>&'"]/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[m])); }

  // ---------------- Text inline editing ----------------
  canvas.addEventListener('dblclick', e=>{
    if(active<0) return; const L = layers[active];
    if(L.type!=='text') return;
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
    const ta = $('#ib-textarea'); ta.style.left = x+'px'; ta.style.top = y+'px';
    ta.value = L.text.value; ta.classList.remove('ib-hidden'); ta.focus();
    const commit = ()=>{ L.text.value = ta.value; ta.classList.add('ib-hidden'); render(); pushHistory('text'); };
    ta.onblur = commit; ta.onkeydown = ev=>{ if(ev.key==='Enter' && (ev.ctrlKey||ev.metaKey)) { ev.preventDefault(); commit(); } };
  });

  // ---------------- Init ----------------
  $('#ib-new')?.click(); // blank doc
  fitCanvasToContainer();

})();
