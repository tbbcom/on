/* IB Photo Studio v1.0.3-transform — minimal UI + Blend + Transform */
(() => {
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const canvas=$('#ib-canvas'), ctx=canvas.getContext('2d');
  const DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));

  let layers=[], active=-1, tool='move', painting=false, start={x:0,y:0};
  const paint={color:'#2b2b2b',size:36,opacity:1,feather:.7};

  const history=[]; let hIndex=-1; const MAX_H=40;

  const uid=()=> 'ib_'+Math.random().toString(36).slice(2,9);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rad=d=>d*Math.PI/180;
  const toFilter=f=>`brightness(${f.br}) contrast(${f.co}) saturate(${f.sa}) blur(${f.bl}px) hue-rotate(${f.hu}deg)`;

  function baseLayer(type,name){return {id:uid(),type,name,visible:true,opacity:1,blend:'source-over',x:0,y:0,scale:1,rot:0,filter:{br:1,co:1,sa:1,bl:0,hu:0},data:null,mask:null};}

  // ---------- History ----------
  function pushHistory(){const snap=JSON.stringify(layers.map(L=>({...L,data:(L.type==='raster'&&L.data)?L.data.toDataURL('image/png'):undefined,mask:(L.type==='raster'&&L.mask)?L.mask.toDataURL('image/png'):undefined})));history.splice(hIndex+1);history.push(snap);if(history.length>MAX_H)history.shift();hIndex=history.length-1;syncHistory();}
  function restoreFrom(json){const arr=JSON.parse(json);layers=arr.map(o=>{const L={...o};if(o.type==='raster'){const mk=d=>new Promise(r=>{if(!d)return r(null);const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);r(c)};i.src=d;});return Promise.all([mk(o.data),mk(o.mask)]).then(([d,m])=>{L.data=d;L.mask=m;return L;});}return L;});Promise.all(layers).then(v=>{layers=v;active=Math.min(active,layers.length-1);render();syncUI();syncHistory();});}

  // ---------- Sizing ----------
  function fitCanvasToContainer(){
    const stage = document.querySelector('#ib-editor .ib-stage');
    const wrap  = document.querySelector('#ib-editor .ib-canvas-wrap');

    if (!canvas || !ctx) return;
    if (!stage || !wrap) return; // wait until DOM exists

    const rect = stage.getBoundingClientRect();
    const cs   = getComputedStyle(stage);
    const padX = (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);

    // Pick the largest sensible width from several sources
    let avail = 0;
    const candidates = [
      (rect?.width || 0) - padX,
      (stage.clientWidth || 0) - padX,
      (wrap.getBoundingClientRect?.().width || 0),
      (document.documentElement?.clientWidth || 0) * 0.6
    ];
    for (const v of candidates) if (isFinite(v) && v > 0) avail = Math.max(avail, v);

    // Desktop guard: avoid tiny canvas if layout not ready
    if (window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
      avail = Math.max(avail, 720);
    }

    const targetW = Math.floor(Math.min(1600, Math.max(360, avail)));
    const ar      = (canvas.height / canvas.width) || (9/16);
    const targetH = Math.floor(Math.max(320, targetW * ar));

    // Apply CSS size
    canvas.style.width  = targetW + 'px';
    canvas.style.height = targetH + 'px';

    // Backing store for HiDPI
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width  = Math.floor(targetW * dpr);
    canvas.height = Math.floor(targetH * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);

    render();
  }

  // Re-run sizing whenever layout changes (e.g. Blogger preview toggles)
  function initSizing(){
    const stageEl = document.querySelector('#ib-editor .ib-stage');
    if (stageEl && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => fitCanvasToContainer());
      ro.observe(stageEl);
    }
    window.addEventListener('resize', fitCanvasToContainer, { passive:true });
    // Kick once after paint; repeat shortly in case fonts/layout settle late
    requestAnimationFrame(() => {
      fitCanvasToContainer();
      setTimeout(fitCanvasToContainer, 50);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSizing, { once:true });
  } else {
    initSizing();
  }

  // ---------- Transform helpers ----------
  function layerSize(L){
    if(L.type==='raster'&&L.data) return {w:L.data.width,h:L.data.height};
    if(L.type==='shape'){ if(L.shape.kind==='line') return {w:220,h:0}; return {w:200,h:140}; }
    if(L.type==='text'){ return {w:300,h:L.text.size*1.3}; }
    return {w:200,h:140};
  }
  function toWorld(L,x,y){const s=L.scale||1,r=rad(L.rot||0);return {x:x*s*Math.cos(r)-y*s*Math.sin(r)+L.x, y:x*s*Math.sin(r)+y*s*Math.cos(r)+L.y};}
  function toLocal(L,x,y){const s=L.scale||1,r=rad(L.rot||0),dx=x-L.x,dy=y-L.y;return {x:( dx*Math.cos(-r)-dy*Math.sin(-r))/s, y:( dx*Math.sin(-r)+dy*Math.cos(-r))/s};}

  function drawHandles(L){
    const {w,h}=layerSize(L);
    const c=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}].map(p=>toWorld(L,p.x,p.y));
    ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.beginPath();ctx.moveTo(c[0].x,c[0].y);for(let i=1;i<4;i++)ctx.lineTo(c[i].x,c[i].y);ctx.closePath();
    ctx.strokeStyle='#1d4ed8';ctx.lineWidth=1;ctx.stroke();
    // corner squares
    for(const p of c){ctx.fillStyle='#fff';ctx.strokeStyle='#1d4ed8';ctx.lineWidth=2;ctx.beginPath();ctx.rect(p.x-6,p.y-6,12,12);ctx.fill();ctx.stroke();}
    // rotate handle (top-center)
    const top=toWorld(L,w/2,-30);ctx.beginPath();ctx.arc(top.x,top.y,6,0,2*Math.PI);ctx.fill();ctx.stroke();
    ctx.restore();
  }

  let tfMode=null, tfRef=null; // 'move'|'scale-nw/ne/sw/se'|'rotate'

  function hitHandle(L,p){
    const {w,h}=layerSize(L);
    const local=toLocal(L,p.x,p.y);
    const near=(ax,ay)=>Math.hypot(local.x-ax,local.y-ay)<=12;
    if(near(0,0)) return 'scale-nw';
    if(near(w,0)) return 'scale-ne';
    if(near(w,h)) return 'scale-se';
    if(near(0,h)) return 'scale-sw';
    // rotate handle zone (top-center at y=-30)
    const rotLocal = toLocal(L,p.x,p.y); if(Math.hypot(rotLocal.x-w/2, rotLocal.y+30)<=12) return 'rotate';
    // inside box => move
    if(local.x>=0&&local.x<=w&&local.y>=0&&local.y<=h) return 'move';
    return null;
  }

  function dragTransform(L,a,b){
    if(tfMode==='move'){L.x+=b.x-a.x;L.y+=b.y-a.y;return;}
    const {w,h}=layerSize(L);
    if(tfMode&&tfMode.startsWith('scale')){
      // scale relative to opposite corner
      const opp = tfMode==='scale-nw'?{x:w,y:h}:tfMode==='scale-ne'?{x:0,y:h}:tfMode==='scale-se'?{x:0,y:0}:{x:w,y:0};
      const la=toLocal(L,a.x,a.y), lb=toLocal(L,b.x,b.y);
      const da=Math.hypot(la.x-opp.x,la.y-opp.y), db=Math.hypot(lb.x-opp.x,lb.y-opp.y);
      if(da>0){ const s=L.scale* (db/da); L.scale=clamp(s,0.05,10); }
      // keep anchor fixed in world coords
      const worldOpp=toWorld(L,opp.x,opp.y); L.x+= (worldOpp.x - toWorld(L,opp.x,opp.y).x); L.y+= (worldOpp.y - toWorld(L,opp.x,opp.y).y);
      return;
    }
    if(tfMode==='rotate'){
      const center=toWorld(L,w/2,h/2);
      const angA=Math.atan2(a.y-center.y,a.x-center.x);
      const angB=Math.atan2(b.y-center.y,b.x-center.x);
      L.rot += (angB-angA)*180/Math.PI;
    }
  }

  // ---------- UI sync ----------
  function syncUI(){
    const list=$('#ib-layer-list'); if(list){list.innerHTML='';layers.forEach((L,i)=>{const li=document.createElement('li');li.dataset.index=i;li.className=i===active?'active':'';li.innerHTML=`<span>${L.name} • ${L.type}</span><span>${L.visible?'👁':'🚫'}</span>`;li.addEventListener('click',()=>{active=i;syncUI();render();});list.prepend(li);});}
    const L=layers[active]||null;
    setV('#ib-layer-name',L?.name??''); setC('#ib-visible',L?.visible??false); setV('#ib-opacity',L?.opacity??1); setV('#ib-blend',L?.blend??'source-over');
    setV('#ib-x',L?.x??0); setV('#ib-y',L?.y??0); setV('#ib-scale',L?.scale??1); setV('#ib-rot',L?.rot??0);
    setV('#ib-f-br',L?.filter.br??1); setV('#ib-f-co',L?.filter.co??1); setV('#ib-f-sa',L?.filter.sa??1); setV('#ib-f-bl',L?.filter.bl??0); setV('#ib-f-hu',L?.filter.hu??0);
  }
  function syncHistory(){const ul=$('#ib-history'); if(!ul) return; ul.innerHTML=''; history.forEach((_,i)=>{const li=document.createElement('li');li.className=i===hIndex?'active':'';li.textContent=`Step ${i+1}`;li.addEventListener('click',()=>{hIndex=i;restoreFrom(history[hIndex]);});ul.appendChild(li);});}
  const setV=(s,v)=>{const el=$(s); if(el) el.value=v;}, setC=(s,v)=>{const el=$(s); if(el) el.checked=v;};

  // ---------- Tool selection ----------
  $$('.ib-tool').forEach(b=>b.addEventListener('click',()=>{$$('.ib-tool').forEach(s=>s.classList.remove('active')); b.classList.add('active'); tool=b.dataset.tool; render();}));
  $('#ib-color')?.addEventListener('input',e=>paint.color=e.target.value);
  $('#ib-size')?.addEventListener('input',e=>paint.size=+e.target.value);
  $('#ib-paint-opacity')?.addEventListener('input',e=>paint.opacity=+e.target.value);
  $('#ib-feather')?.addEventListener('input',e=>paint.feather=+e.target.value);

  // ---------- Pointer ----------
  const pos=ev=>{const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*(canvas.width/r.width)/DPR,y:(ev.clientY-r.top)*(canvas.height/r.height)/DPR}};
  canvas.addEventListener('pointerdown',e=>{
    const p=pos(e); start=p; painting=true; const L=layers[active];
    if(tool==='blend'||tool==='mask-eraser'){ if(!L||L.type!=='raster') return; ensureMask(L); paintMaskAt(L,p.x,p.y,tool==='mask-eraser'); render(); }
    else if(tool==='brush'||tool==='eraser'){ if(!L||L.type!=='raster'){addBrushLayerIfNeeded();} drawDot(p.x,p.y,tool==='eraser'); }
    else if(tool==='text'){ addTextAt(p.x,p.y); }
    else if(tool==='transform' && L){ tfMode = hitHandle(L,p); tfRef=p; }
  });
  canvas.addEventListener('pointermove',e=>{
    if(!painting) return; const p=pos(e);
    if(tool==='blend'||tool==='mask-eraser'){ const L=layers[active]; if(!L||L.type!=='raster') return; paintMaskStroke(L,start.x,start.y,p.x,p.y,tool==='mask-eraser'); start=p; render(); }
    else if(tool==='brush'||tool==='eraser'){ strokeTo(p.x,p.y,tool==='eraser'); start=p; }
    else if(tool==='move'){ if(active<0) return; const L=layers[active]; L.x+=p.x-start.x; L.y+=p.y-start.y; start=p; render(); }
    else if(tool==='transform' && layers[active] && tfMode){ dragTransform(layers[active], start, p); start=p; render(); }
  });
  window.addEventListener('pointerup',()=>{ if(!painting) return; painting=false; if(tool==='transform') tfMode=null; pushHistory(); });

  function ensureMask(L){ if(L.type!=='raster') return; if(!L.mask){L.mask=document.createElement('canvas');L.mask.width=L.data.width;L.mask.height=L.data.height;L.mask.getContext('2d').fillStyle='#fff';L.mask.getContext('2d').fillRect(0,0,L.mask.width,L.mask.height);} }
  function paintMaskAt(L,x,y,erase=false){const g=L.mask.getContext('2d');const r=paint.size/2,f=clamp(paint.feather,0,1);const q=g.createRadialGradient(x,y,r*.05,x,y,r);
    if(!erase){q.addColorStop(0,`rgba(255,255,255,${paint.opacity})`);q.addColorStop(f,`rgba(255,255,255,${paint.opacity*.6})`);q.addColorStop(1,'rgba(255,255,255,0)');}
    else{q.addColorStop(0,`rgba(0,0,0,${paint.opacity})`);q.addColorStop(f,`rgba(0,0,0,${paint.opacity*.6})`);q.addColorStop(1,'rgba(0,0,0,0)');}
    g.globalCompositeOperation='source-over';g.fillStyle=q;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
  function paintMaskStroke(L,x0,y0,x1,y1,erase){const dx=x1-x0,dy=y1-y0,steps=Math.max(2,Math.ceil(Math.hypot(dx,dy)/(paint.size*.5)));for(let i=1;i<=steps;i++){const t=i/steps;paintMaskAt(L,x0+dx*t,y0+dy*t,erase);}}
  function drawDot(x,y,erase){const L=layers[active],g=L.data.getContext('2d');g.globalCompositeOperation=erase?'destination-out':'source-over';g.globalAlpha=paint.opacity;g.fillStyle=paint.color;g.beginPath();g.arc(x,y,paint.size/2,0,Math.PI*2);g.fill();render();}
  function strokeTo(x,y,erase){const L=layers[active],g=L.data.getContext('2d');g.globalCompositeOperation=erase?'destination-out':'source-over';g.globalAlpha=paint.opacity;g.strokeStyle=paint.color;g.lineWidth=paint.size;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(start.x,start.y);g.lineTo(x,y);g.stroke();render();}

  // Bind props
  bind('#ib-layer-name',e=>{if(active<0)return;layers[active].name=e.target.value;syncUI();});
  bind('#ib-visible',e=>{if(active<0)return;layers[active].visible=e.target.checked;render();syncUI();});
  bind('#ib-opacity',e=>{if(active<0)return;layers[active].opacity=+e.target.value;render();});
  bind('#ib-blend',e=>{if(active<0)return;layers[active].blend=e.target.value;render();});
  bind('#ib-x',e=>{if(active<0)return;layers[active].x=+e.target.value;render();});
  bind('#ib-y',e=>{if(active<0)return;layers[active].y=+e.target.value;render();});
  bind('#ib-scale',e=>{if(active<0)return;layers[active].scale=+e.target.value;render();});
  bind('#ib-rot',e=>{if(active<0)return;layers[active].rot=+e.target.value;render();});
  const fBr=$('#ib-f-br'),fCo=$('#ib-f-co'),fSa=$('#ib-f-sa'),fBl=$('#ib-f-bl'),fHu=$('#ib-f-hu');
  [fBr,fCo,fSa,fBl,fHu].forEach(i=>i&&i.addEventListener('input',()=>{if(active<0)return;const F=layers[active].filter;F.br=+fBr.value;F.co=+fCo.value;F.sa=+fSa.value;F.bl=+fBl.value;F.hu=+fHu.value;render();}));
  function bind(s,fn){const el=$(s);if(el)el.addEventListener('input',fn);}

  // Layer ops
  $('#ib-layer-up')?.addEventListener('click',()=>{if(active<0||active>=layers.length-1)return;[layers[active],layers[active+1]]=[layers[active+1],layers[active]];active++;pushHistory();render();syncUI();});
  $('#ib-layer-down')?.addEventListener('click',()=>{if(active<=0)return;[layers[active],layers[active-1]]=[layers[active-1],layers[active]];active--;pushHistory();render();syncUI();});
  $('#ib-layer-dup')?.addEventListener('click',()=>{if(active<0)return;const L=layers[active];const C=JSON.parse(JSON.stringify({...L,id:uid()}));if(L.type==='raster'){const c=document.createElement('canvas');c.width=L.data.width;c.height=L.data.height;c.getContext('2d').drawImage(L.data,0,0);C.data=c;if(L.mask){const m=document.createElement('canvas');m.width=L.mask.width;m.height=L.mask.height;m.getContext('2d').drawImage(L.mask,0,0);C.mask=m;}}layers.splice(active+1,0,C);active++;pushHistory();render();syncUI();});
  $('#ib-layer-del')?.addEventListener('click',()=>{if(active<0)return;layers.splice(active,1);active=Math.min(active,layers.length-1);pushHistory();render();syncUI();});

  // Shortcuts
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase(); if(k==='v')sel('move'); if(k==='f')sel('transform'); if(k==='m')sel('blend'); if(k==='k')sel('mask-eraser'); if(k==='b')sel('brush'); if(k==='e')sel('eraser'); if(k==='t')sel('text'); if(k==='u')sel('rect'); if(k==='o')sel('ellipse'); if(k==='l')sel('line'); if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();undo();} if((e.ctrlKey||e.metaKey)&&e.shiftKey&&k==='z'){e.preventDefault();redo();}});
  function sel(n){tool=n; $$('.ib-tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===n)); render(); }
  function undo(){if(hIndex<=0)return;hIndex--;restoreFrom(history[hIndex]);}
  function redo(){if(hIndex>=history.length-1)return;hIndex++;restoreFrom(history[hIndex]);}
  $('#ib-undo')?.addEventListener('click',undo); $('#ib-redo')?.addEventListener('click',redo);

  // Import/New/Export
  $('#ib-file')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const img=new Image();img.onload=()=>{const r=img.height/img.width,w=Math.min(1400,Math.max(640,img.width)),h=Math.max(360,Math.round(w*r));canvas.width=w*DPR;canvas.height=h*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);fitCanvasToContainer();addRasterFromImage(img,f.name.replace(/\.[^.]+$/,''));pushHistory();};img.src=URL.createObjectURL(f);e.target.value='';});
  $('#ib-new')?.addEventListener('click',()=>{layers=[];active=-1;canvas.width=1280*DPR;canvas.height=720*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);fitCanvasToContainer();pushHistory();render();syncUI();});
  $('#ib-export')?.addEventListener('click',()=>{const fmt=$('#ib-export-format').value,q=+$('#ib-export-quality').value||0.95;const a=document.createElement('a');a.download=`ib-image-${Date.now()}.${fmt.split('/')[1].replace('jpeg','jpg')}`;a.href=canvas.toDataURL(fmt,q);a.click();});

  // Text inline edit
  canvas.addEventListener('dblclick',e=>{if(active<0||layers[active].type!=='text')return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const ta=$('#ib-textarea');ta.style.left=x+'px';ta.style.top=y+'px';ta.value=layers[active].text.value;ta.classList.remove('ib-hidden');ta.focus();const commit=()=>{layers[active].text.value=ta.value;ta.classList.add('ib-hidden');render();pushHistory();};ta.onblur=commit;ta.onkeydown=ev=>{if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();commit();}};});

  // init
  $('#ib-new')?.click(); fitCanvasToContainer();
  $('#ib-layer-del')?.addEventListener('click',()=>{if(active<0)return;layers.splice(active,1);active=Math.min(active,layers.length-1);pushHistory();render();syncUI();});
})();
