'use strict';
/* Watercolour (?art=watercolour, the default): Albrecht Dürer's landscape watercolours, painted in the way a watercolour
   is made, fast and wet:
   1. pencil underdrawing: the picture's own contours (traced from its edges) drawn line by line in graphite;
   2. first wash: a pale, blurred version of the colour drops onto the paper at many points at once and spreads in
      ragged blooms, bleeding past the contours;
   3. second, darker wash: new drops, the blooms leave a darker pigment rim at their wet front (edge darkening), still
      a little bled;
   4. drying: small fast blooms at the darks and edges settle the colour to its crisp final state.
   Everything is multiplied over the paper, so the grain and the pencil show through every wash. The painting's own
   paper is mapped to white first, so an old sheet sits on our paper without a seam. Afterwards only a small blue tram
   rides the programme line on the hero (a compositor sprite, see landing-paint.js); the picture itself stays still.
   Preparation is async: every per-pixel or per-cell loop yields to the browser through A.pace() / A.breathe().
   Each wash is an arrival-time field: for every cell, the moment the water from the nearest drop reaches it (distance
   over speed, warped by noise, plus fine noise for cauliflower fronts). A frame only compares that field with the clock. */
window.EvPaintVariant=(()=>{
const PAPER='#f6f3eb',PAPER_RGB=[246,243,235];

async function paperCanvas(Wd,Hd,A){
 const c=A.canvas(Wd,Hd),g=c.getContext('2d');g.fillStyle=PAPER;g.fillRect(0,0,Wd,Hd);
 const T=192,t=A.canvas(T,T),tg=t.getContext('2d'),id=tg.createImageData(T,T),n=A.makeNoise(17),r=A.rng(5);
 for(let y=0;y<T;y++,await A.pace())for(let x=0;x<T;x++){
  // cold-pressed paper: soft tooth plus fine speckle
  const tooth=n.fbm(x/9,y/9,3),i=(y*T+x)*4,k=255-(tooth*20+r()*9);
  id.data[i]=k;id.data[i+1]=k;id.data[i+2]=k-2;id.data[i+3]=255;}
 tg.putImageData(id,0,0);g.globalCompositeOperation='multiply';g.globalAlpha=.55;g.fillStyle=g.createPattern(t,'repeat');g.fillRect(0,0,Wd,Hd);
 g.globalAlpha=1;g.globalCompositeOperation='source-over';return c;
}
// The painting as pigment: its paper becomes white, so multiplying it lays only the colour on our paper.
async function pigment(S,deckle){
 const{art,A}=S,w=art.width,h=art.height;
 // paper white point per channel, from a small copy (the 94th percentile: an old sheet's tone becomes white)
 const sw=Math.min(w,240),sh=Math.max(1,Math.round(h*sw/w)),sm=A.canvas(sw,sh,1),smg=sm.getContext('2d');smg.drawImage(art,0,0,sw,sh);
 const SD=smg.getImageData(0,0,sw,sh).data,hist=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)];let cnt=0;
 for(let i=0;i<SD.length;i+=4)if(SD[i+3]>200){hist[0][SD[i]]++;hist[1][SD[i+1]]++;hist[2][SD[i+2]]++;cnt++;}
 const pct=hs=>{let s=0;for(let v=255;v>=0;v--){s+=hs[v];if(s>=cnt*.06)return Math.max(v,120);}return 255;};
 const P=cnt?hist.map(pct):[255,255,255];
 const k=4*S.d,gw=Math.ceil(w/k),gh=Math.ceil(h/k);
 await A.eachPixel(art,(D,i,x,y)=>{
  let e=1;if(deckle){const fx=Math.min(x/k,gw-1.001),fy=Math.min(y/k,gh-1.001),ix=fx|0,iy=fy|0,u=fx-ix,v=fy-iy,q=iy*gw+ix;
   e=(deckle[q]*(1-u)+deckle[q+1]*u)*(1-v)+(deckle[q+gw]*(1-u)+deckle[q+gw+1]*u)*v;}
  const a=D[i+3]/255*e;
  D[i]=255-(1-Math.min(1,D[i]/P[0]))*a*255;D[i+1]=255-(1-Math.min(1,D[i+1]/P[1]))*a*255;D[i+2]=255-(1-Math.min(1,D[i+2]/P[2]))*a*255;D[i+3]=255;});
 return art;// the placed picture is not needed any more: it becomes the pigment
}
// Plates have no copy to avoid; they get a ragged, deckled vignette instead: the wash stops short of the frame.
async function deckleGrid(S){
 const{W,H,A}=S,k=4,gw=Math.ceil(W/k),gh=Math.ceil(H/k),n=A.makeNoise(29),m=Math.min(W,H)*.16,out=new Float32Array(gw*gh);
 for(let j=0;j<gh;j++,await A.pace())for(let i=0;i<gw;i++){const x=i*k,y=j*k,e=Math.min(x,y,W-x,H-y)+(n.fbm(x/38,y/38,3)-.5)*m*1.1;out[j*gw+i]=A.smooth(2,m,e);}
 return out;
}
// A lighter (share of pigment) copy of the pigment layer, optionally blurred by k.
function diluted(pig,share,k,A){
 const c=A.canvas(pig.width,pig.height),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
 g.globalAlpha=share;g.drawImage(pig,0,0);g.globalAlpha=1;return k>1?A.soften(c,k):c;
}

/* Arrival-time field of one wash: drops placed where the picture has pigment, their water spreading at a speed that
   fills the area within the pass. Warp makes blooms irregular; fine noise makes cauliflower (backrun) fronts. */
async function washField(S,G,{t0,t1,drops,seed,where='dark',warp=.5,cauli=.12,speedJit=.5}){
 const{A}=S,{gw,gh,cell,L,E}=G,r=A.rng(seed),n=A.makeNoise(seed),D=[];
 const wt=i=>{const l=L[i];return where==='edge'?Math.pow(E[i],2)*(1.2-l)+.002:Math.pow(1-l,1.6)+.015;};
 let tot=0;const cdf=new Float32Array(gw*gh);for(let i=0;i<gw*gh;i++){tot+=wt(i);cdf[i]=tot;}await A.pace();
 for(let k=0;k<drops;k++){const u=r()*tot;let lo=0,hi=cdf.length-1;while(lo<hi){const m=(lo+hi)>>1;cdf[m]<u?lo=m+1:hi=m;}
  D.push({x:(lo%gw+.5)*cell,y:((lo/gw|0)+.5)*cell,t:Math.pow(r(),1.4),v:1+(r()-.5)*speedJit});}
 const F=new Float32Array(gw*gh);let lo=1e9,hi=-1e9;
 for(let j=0;j<gh;j++,await A.pace())for(let i=0;i<gw;i++){const x=(i+.5)*cell,y=(j+.5)*cell,w=1+warp*(n.fbm(x/110,y/110,3)-.5)*2;let best=1e9;
  for(const p of D){const v=p.t*90+Math.hypot(x-p.x,y-p.y)*w/p.v;if(v<best)best=v;}
  F[j*gw+i]=best;}
 for(let q=0;q<F.length;q++){if(F[q]<lo)lo=F[q];if(F[q]>hi)hi=F[q];}
 const span=t1-t0; // fine-scale noise on the time itself gives a ragged, cauliflowered front
 for(let j=0;j<gh;j++,await A.pace())for(let i=0;i<gw;i++){const q=j*gw+i,x=(i+.5)*cell,y=(j+.5)*cell;
  F[q]=t0+(F[q]-lo)/(hi-lo||1)*span*(1-cauli)+(n.fbm(x/9+50,y/9,3))*span*cauli;}
 let mx=0;for(const v of F)if(v>mx)mx=v;
 return{F,max:mx,min:t0};
}

async function make(S){
 const{W,H,d,cv,A,kind,L:lay,big}=S,hero=kind==='hero',Wd=cv.width,Hd=cv.height,g=cv.getContext('2d');
 const deckle=hero?null:await deckleGrid(S);
 const pig=await pigment(S,deckle);S.mark('pigment');await A.breathe();
 const paper=await paperCanvas(Wd,Hd,A);S.mark('paper');await A.breathe();
 // coarse analysis grid
 const cell=Math.max(1.5,Math.min(4,Math.sqrt(W*H/40000))),gw=Math.ceil(W/cell),gh=Math.ceil(H/cell);
 S.mark('grid0');const LG=A.lumGrid(pig,gw,gh),SB=await A.sobel(LG.L,gw,gh),E=new Float32Array(gw*gh);let em=0;for(const v of SB.m)if(v>em)em=v;for(let i=0;i<E.length;i++)E[i]=SB.m[i]/(em||1);
 const G={gw,gh,cell,L:LG.L,E};
 // timeline (seconds); plates below the hero go a little faster; large ones get as many drops as the hero
 const k=hero?1:.88,many=hero||big;
 S.mark('grid');const f1=await washField(S,G,{t0:.25*k,t1:1.55*k,drops:many?26:16,seed:11,warp:.6,cauli:.14});
 const f2=await washField(S,G,{t0:1.05*k,t1:2.45*k,drops:many?34:20,seed:23,warp:.5,cauli:.12});
 const f3=await washField(S,G,{t0:2.0*k,t1:3.05*k,drops:many?70:44,seed:37,where:'edge',warp:.35,cauli:.1,speedJit:.8});
 S.mark('fields');await A.breathe();
 // the pigment on a plain canvas for drawing every frame; the read-back copy above stays for the analysis
 const pigD=A.canvas(pig.width,pig.height);pigD.getContext('2d').drawImage(pig,0,0);
 S.mark('fields2');const pass=[{layer:diluted(pigD,.42,10,A),...f1},{layer:diluted(pigD,.82,3,A),rim:1,...f2},{layer:pigD,...f3}];
 S.mark('layers');const WET=.22;await A.breathe();
 // pencil: the picture's contours as graphite lines, long ones first
 const fadeAt=lay.fade||(()=>1);
 const chains=await A.traceEdges(pig,W,H,{cell:hero?2:big?2.2:1.6,keep:.1,max:many?1100:650,min:hero||big?7:5});
 pig.width=pig.height=0;S.mark('edges');const r=A.rng(3),PEN_END=1.35*k;
 chains.forEach((c,i)=>{const f=i/chains.length;c.start=Math.pow(f,.85)*PEN_END*.72;c.dur=Math.min(.55,.12+c.len/900);c.done=0;
  const mid=c.pts[c.pts.length>>1];c.alpha=Math.min(.6,.22+.16*c.strength)*(lay.fade?fadeAt(mid[0],mid[1]):1);
  c.pts=c.pts.map(([x,y])=>[x+(r()-.5)*.6,y+(r()-.5)*.6]);c.w=.5+r()*.35;});
 const pencil=A.canvas(Wd,Hd),pg=pencil.getContext('2d');
 const wash=A.canvas(Wd,Hd),wg=wash.getContext('2d'),tmp=A.canvas(Wd,Hd),tg=tmp.getContext('2d');
 const mc=A.canvas(gw,gh),mg=mc.getContext('2d'),mid=mg.createImageData(gw,gh);
 const end=Math.max(PEN_END,...pass.map(p=>p.max+WET))+.05;

 function clearPencil(){pg.setTransform(1,0,0,1,0,0);pg.fillStyle='#fff';pg.fillRect(0,0,Wd,Hd);chains.forEach(c=>c.done=0);}
 function drawPencil(t){
  pg.setTransform(d,0,0,d,0,0);pg.lineCap='round';pg.lineJoin='round';
  for(const c of chains){if(t<c.start||c.done>=c.pts.length-1)continue;const p=Math.min(1,(t-c.start)/c.dur),to=Math.max(1,Math.round(p*(c.pts.length-1)));if(to<=c.done)continue;
   pg.beginPath();pg.moveTo(...c.pts[c.done]);for(let i=c.done+1;i<=to;i++)pg.lineTo(...c.pts[i]);
   pg.strokeStyle=`rgba(64,66,80,${c.alpha})`;pg.lineWidth=c.w;pg.stroke();c.done=to;}
 }
 function mask(F,t,rim){
  const D=mid.data;
  if(rim){for(let i=0,q=3;i<F.length;i++,q+=4){const a=t-F[i];D[q]=a<=0?0:255*Math.exp(-((a-.1)*(a-.1))/.006);}}
  else for(let i=0,q=3;i<F.length;i++,q+=4){const a=(t-F[i])/WET;D[q]=a<=0?0:a>=1?255:255*a*a*(3-2*a);}
  mg.putImageData(mid,0,0);return mc;
 }
 function through(layer,m,op,alpha=1){
  tg.globalCompositeOperation='copy';tg.drawImage(layer,0,0,Wd,Hd);tg.globalCompositeOperation='destination-in';tg.drawImage(m,0,0,Wd,Hd);
  wg.globalCompositeOperation=op;wg.globalAlpha=alpha;wg.drawImage(tmp,0,0);wg.globalAlpha=1;wg.globalCompositeOperation='source-over';
 }
 function compose(t){
  wg.globalCompositeOperation='source-over';wg.fillStyle='#fff';wg.fillRect(0,0,Wd,Hd);
  for(const p of pass){if(t<p.min)continue;
   if(t>=p.max+WET){wg.drawImage(p.layer,0,0,Wd,Hd);continue;}
   through(p.layer,mask(p.F,t),'source-over');
   if(p.rim&&t<p.max+.3)through(pigD,mask(p.F,t,1),'multiply',.55);
  }
  g.globalCompositeOperation='copy';g.drawImage(paper,0,0);
  g.globalCompositeOperation='multiply';g.drawImage(pencil,0,0);g.drawImage(wash,0,0);
  g.globalCompositeOperation='source-over';
 }
 const tram=hero?tramSprite(d,A):null;let released=false;
 const self={end,
  reset(){clearPencil();g.globalCompositeOperation='copy';g.drawImage(paper,0,0);g.globalCompositeOperation='source-over';},
  frame(t){drawPencil(t);compose(t);return t>=end;},
  finish(){if(released)return;clearPencil();drawPencil(1e3);compose(1e3);},
  // Life is a small sprite moved by the compositor (see landing-paint.js): no full-canvas redraw per frame.
  tram:tram&&{c:tram.c,w:tram.w,h:tram.h,period:W/46+5,run:W/46,W,H},
  // A plate that has painted once keeps only its finished canvas: the working layers go.
  release(){released=true;pass.length=0;chains.length=0;for(const c of[pencil,wash,tmp,paper,pigD])c.width=c.height=0;},
  dispose(){self.release();}
 };
 self.reset();
 return self;
}
// A small blue tram in watercolour: a wash body with a darker rim, paper left for the windows, pencil wheels.
function tramSprite(d,A){
 const w=60,h=24,c=A.canvas(w*d,h*d),g=c.getContext('2d');g.scale(d,d);
 g.fillStyle='rgba(31,63,196,.55)';g.beginPath();g.moveTo(3,6);g.lineTo(w-3,6);g.lineTo(w-1,19);g.lineTo(1,19);g.closePath();g.fill();
 g.strokeStyle='rgba(11,26,85,.6)';g.lineWidth=.8;g.stroke();
 g.fillStyle='rgba(31,63,196,.5)';g.fillRect(3,15,w-6,4);
 g.fillStyle='rgba(246,243,235,.85)';for(let i=0;i<5;i++)g.fillRect(6+i*10.4,8.5,7,5);
 g.strokeStyle='rgba(64,66,80,.7)';g.lineWidth=.7;g.beginPath();g.moveTo(w*.42,6);g.lineTo(w*.5,1);g.lineTo(w*.6,1);g.stroke();
 g.fillStyle='rgba(11,26,85,.75)';for(const x of[10,18,w-18,w-10]){g.beginPath();g.arc(x,20,2,0,7);g.fill();}
 return{c,w,h};
}
return{name:'watercolour',paper:PAPER,ghost:.18,make};
})();
