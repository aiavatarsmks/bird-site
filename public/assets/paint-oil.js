'use strict';
/* Renaissance oil (?art=oil): Patinir, Bruegel, Altdorfer and Bellini landscapes, painted in the order a 15th–16th
   century panel was built up, one layer and one brush stroke at a time:
   1. warm imprimatura: the panel ground, with the streaks of its brushing;
   2. sanguine underdrawing: the picture's contours (traced from its edges) and left-handed hatching in the shadows,
      sweeping across the panel;
   3. dead colour: an umber monochrome of the picture laid in broad strokes, back to front (sky and distance first);
   4. glazes: the colour, first as a translucent glaze that only tints the dead colour (hue over umber values), then
      two thinner, smaller passes that bring the full colour; every stroke follows the form (stroke angle along the
      image's isophotes, from its structure tensor), so skies are laid flat and hills along their slopes;
   5. the paint settles, then lights: small impasto touches of lead white, each with its tiny shadow, laid from the
      left, where the light comes from.
   Each stroke is a bundle of bristle marks filled with the layer it reveals, so the picture is literally uncovered
   stroke by stroke. Afterwards the panel stays still; on the hero a small tram rides the line (compositor sprite).
   Preparation is async: every per-pixel or per-cell loop yields to the browser through A.pace() / A.breathe().
   Large plates get proportionally fewer, larger strokes, so a frame never draws more than a few hundred. */
window.EvPaintVariant=(()=>{
const GROUND='#eee0c2';

async function groundCanvas(Wd,Hd,d,A){
 const c=A.canvas(Wd,Hd),g=c.getContext('2d'),r=A.rng(41);g.fillStyle=GROUND;g.fillRect(0,0,Wd,Hd);
 // the imprimatura brushed on in long horizontal sweeps
 g.lineCap='round';for(let i=0;i<Hd/(7*d);i++){const y=(i*7+r()*5)*d;g.strokeStyle=`rgba(${168+r()*20|0},${112+r()*20|0},${60+r()*14|0},${.015+r()*.025})`;g.lineWidth=(5+r()*9)*d;
  g.beginPath();g.moveTo(-20,y);g.bezierCurveTo(Wd*.3,y+(r()-.5)*8*d,Wd*.7,y+(r()-.5)*8*d,Wd+20,y+(r()-.5)*6*d);g.stroke();if(i%16===15)await A.pace();}
 // gesso weave
 const T=120,t=A.canvas(T,T),tg=t.getContext('2d'),id=tg.createImageData(T,T);
 for(let y=0;y<T;y++)for(let x=0;x<T;x++){const i=(y*T+x)*4,v=255-(x%3===0?7:0)-(y%3===0?6:0)-r()*10;id.data[i]=v;id.data[i+1]=v-2;id.data[i+2]=v-6;id.data[i+3]=255;}
 tg.putImageData(id,0,0);g.globalCompositeOperation='multiply';g.globalAlpha=.32;g.fillStyle=g.createPattern(t,'repeat');g.fillRect(0,0,Wd,Hd);g.globalAlpha=1;g.globalCompositeOperation='source-over';
 return c;
}
// Per-pixel layer builder over the placed picture (keeps its alpha, i.e. the fade around the hero copy), in slices.
async function mapPixels(src,A,fn){
 const c=A.canvas(src.width,src.height,1);
 return A.eachPixel(src,(D,i)=>{const a=D[i+3];if(!a)return;D[i+3]=0;fn(D[i],D[i+1],D[i+2],D,i);D[i+3]=D[i+3]*a/255;},c);
}
const lum=(r,g,b)=>(.2126*r+.7152*g+.0722*b)/255;
const mix=(a,b,t)=>a+(b-a)*t;
// fn overwrites RGB and an opacity O[i+3] (0..255; 0 = not kept), which is then multiplied by the picture's own alpha.
// Dead colour: the values of the picture in a warm umber monochrome.
const deadLayer=(src,A)=>mapPixels(src,A,(r,g,b,O,i)=>{const l=Math.pow(lum(r,g,b),.92);O[i]=mix(58,228,l);O[i+1]=mix(40,206,l);O[i+2]=mix(24,168,l);O[i+3]=255;});
// Final colour, under a warm varnish.
const colourLayer=(src,A)=>mapPixels(src,A,(r,g,b,O,i)=>{O[i]=r*.97+3;O[i+1]=g*.94+2;O[i+2]=b*.86;O[i+3]=255;});
// Lights: only the bright passages, lifted towards lead white, fading in above the threshold; transparent elsewhere.
const lightLayer=(colour,A)=>mapPixels(colour,A,(r,g,b,O,i)=>{const l=lum(r,g,b),s=A.smooth(.56,.92,l);if(l<.56)return;
 O[i]=mix(r,255,s*.55);O[i+1]=mix(g,247,s*.55);O[i+2]=mix(b,228,s*.5);O[i+3]=255*A.smooth(.56,.68,l);});

// Stroke directions along the form: structure tensor of the picture's luminance on a coarse grid.
async function flowField(src,S){
 const{A,W,H}=S,cell=Math.max(4,Math.min(9,Math.sqrt(W*H)/120)),gw=Math.ceil(W/cell),gh=Math.ceil(H/cell),G=A.lumGrid(src,gw,gh),{gx,gy,m}=await A.sobel(G.L,gw,gh);
 const ang=new Float32Array(gw*gh),coh=new Float32Array(gw*gh),E=new Float32Array(gw*gh);let mx=0;for(const v of m)if(v>mx)mx=v;
 for(let j=0;j<gh;j++){for(let i=0;i<gw;i++){let xx=0,yy=0,xy=0;
  for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const q=(j+y)*gw+i+x;if(j+y<0||j+y>=gh||i+x<0||i+x>=gw)continue;xx+=gx[q]*gx[q];yy+=gy[q]*gy[q];xy+=gx[q]*gy[q];}
  const q=j*gw+i,tr=xx+yy,det=Math.sqrt((xx-yy)*(xx-yy)+4*xy*xy);
  ang[q]=.5*Math.atan2(2*xy,xx-yy)+Math.PI/2;coh[q]=tr>1e-5?det/tr:0;E[q]=m[q]/(mx||1);}await A.pace();}
 return(x,y)=>{const i=Math.min(gw-1,Math.max(0,x/cell|0)),j=Math.min(gh-1,Math.max(0,y/cell|0)),q=j*gw+i;return{a:ang[q],c:coh[q],e:E[q],l:G.L[q],al:G.A[q]};};
}
/* A pass of strokes: a jittered grid over the picture, each stroke oriented along the form (flat where the form is
   weak), kept only where the pass applies, then put in the order the painter would lay them. */
async function planStrokes(S,flow,{w,len,gap,t0,t1,keep=()=>true,order='back',alpha=1,seed}){
 const{W,H,A}=S,r=A.rng(seed),out=[];
 for(let y=gap/2;y<H;y+=gap){for(let x=gap/2;x<W;x+=gap){const px=x+(r()-.5)*gap,py=y+(r()-.5)*gap,f=flow(px,py);if(f.al<.04||!keep(f,r))continue;
  const flat=1-A.smooth(.18,.5,f.c*Math.min(1,f.e*4)),a=flat>.5?(r()-.5)*.25:f.a+(r()-.5)*.3;
  out.push({x:px,y:py,a,len:len*(.7+r()*.6),w:w*(.75+r()*.5),al:alpha*f.al,k:order==='light'?px+py*.25+r()*gap*3:py+(r()-.5)*H*.18,bend:(r()-.5)*.3,r:r()});}await A.pace();}
 out.sort((p,q)=>p.k-q.k);
 out.forEach((s,i)=>s.t=t0+(t1-t0)*i/Math.max(1,out.length-1));
 return out;
}
// One brush stroke: a bundle of bristle marks along a slightly curved path, filled with the layer it uncovers.
function stroke(g,s,d,style,op,impasto){
 const ca=Math.cos(s.a),sa=Math.sin(s.a),px=-sa,py=ca,nb=Math.max(3,Math.min(9,Math.round(s.w/2.2))),L=s.len;
 let seed=s.r*1e4|0;const rr=()=>{seed=(seed*16807)%2147483647;return(seed&1023)/1024;};
 g.globalCompositeOperation=op;g.lineCap='round';
 for(let j=0;j<nb;j++){
  const off=((j+.5)/nb-.5)*s.w+(rr()-.5)*s.w/nb,b0=rr()*L*.14,b1=L*(.8+rr()*.2),bend=s.bend*L*(1-Math.abs(off)/s.w);
  const x0=s.x+(-L/2+b0)*ca+off*px,y0=s.y+(-L/2+b0)*sa+off*py,x1=s.x+(-L/2+b1)*ca+off*px,y1=s.y+(-L/2+b1)*sa+off*py,cx=(x0+x1)/2+px*bend,cy=(y0+y1)/2+py*bend;
  const lw=Math.max(.7,s.w/nb*1.9);
  if(impasto){g.globalCompositeOperation='multiply';g.globalAlpha=.16*s.al;g.strokeStyle='#5a3e22';g.lineWidth=lw*d;g.beginPath();g.moveTo((x0+.9)*d,(y0+1)*d);g.quadraticCurveTo((cx+.9)*d,(cy+1)*d,(x1+.9)*d,(y1+1)*d);g.stroke();g.globalCompositeOperation=op;}
  g.globalAlpha=s.al*(.55+.45*rr());g.strokeStyle=style;g.lineWidth=lw*d;
  g.beginPath();g.moveTo(x0*d,y0*d);g.quadraticCurveTo(cx*d,cy*d,x1*d,y1*d);g.stroke();
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}

async function make(S){
 const{W,H,d,cv,A,kind,art,L:lay,big}=S,hero=kind==='hero',Wd=cv.width,Hd=cv.height,g=cv.getContext('2d');
 const ground=await groundCanvas(Wd,Hd,d,A);S.mark('ground');await A.breathe();
 const colour=await colourLayer(art,A);S.mark('colour');await A.breathe();
 const dead=await deadLayer(art,A);S.mark('dead');await A.breathe();
 const lights=await lightLayer(colour,A);S.mark('layers');await A.breathe();
 const P={dead:g.createPattern(dead,'no-repeat'),colour:g.createPattern(colour,'no-repeat'),lights:g.createPattern(lights,'no-repeat')};S.mark('patterns');await A.breathe();
 const flow=await flowField(colour,S);S.mark('flow');await A.breathe();
 // Stroke size grows with the plate; on large plates it grows faster, so the stroke count stays about the same.
 const k=hero?1:.88,area=Math.sqrt(W*H),u=Math.max(5,Math.min(big?30:24,area/(big?34:40)));
 const T={under:[.15*k,1.25*k],dead:[1.1*k,2.15*k],g1:[2.0*k,2.65*k],g2:[2.5*k,3.2*k],g3:[3.05*k,3.6*k],settle:[3.55*k,3.85*k],lights:[3.8*k,4.35*k]};
 // underdrawing: contours in sanguine, then left-handed hatching where the shadows are
 const fadeAt=lay.fade||(()=>1),r=A.rng(9);
 const chains=await A.traceEdges(colour,W,H,{cell:hero?2.2:big?2.4:1.7,keep:.08,max:hero||big?700:480,min:hero||big?8:5});S.mark('edges');
 chains.forEach(c=>{c.k=c.pts[0][0]*.7+c.pts[0][1]*.3+r()*80;c.pts=c.pts.map(([x,y])=>[x+(r()-.5)*.8,y+(r()-.5)*.8]);
  const m=c.pts[c.pts.length>>1];c.alpha=Math.min(.7,.3+.14*c.strength)*(lay.fade?fadeAt(m[0],m[1]):1);c.w=.6+r()*.5;});
 const hat=[],hg=Math.max(4,u*.32);
 for(let y=hg/2;y<H;y+=hg){for(let x=hg/2;x<W;x+=hg){const f=flow(x,y);if(f.al<.2||f.l>.42||r()<.25)continue;const L=hg*(1.3+r()*.8),a=.85+(r()-.5)*.2;
  hat.push({pts:[[x-Math.cos(a)*L/2,y-Math.sin(a)*L/2],[x+Math.cos(a)*L/2,y+Math.sin(a)*L/2]],k:x*.7+y*.3+r()*40,alpha:.3*f.al*(1-f.l),w:.5});}await A.pace();}
 const lines=chains.concat(hat).sort((a,b)=>a.k-b.k);
 S.mark('hatch');lines.forEach((c,i)=>{c.start=T.under[0]+(T.under[1]-T.under[0])*.8*i/Math.max(1,lines.length-1);c.dur=c.pts.length>2?Math.min(.4,.1+c.pts.length/400):.08;c.done=0;});
 await A.breathe();
 const passes=[
  {name:'dead',style:P.dead,op:'source-over',list:await planStrokes(S,flow,{w:Math.min(30,u*1.05),len:Math.min(80,u*2.7),gap:Math.min(30,u*1.05)*.8,t0:T.dead[0],t1:T.dead[1],alpha:.92,seed:3})},
  {name:'g1',style:P.colour,op:'color',list:await planStrokes(S,flow,{w:u*.8,len:u*2.1,gap:u*.8,t0:T.g1[0],t1:T.g1[1],alpha:.8,seed:5})},
  {name:'g2',style:P.colour,op:'source-over',list:await planStrokes(S,flow,{w:u*.5,len:u*1.4,gap:u*.62,t0:T.g2[0],t1:T.g2[1],alpha:.6,seed:7})},
  {name:'g3',style:P.colour,op:'source-over',list:await planStrokes(S,flow,{w:Math.max(2.4,u*.3),len:Math.max(6,u*.9),gap:Math.max(2.2,u*.34),t0:T.g3[0],t1:T.g3[1],alpha:.9,seed:9,keep:(f,r)=>f.e>.16||r()<.12})},
  {name:'lights',style:P.lights,op:'source-over',impasto:1,list:await planStrokes(S,flow,{w:Math.max(1.8,u*.2),len:Math.max(4,u*.6),gap:Math.max(2.4,u*.36),t0:T.lights[0],t1:T.lights[1],order:'light',alpha:.95,seed:11,keep:(f,r)=>f.l>.62&&(f.e>.14||r()<.06)})}
 ];
 S.mark('strokes');
 const end=T.lights[1]+.05;
 let last=-1,settled=0,released=false;
 // A frame lays the strokes due by t, but stops after ~12 ms: on a slow device the painting runs late instead of
 // blocking the page (the watchdog in landing-paint.js finishes it if it falls too far behind).
 const FRAME_MS=12;
 function paintUntil(t,budget=true){
  if(t<=last)return;
  const f0=performance.now();let n=0;
  g.setTransform(1,0,0,1,0,0);g.lineJoin='round';
  for(const c of lines){if(t<c.start||c.done>=c.pts.length-1)continue;const p=Math.min(1,(t-c.start)/c.dur),to=Math.max(1,Math.round(p*(c.pts.length-1)));if(to<=c.done)continue;
   g.beginPath();g.moveTo(c.pts[c.done][0]*d,c.pts[c.done][1]*d);for(let i=c.done+1;i<=to;i++)g.lineTo(c.pts[i][0]*d,c.pts[i][1]*d);
   g.strokeStyle=`rgba(160,64,40,${c.alpha})`;g.lineWidth=c.w*d;g.lineCap='round';g.stroke();c.done=to;}
  for(const p of passes){
   if(p.name==='lights'&&t>=T.settle[0]){// the paint settles before the lights go on: close the gaps between strokes
    const f=A.clamp((t-T.settle[0])/(T.settle[1]-T.settle[0]));if(f>settled){g.globalAlpha=(f-settled)/(1-settled||1);g.drawImage(colour,0,0);g.globalAlpha=1;settled=f;}}
   for(;p.i<p.list.length&&p.list[p.i].t<=t;p.i++){stroke(g,p.list[p.i],d,p.style,p.op,p.impasto);
    if(budget&&++n%8===0&&performance.now()-f0>FRAME_MS){p.i++;return;}}
   if(p.i<p.list.length)break;// later passes wait until this one has caught up
  }
  last=t;
 }
 const tram=hero?tramSprite(d,A):null;
 const self={end,
  reset(){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='copy';g.drawImage(ground,0,0);g.globalCompositeOperation='source-over';last=-1;settled=0;lines.forEach(c=>c.done=0);passes.forEach(p=>p.i=0);},
  frame(t){paintUntil(t);return t>=end&&passes.every(p=>p.i>=p.list.length);},
  // The finished panel without replaying a single stroke (it must be cheap: the watchdog and reduced motion use it):
  // once the paint has settled the colour covers what lay under it, so the end state is the ground, the settled colour
  // and the lights laid over it as one layer.
  finish(){if(released)return;self.reset();g.drawImage(colour,0,0);last=T.settle[1];settled=1;g.globalAlpha=.6;g.drawImage(lights,0,0);g.globalAlpha=1;passes.forEach(p=>p.i=p.list.length);last=1e3;},
  // Life is a small sprite moved by the compositor (see landing-paint.js): no full-canvas redraw per frame.
  tram:tram&&{c:tram.c,w:tram.w,h:tram.h,period:W/40+6,run:W/40,W,H},
  // A plate that has painted once keeps only its finished canvas: the working layers go.
  release(){released=true;passes.length=0;lines.length=0;for(const c of[ground,dead,colour,lights])c.width=c.height=0;},
  dispose(){self.release();}
 };
 self.counts=passes.map(p=>p.list.length);
 self.reset();
 return self;
}
// A small tram painted in oil: tram blue body modelled light to dark, a lit roof edge, umber wheels.
function tramSprite(d,A){
 const w=60,h=24,c=A.canvas(w*d,h*d),g=c.getContext('2d');g.scale(d,d);
 const gr=g.createLinearGradient(0,6,0,19);gr.addColorStop(0,'#3d5ad0');gr.addColorStop(1,'#14257a');
 g.fillStyle=gr;g.beginPath();g.moveTo(3,6);g.lineTo(w-3,6);g.lineTo(w-1,19);g.lineTo(1,19);g.closePath();g.fill();
 g.fillStyle='#f1dfb4';for(let i=0;i<5;i++)g.fillRect(6+i*10.4,8.5,7,5);
 g.strokeStyle='rgba(255,240,205,.8)';g.lineWidth=1;g.beginPath();g.moveTo(4,6.5);g.lineTo(w*.55,6.5);g.stroke();
 g.strokeStyle='#3b2a1a';g.lineWidth=.8;g.beginPath();g.moveTo(w*.42,6);g.lineTo(w*.5,1);g.lineTo(w*.6,1);g.stroke();
 g.fillStyle='#3b2a1a';for(const x of[10,18,w-18,w-10]){g.beginPath();g.arc(x,20,2,0,7);g.fill();}
 return{c,w,h};
}
return{name:'oil',paper:GROUND,ghost:.035,make};
})();
