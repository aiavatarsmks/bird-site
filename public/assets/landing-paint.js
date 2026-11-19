'use strict';
/* Painted landing (owner, 17 Nov): real old-master pictures, painted in on the page as their sections appear. The hand-made
   counterpoint to the strict timetable UI; the loading of each picture is hidden inside its painting.

   This file is plumbing only: which picture goes where, loading it at the right size, canvases and their pixel budget,
   when a plate starts, resize, reduced motion, the programme line pinned over the "How it works" painting, and a few
   image-analysis helpers (luminance grid, edge tracing, noise). HOW a picture is born is entirely the variant's:
     ?art=watercolour (default)  assets/paint-watercolour.js  Dürer, Girtin, Turner: pencil, wet washes blooming from drops
     ?art=oil                    assets/paint-oil.js          Patinir, Bruegel, Altdorfer, Bellini: sanguine, dead colour,
                                                              glazes and lights laid stroke by stroke
   Only the chosen variant's script and pictures are fetched. Canvas 2D only (no WebGL needed). Reduced motion: every
   picture appears finished and nothing moves afterwards. Credits: docs/ART-CREDITS.md and the line in the footer.

   Performance (owner, 18 Nov: "the site loads slowly"; the sections below the hero now carry large pictures):
   - the hero paints first; the other plates wait until it is done (or the visitor has scrolled past it), then each
     picture is fetched only when its section is within 500 px, at the size its plate needs (srcset, AVIF/WebP);
   - pictures are cropped and scaled off the main thread (createImageBitmap) and analysed at no more than the
     picture's own resolution; every heavy stage yields to the browser (scheduler.yield, setTimeout fallback) after
     ~8 ms, so preparing a plate never blocks input or the hero animation;
   - a plate below the hero paints once; after that its working layers are dropped and nothing redraws it;
   - the watchdog (a frame over 70 ms three times, or the scene overrunning) shows the finished picture at once. */
(()=>{
const root=document.documentElement;
const plates=[...document.querySelectorAll('[data-paint]')];
if(!plates.length||!('IntersectionObserver' in window)||!window.CanvasRenderingContext2D)return;
const ART=root.dataset.art==='oil'?'oil':'watercolour';
root.dataset.art=ART;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const debug=window.__evPaint={art:ART,scenes:{},errors:[],ev:[]};
const ev=k=>debug.ev.push([Math.round(performance.now()),k]);

/* Pictures per placement: file stem in assets/art/, widths on disk, aspect ratio, focal point (kept in view when cropped),
   and for "how" the three places the programme stations are pinned to (fractions of the picture). */
const PICS={
 watercolour:{
  hero:{f:'wc-hero',w:[800,1200,1600],ar:1.527,focal:[.42,.62]},          // Dürer, View of Trento from the north, 1495
  pains:{f:'wc-pains',w:[800,960,1200],ar:1.923,focal:[.42,.66]},         // Girtin, The White House at Chelsea, 1800
  how:{f:'wc-how',w:[800,1200,1600],ar:2.038,focal:[.55,.42],             // Dürer, The wire-drawing mill, c.1494
   pins:[[.215,.4],[.6,.27],[.86,.2]]},                                   //   the bridge, the mill, the far fields
  map:{f:'wc-map',w:[800,1200],ar:1.611,focal:[.5,.45]},                  // Dürer, View of Arco, 1495
  faq:{f:'wc-faq',w:[480,720,960],ar:.825,focal:[.5,.6]},                 // Dürer, The Large Piece of Turf, 1503
  act:{f:'wc-act',w:[800,1200,1600],ar:1.763,focal:[.56,.6]}              // Turner, The Red Rigi, 1842
 },
 oil:{
  hero:{f:'oil-hero',w:[800,1200,1600],ar:1.224,focal:[.62,.32]},         // Patinir, Landscape with St Jerome, c.1516
  pains:{f:'oil-pains',w:[800,960,1200],ar:1.565,focal:[.62,.55]},        // after Bruegel, Landscape with the Fall of Icarus
  how:{f:'oil-how',w:[800,1200,1600],ar:1.849,focal:[.5,.45],             // Bruegel, Hunters in the Snow, 1565
   pins:[[.11,.56],[.6,.47],[.87,.18]]},                                  //   the inn, the village pond, the peaks
  map:{f:'oil-map',w:[800,1200],ar:1.5,focal:[.4,.55]},                   // Altdorfer, Danube landscape, c.1528
  faq:{f:'oil-faq',w:[480,720,960],ar:.862,focal:[.45,.3]},               // Bellini, St Francis in the Desert, c.1480
  act:{f:'oil-act',w:[800,1200,1600],ar:2.326,focal:[.45,.5]}             // Bruegel, The Harvesters, 1565
 }
};
// The hero picture is preloaded by the head script with the same srcset and sizes, so this request reuses it.
const HERO_SIZES='(min-width: 1024px) 66vw, 100vw';
const srcset=(p,ext)=>p.w.map(w=>`assets/art/${p.f}-${w}.${ext} ${w}w`).join(', ');

/* ---------- yielding: heavy work runs in slices of ~8 ms ---------- */
const yieldNow=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(r=>setTimeout(r,0));
let slice=performance.now();
const BUDGET=8;
// Call often inside loops (per row): yields only when the current slice is used up.
const pace=()=>performance.now()-slice>BUDGET?yieldNow().then(()=>{slice=performance.now();}):null;
// Call between heavy stages: always yields.
const breathe=()=>yieldNow().then(()=>{slice=performance.now();});

/* ---------- helpers shared by both variants (analysis only; the reveal itself lives in each variant) ---------- */
const rng=s=>()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// read=true: a canvas whose pixels are read back (kept in CPU memory, so getImageData is cheap).
const canvas=(w,h,read)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));if(read)c.getContext('2d',{willReadFrequently:true});return c;};
// Value noise with a fixed lattice, and its fractal sum.
function makeNoise(seed){const r=rng(seed),P=new Float32Array(1024);for(let i=0;i<1024;i++)P[i]=r();
 const h=(x,y)=>P[((x*73856093)^(y*19349663))&1023];
 const n=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=h(xi,yi),b=h(xi+1,yi),c=h(xi,yi+1),d=h(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
 n.fbm=(x,y,o=4)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*n(x*f,y*f);t+=a;a*=.5;f*=2.03;}return s/t;};
 return n;}
// Luminance (0..1) and coverage (alpha) of a canvas on a coarse grid.
function lumGrid(src,gw,gh){const c=canvas(gw,gh,1),g=c.getContext('2d');g.drawImage(src,0,0,gw,gh);
 const d=g.getImageData(0,0,gw,gh).data,L=new Float32Array(gw*gh),A=new Float32Array(gw*gh);
 for(let i=0;i<gw*gh;i++){const a=d[i*4+3]/255;A[i]=a;L[i]=a?(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255/a:1;}
 return{L,A,gw,gh};}
async function sobel(L,gw,gh){const gx=new Float32Array(gw*gh),gy=new Float32Array(gw*gh),m=new Float32Array(gw*gh);
 for(let y=1;y<gh-1;y++){for(let x=1;x<gw-1;x++){const i=y*gw+x,
  a=L[i-gw-1],b=L[i-gw],c=L[i-gw+1],d=L[i-1],f=L[i+1],g=L[i+gw-1],h=L[i+gw],k=L[i+gw+1];
  const X=(c+2*f+k)-(a+2*d+g),Y=(g+2*h+k)-(a+2*b+c);gx[i]=X;gy[i]=Y;m[i]=Math.hypot(X,Y);}await pace();}
 return{gx,gy,m};}
/* Edges of a picture as hand-drawable chains: Sobel, thinning across the gradient, a percentile threshold, then
   8-neighbour chain following. Returns polylines in CSS pixels, longest first. */
async function traceEdges(src,W,H,{cell=2,keep=.11,min=6,max=900,weight=null}={}){
 const gw=Math.max(8,Math.round(W/cell)),gh=Math.max(8,Math.round(H/cell)),{L,A}=lumGrid(src,gw,gh);
 const B=new Float32Array(gw*gh);for(let y=1;y<gh-1;y++){for(let x=1;x<gw-1;x++){const i=y*gw+x;B[i]=(L[i]*4+L[i-1]+L[i+1]+L[i-gw]+L[i+gw])/8;}await pace();}
 const{gx,gy,m}=await sobel(B,gw,gh);
 for(let i=0;i<m.length;i++)m[i]*=A[i]*(weight?weight(i%gw*cell,(i/gw|0)*cell):1);
 await pace();
 const vals=[];for(let i=0;i<m.length;i+=3)if(m[i]>0)vals.push(m[i]);const sv=Float32Array.from(vals).sort();
 const T=sv.length?sv[Math.floor(sv.length*(1-keep))]:1;
 await breathe();
 const E=new Uint8Array(gw*gh);
 for(let y=1;y<gh-1;y++){for(let x=1;x<gw-1;x++){const i=y*gw+x,v=m[i];if(v<T)continue;
  const ax=Math.abs(gx[i]),ay=Math.abs(gy[i]);let o;
  if(ax>2.4*ay)o=1;else if(ay>2.4*ax)o=gw;else o=(gx[i]*gy[i]>0)?gw+1:gw-1;
  if(v>=m[i-o]&&v>=m[i+o])E[i]=1;}await pace();}
 const seen=new Uint8Array(gw*gh),N=[-gw-1,-gw,-gw+1,-1,1,gw-1,gw,gw+1],chains=[];
 const walk=(i,out)=>{let prev=-1;for(;;){let best=-1,bd=-1;for(const o of N){const j=i+o;if(j<0||j>=E.length||!E[j]||seen[j])continue;const s=prev<0?0:-(Math.abs(o-prev));if(best<0||s>bd){best=j;bd=s;}}
  if(best<0)return;seen[best]=1;out.push(best);prev=best-i;i=best;}};
 for(let i=0;i<E.length;i++){if(i%gw===0)await pace();if(!E[i]||seen[i])continue;seen[i]=1;const a=[i];walk(i,a);const b=[];walk(i,b);const all=b.reverse().concat(a);
  if(all.length>=min)chains.push(all);}
 chains.sort((a,b)=>b.length-a.length);
 return chains.slice(0,max).map(c=>{const pts=[];for(let k=0;k<c.length;k+=2){const i=c[k];pts.push([(i%gw+.5)*cell,((i/gw|0)+.5)*cell]);}
  const last=c[c.length-1];pts.push([(last%gw+.5)*cell,((last/gw|0)+.5)*cell]);let s=0;for(const i of c)s+=m[i];return{pts,len:c.length*cell,strength:s/c.length/(T||1)};});
}
// Cheap blur that works everywhere: down, then up with smoothing.
function soften(src,k){const s=canvas(src.width/k,src.height/k);s.getContext('2d').drawImage(src,0,0,s.width,s.height);return s;}
/* Pixel pass in bands of rows (read, edit, write back), yielding between bands, so no single read-back or loop
   holds the main thread: fn(D,i,x,y) edits the RGBA data of the band in place (i indexes the band, y is absolute). */
async function eachPixel(c,fn,out=c){const g=c.getContext('2d',{willReadFrequently:true}),o=out.getContext('2d'),w=c.width,h=c.height,band=Math.max(1,Math.floor(4096/w));// small bands: the first plate runs this code before the JIT has warmed it
 for(let y0=0;y0<h;y0+=band){const bh=Math.min(band,h-y0),id=g.getImageData(0,y0,w,bh),D=id.data;
  for(let y=y0,i=0;y<y0+bh;y++)for(let x=0;x<w;x++,i+=4)fn(D,i,x,y);
  o.putImageData(id,0,y0);await pace();}
 return out;}
const A={rng,clamp,smooth,canvas,makeNoise,lumGrid,sobel,traceEdges,soften,eachPixel,pace,breathe};

/* ---------- layout: where the picture sits in each plate, and where it must fade to paper ---------- */
function box(el,ref){const a=el.getBoundingClientRect(),b=ref.getBoundingClientRect();return{x:a.left-b.left,y:a.top-b.top,w:a.width,h:a.height,r:a.right-b.left,b:a.bottom-b.top};}
/* Cover rect R with a picture of aspect ar around its focal point; pinned places are kept inside the frame when they fit. */
function cover(R,pic){
 const w=Math.max(R.w,R.h*pic.ar),h=w/pic.ar;
 let x=clamp(R.w/2-pic.focal[0]*w,R.w-w,0),y=clamp(R.h/2-pic.focal[1]*h,R.h-h,0);
 if(pic.pins){const m=Math.min(28,R.w*.06),xs=pic.pins.map(p=>p[0]*w),ys=pic.pins.map(p=>p[1]*h);
  x=clamp(clamp(x,R.w-m-Math.max(...xs),m-Math.min(...xs)),R.w-w,0);y=clamp(clamp(y,R.h-m-Math.max(...ys),m-Math.min(...ys)),R.h-h,0);}
 return{x:R.x+x,y:R.y+y,w,h};
}
// Hero: the painting lies to the right of the copy (wide screens) or under it (phones) and dissolves into the paper
// before it reaches the text, so the headline always stands on bare paper (AA contrast).
function heroLayout(plate){
 const hero=plate.closest('.hero'),facts=hero.querySelector('.facts'),copy=hero.querySelector('.hero-copy');
 if(!facts||!copy)return null;
 const W=hero.clientWidth,H=Math.round(box(facts,hero).y+4),C=box(copy,hero),side=W>=1024;
 let R,fade;
 // Wide screens: the whole sheet is the picture, but under the copy only a pale ghost of it remains (the variant says
 // how pale: transparent watercolour can keep more than opaque oil).
 const gh=V.ghost??.1;
 if(side){R={x:0,y:0,w:W,h:H};
  fade=(x,y)=>{const dx=Math.max(C.x-16-x,0,x-C.r-16),dy=Math.max(C.y-16-y,0,y-C.b-16),d=Math.hypot(dx,dy);
   return(gh+(1-gh)*smooth(0,200,d))*smooth(0,46,y);};}
 else{const y0=Math.max(0,C.b+6);R={x:0,y:y0,w:W,h:H-y0};fade=(x,y)=>smooth(y0,y0+130,y);}
 return{W,H,R,fade,side,copy:C};
}
function plateLayout(plate){const W=plate.clientWidth,H=plate.clientHeight;if(!W||!H)return null;return{W,H,R:{x:0,y:0,w:W,h:H},fade:null};}
/* Working resolution: the device's, but never finer than the picture itself (a 1600 px picture on a 1250 px plate
   gains nothing from 2x), and within a pixel budget. Every layer of the paint-in is built at this resolution. */
function workDensity(L,pic,img,hero){
 const C=cover(L.R,pic),own=img.naturalWidth/C.w;
 let d=Math.min(window.devicePixelRatio||1,2,Math.max(1,own));
 const cap=hero?5.5e6:2.4e6;while(d>1&&L.W*L.H*d*d>cap)d-=.125;
 return Math.max(1,Math.round(d*8)/8);
}
// The picture, cropped and scaled off the main thread where the browser can (createImageBitmap), on a canvas the size
// of the scene; the hero then fades to paper where the copy stands.
async function placeArt(img,pic,L,d){
 const c=canvas(L.W*d,L.H*d,1),g=c.getContext('2d'),R=L.R,C=cover(R,pic),iw=img.naturalWidth,ih=img.naturalHeight;
 const sx=(R.x-C.x)/C.w*iw,sy=(R.y-C.y)/C.h*ih,sw=R.w/C.w*iw,sh=R.h/C.h*ih,dw=Math.round(R.w*d),dh=Math.round(R.h*d);
 let bmp=null;
 // From a Blob, Chrome decodes, crops and scales on a worker thread; from an <img> it would do it on the main thread.
 // The file is the one the <img> chose from its srcset and is already in the HTTP cache.
 // The hero waits for the page's load event first, so this request never competes with the first screen.
 if(L.fade&&document.readyState!=='complete')await new Promise(r=>addEventListener('load',r,{once:true}));
 try{if(window.createImageBitmap){const blob=await fetch(img.currentSrc||img.src).then(r=>r.ok?r.blob():Promise.reject());
  bmp=await createImageBitmap(blob,sx,sy,sw,sh,{resizeWidth:dw,resizeHeight:dh,resizeQuality:'high'});}}catch(e){bmp=null;}
 slice=performance.now();
 if(bmp&&bmp.width===dw){g.drawImage(bmp,Math.round(R.x*d),Math.round(R.y*d));bmp.close?.();}
 else{g.imageSmoothingQuality='high';g.drawImage(img,C.x*d,C.y*d,C.w*d,C.h*d);}
 if(L.fade){// fade to transparent where the copy stands: alpha mask on a coarse grid, smoothed up
  await breathe();
  const k=6,gw=Math.ceil(L.W/k),gh=Math.ceil(L.H/k),m=canvas(gw,gh),mg=m.getContext('2d'),id=mg.createImageData(gw,gh);
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++)id.data[(j*gw+i)*4+3]=255*L.fade(i*k+k/2,j*k+k/2);
  mg.putImageData(id,0,0);g.globalCompositeOperation='destination-in';g.drawImage(m,0,0,c.width,c.height);g.globalCompositeOperation='source-over';
 }
 return c;
}
// The size to fetch: the width the picture covers on its plate (cropping can make it wider than the plate).
function plateSizes(plate,pic){const W=plate.clientWidth||300,H=plate.clientHeight||200;return Math.round(Math.max(W,H*pic.ar))+'px';}
function loadPic(plate,pic,sizes){
 return new Promise((ok,fail)=>{
  const p=document.createElement('picture');p.hidden=true;
  const s=document.createElement('source');s.type='image/avif';s.srcset=srcset(pic,'avif');s.sizes=sizes;
  const img=document.createElement('img');img.alt='';img.decoding='async';img.sizes=sizes;img.srcset=srcset(pic,'webp');
  p.append(s,img);plate.appendChild(p);
  img.onload=()=>(img.decode?img.decode().catch(()=>{}):Promise.resolve()).then(()=>ok(img));img.onerror=()=>fail(Error('picture failed: '+pic.f));
 });
}

/* ---------- scenes ---------- */
let V=null;
const scenes=[];
function Scene(plate,kind){
 const pic=PICS[ART][kind],hero=kind==='hero';
 const st={plate,kind,pic,cv:null,img:null,impl:null,state:'idle',t0:0,played:false,visible:false,gen:0};
 debug.scenes[kind]=st;
 st.load=()=>st.loading||(st.loading=loadPic(plate,pic,hero?HERO_SIZES:plateSizes(plate,pic)).then(img=>(st.img=img)));
 // Build (async, in slices) on a fresh canvas; it replaces the old one only when ready, so a rebuild never flashes.
 st.build=async()=>{
  const gen=++st.gen;
  ev(kind+' layout');const L=hero?heroLayout(plate):plateLayout(plate);if(!L||!L.W||!L.H||!st.img)return false;ev(kind+' layout done');
  if(hero)plate.style.height=L.H+'px';
  const d=workDensity(L,pic,st.img,hero),t=performance.now(),marks={},mark=k=>{marks[k]=Math.round(performance.now()-t);ev(kind+':'+k);};
  await breathe();
  ev(kind+' build');slice=performance.now();const art=await placeArt(st.img,pic,L,d);mark('place');if(gen!==st.gen)return false;
  await breathe();
  const cv=document.createElement('canvas');cv.className='pp-cv';cv.width=Math.round(L.W*d);cv.height=Math.round(L.H*d);
  const impl=await V.make({kind,W:L.W,H:L.H,d,cv,art,L,reduce,A,mark,big:!hero&&L.W*L.H>380000});
  if(gen!==st.gen){impl.dispose?.();return false;}
  st.impl?.dispose?.();st.impl=impl;
  if(st.cv)st.cv.replaceWith(cv);else plate.appendChild(cv);st.cv=cv;
  ev(kind+' built');Object.assign(debug.scenes[kind],{W:L.W,H:L.H,d,buildMs:Math.round(performance.now()-t),marks,end:impl.end});
  return true;
 };
 st.play=()=>{if(!st.impl)return;ev(kind+' play');st.played=true;stopLife(st);if(reduce){st.finish();return;}st.state='paint';st.t0=0;st.impl.reset();loop.kick();};
 st.reset=()=>{st.played=false;st.state='idle';stopLife(st);st.impl?.reset();};
 st.finish=()=>{if(!st.impl)return;st.played=true;st.impl.finish();done(st);};
 return st;
}
// A scene has finished painting: the tram starts on the hero; a plate below drops its working layers for good.
function done(s){
 s.state='done';ev(s.kind+' done');debug.scenes[s.kind].done=true;stopLife(s);startLife(s);
 if(s.kind!=='hero')s.impl.release?.();
 s.plate.classList.add('is-painted');s.plate.dispatchEvent(new Event('painted'));
 if(s.kind==='hero')openGate();
}
// After painting, the only motion is the little tram: a sprite on its own layer, moved by a CSS animation.
function startLife(s){
 const T=s.impl.tram;if(reduce||!T||s.tramEl)return;
 const el=document.createElement('canvas');el.className='pp-tram';el.width=T.c.width;el.height=T.c.height;el.getContext('2d').drawImage(T.c,0,0);
 el.style.cssText=`width:${T.w}px;height:${T.h}px;top:${s.cv.offsetTop+s.cv.offsetHeight-4-T.h}px;--from:${-T.w}px;--to:${T.W+T.w}px;--run:${T.run}s;--period:${T.period}s`;
 s.plate.appendChild(el);s.tramEl=el;
}
function stopLife(s){s.tramEl?.remove();s.tramEl=null;}
// Owner, 17 Nov: "the site still loads long". Scenes are authored at 3.3–4.4 s; played 1.6× faster they finish in ~2–2.8 s.
const SPEED=1.6;
const loop={raf:0,kick(){if(!this.raf&&!document.hidden)this.raf=requestAnimationFrame(frame);}};
function frame(now){
 loop.raf=0;let busy=false;
 for(const s of scenes){
  if(!s.visible||!s.impl||s.state!=='paint')continue;
  if(!s.t0){s.t0=now;s.slow=0;}const t=(now-s.t0)/1000*SPEED,f0=performance.now();
  let fin=s.impl.frame(t);
  // Watchdog: a slow device (or a busy browser) gets the finished picture instead of a painting stuck half-way.
  const cost=performance.now()-f0;if(cost>70)s.slow++;
  const D=debug.scenes[s.kind];D.maxFrame=Math.max(D.maxFrame||0,Math.round(cost));D.frames=(D.frames||0)+1;
  if(!fin&&(s.slow>=3||t>s.impl.end+2.5)){s.impl.finish();fin=true;D.cut=true;}
  if(fin)done(s);else busy=true;
 }
 if(busy)loop.kick();
}
document.addEventListener('visibilitychange',()=>loop.kick());

/* The plates below the hero wait until the hero has painted (or the visitor has scrolled past it, or 5 s after load),
   so neither their pictures nor their preparation compete with the first screen. */
let gateOpen=false;const gated=[];
function openGate(){if(gateOpen)return;gateOpen=true;for(const f of gated.splice(0))f();}
const afterGate=f=>gateOpen?f():gated.push(f);
if(document.readyState==='complete')setTimeout(openGate,5000);else addEventListener('load',()=>setTimeout(openGate,5000),{once:true});

/* ---------- the programme line over "How it works" ----------
   The three stations are pinned to places in the painting (PICS.how.pins); the line runs between them like a transit
   map (straight, then 45°), and on wide screens a hairline drops from each station to its step card below. Drawn in an
   SVG over the plate; it never moves the layout. Shown once the painting is done (at once with reduced motion). */
const NS='http://www.w3.org/2000/svg';
function howLine(){
 const stage=document.querySelector('[data-how-stage]'),plate=stage?.querySelector('[data-paint=how]'),svg=stage?.querySelector('[data-how-line]'),pic=PICS[ART].how;
 if(!stage||!plate||!svg||!pic.pins)return;
 const cards=[...stage.querySelectorAll('.steps>li')];
 const el=(tag,a,parent)=>{const e=document.createElementNS(NS,tag);for(const k in a)e.setAttribute(k,a[k]);parent.appendChild(e);return e;};
 function draw(){
  const S=stage.getBoundingClientRect(),P=box(plate,stage);if(!P.w||!P.h)return;
  const C=cover({x:0,y:0,w:P.w,h:P.h},pic),pts=pic.pins.map(([u,v])=>[P.x+C.x+u*C.w,P.y+C.y+v*C.h]);
  svg.setAttribute('viewBox',`0 0 ${S.width} ${S.height}`);svg.textContent='';
  // transit-map path: horizontal, then a 45° run into the next station
  let d=`M${P.x} ${pts[0][1]}`;
  for(let i=0;i<pts.length;i++){const[x,y]=pts[i];if(i===0){d+=`H${x}`;continue;}const[px,py]=pts[i-1],dy=Math.abs(y-py),run=Math.max(0,x-px-dy);d+=`H${px+run}L${x} ${y}`;}
  d+=`H${P.x+P.w}`;
  el('path',{d,class:'hl-line',pathLength:1},svg);
  pts.forEach(([x,y],i)=>{
   const card=cards[i];
   if(card){const c=box(card,stage);if(c.y>y+20&&c.y<P.y+P.h){// the card overlaps the painting: a hairline down to it
    const lx=clamp(x,c.x+18,c.r-18);el('path',{d:`M${x} ${y+15}V${c.y-10}H${lx}V${c.y}`,class:'hl-lead',style:`--k:${i}`},svg);}}
   const g=el('g',{class:'hl-stop',style:`--k:${i};transform-origin:${x}px ${y}px`},svg);
   el('circle',{cx:x,cy:y,r:15},g);const t=el('text',{x,y:y+.5,'text-anchor':'middle','dominant-baseline':'central'},g);t.textContent=String(i+1);
  });
 }
 draw();
 const show=()=>stage.classList.add('is-lined');
 if(reduce)show();else{plate.addEventListener('painted',show,{once:true});plate.closest('.paint-plate.pp-off')&&show();}
 // whatever happens, the stations are there 6 s after the stage first comes into view
 new IntersectionObserver((es,o)=>{if(es.some(e=>e.isIntersecting)){o.disconnect();setTimeout(show,6000);}}).observe(stage);
 let w=stage.clientWidth;new ResizeObserver(()=>{if(stage.clientWidth!==w){w=stage.clientWidth;draw();}}).observe(stage);
 debug.how={pins:true};
}

function bootVariant(){
 return new Promise((ok,fail)=>{
  if(window.EvPaintVariant)return ok(window.EvPaintVariant);
  const s=document.createElement('script');s.src=`assets/paint-${ART}.js`;s.async=true;s.onload=()=>window.EvPaintVariant?ok(window.EvPaintVariant):fail(Error('variant missing'));s.onerror=fail;document.head.appendChild(s);
 });
}
function setup(){
 for(const plate of plates){
  const kind=plate.dataset.paint;if(!PICS[ART][kind])continue;
  const st=Scene(plate,kind);scenes.push(st);
  const fail=e=>{debug.errors.push(String(e&&e.message||e));plate.classList.add('pp-off');plate.dispatchEvent(new Event('painted'));if(kind==='hero')openGate();};
  if(kind==='hero'){
   // The hero is painted at once: its picture was preloaded, and the paper is already there from the first paint.
   st.visible=true;
   st.load().then(st.build).then(ok=>{if(ok)st.play();else openGate();}).catch(fail);
   new IntersectionObserver(es=>{const e=es[es.length-1];st.visible=e.isIntersecting;if(!e.isIntersecting)openGate();
    if(!e.isIntersecting&&st.played&&st.state!=='paint')st.reset();else if(e.isIntersecting&&st.impl&&!st.played)st.play();loop.kick();}).observe(plate);
   continue;
  }
  // Other plates: fetched and prepared as the section approaches; painted once when a third of it is visible.
  afterGate(()=>{
   new IntersectionObserver((es,o)=>{if(es.some(e=>e.isIntersecting)){o.disconnect();st.load().then(st.build).then(ok=>{if(ok&&st.visible&&!st.played)st.play();}).catch(fail);}},{rootMargin:'500px 0px'}).observe(plate);
   new IntersectionObserver(es=>{for(const e of es){st.visible=e.isIntersecting;
    if(e.intersectionRatio>=.33&&!st.played&&st.impl)st.play();
    else if(!e.isIntersecting&&st.state==='paint')st.finish();}// scrolled away mid-paint: it is simply finished
    loop.kick();},{threshold:[0,.33]}).observe(plate);
  });
 }
 // Rebuild on resize (300 ms debounce); a picture already painted comes back finished, without the paint-in.
 let rt,lastW=innerWidth;
 const rebuild=async()=>{for(const st of scenes){if(!st.img)continue;const was=st.played;if(!(await st.build()))continue;if(was)st.finish();else st.reset();}};
 new ResizeObserver(()=>{if(innerWidth===lastW)return;lastW=innerWidth;clearTimeout(rt);rt=setTimeout(rebuild,300);}).observe(document.body);
}
// The hero is measured once the web fonts have settled the copy (or after 700 ms, whichever comes first).
const fontsReady=Promise.race([document.fonts?document.fonts.ready:Promise.resolve(),new Promise(ok=>setTimeout(ok,700))]);
fontsReady.then(()=>{try{howLine();}catch(e){debug.errors.push('how line: '+e.message);}});
Promise.all([bootVariant(),fontsReady]).then(([v])=>{V=v;setup();}).catch(e=>{debug.errors.push(String(e&&e.message||e));root.classList.add('paint-off');openGate();});
})();
