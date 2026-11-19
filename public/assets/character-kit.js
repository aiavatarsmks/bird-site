'use strict';
/* Character kit for a demo visitor who joins as themselves: the parts they can choose, the check of a saved
   choice, and the pixel drawing of every pose the office plays. The drawing follows the office's own characters:
   a 96×88 pixel figure shown at 4× (384×352 frames), black outline, three tones per colour, lit from the left.
   The browser draws the live preview with it; the demo server draws the same pixels into the sprite sheets.

   BirdCharacterKit.validate(spec)       -> a clean spec, or null when any key or value is unknown or missing
   BirdCharacterKit.frame(spec,pose)     -> {w,h,rgba} one 96×88 frame (pose: stand|wave|look|sit|step|coffee|walk:N|back:N)
   BirdCharacterKit.sheet(spec,kind)     -> {w,h,rgba} at 1×: idle and activity are 3 frames in a row, walk is 8 front + 8 back
   BirdCharacterKit.teamKey(name)        -> the name with case, accents, spaces and punctuation taken out, for matching teams */
(()=>{
const PARTS={
 body:['f','m'],
 hair:['short','bob','long','bun'],
 hairColour:['black','brown','auburn','blonde','grey'],
 face:['calm','smile','serious','bright'],
 skin:['s1','s2','s3','s4','s5'],
 top:['tee','shirt','hoodie','jacket'],
 topColour:['green','orange','blue','red','mustard','charcoal'],
 bottomColour:['denim','black','khaki','grey','brown'],
};
const TOGGLES=['moustache','beard','glasses'];
const DEFAULT={body:'f',hair:'bob',hairColour:'brown',face:'calm',skin:'s2',top:'jacket',topColour:'green',bottomColour:'denim',moustache:false,beard:false,glasses:false};
const COLOURS={
 hairColour:{black:'#2b2433',brown:'#5b3a29',auburn:'#9b4527',blonde:'#d9ad5f',grey:'#a4a3a8'},
 skin:{s1:'#f7d6bd',s2:'#eab48c',s3:'#c98c5f',s4:'#9b6342',s5:'#6a412c'},
 topColour:{green:'#6f8f5f',orange:'#d8763b',blue:'#3f6aa6',red:'#b5443d',mustard:'#d3a33c',charcoal:'#45474f'},
 bottomColour:{denim:'#40608f',black:'#2c2c35',khaki:'#9c8b62',grey:'#6d707a',brown:'#6b4a34'},
};

function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 for(const k of Object.keys(input))if(!(k in DEFAULT))return null;
 const out={};
 for(const [k,list] of Object.entries(PARTS)){if(!list.includes(input[k]))return null;out[k]=input[k];}
 for(const k of TOGGLES){if(typeof input[k]!=='boolean')return null;out[k]=input[k];}
 return out;
}
// "Agro Bit", "agrobit" and "AGRO-BIT" are one team; so are "Đakovo Farm" and "dakovo farm".
const teamKey=name=>String(name??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').replace(/[łŁ]/g,'l').replace(/[øØ]/g,'o').replace(/ß/g,'ss').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');

// Colours ------------------------------------------------------------------------------------------
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const DARK=hex('#2b1f3d'),LIGHT=hex('#fff6e0'),INK=hex('#140f1c');
const tones=base=>{const c=hex(base);return {base:c,shade:mix(c,DARK,.34),light:mix(c,LIGHT,.24),line:mix(c,INK,.6)};};
const OUTLINE=hex('#1b1622');
function palette(spec){
 const skin=COLOURS.skin[spec.skin],top=COLOURS.topColour[spec.topColour];
 return {
  skin:tones(skin),hair:tones(COLOURS.hairColour[spec.hairColour]),top:tones(top),bottom:tones(COLOURS.bottomColour[spec.bottomColour]),
  inner:tones(spec.topColour==='charcoal'?'#d9d4c8':'#ece7dc'),collar:tones('#f1ede4'),shoe:tones('#3f2b27'),
  eye:tones('#231a2b'),white:tones('#fbf7f0'),mouth:tones('#8c3b3f'),blush:{base:mix(hex(skin),hex('#e0605a'),.35)},
  frame:tones('#2a2430'),lens:{base:mix(hex(skin),hex('#d8ecf5'),.5)},cup:tones('#f4f1ea'),string:tones('#efe9dc'),
 };
}

// Drawing surface: each pixel keeps a colour key, the part it belongs to and that part's depth. --------
const W=96,H=88;
function surface(){return {key:new Array(W*H).fill(null),part:new Int16Array(W*H).fill(-1),tone:new Array(W*H).fill(null),parts:[]};}
function addPart(s,{edge=true,shade='body'}={}){s.parts.push({edge,shade});return s.parts.length-1;}
function put(s,x,y,key,part){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;s.key[i]=key;if(part!==undefined){s.part[i]=part;s.tone[i]=null;}}
// A decal changes the colour only: eyes, buttons, lines. The pixel stays in its part.
function dot(s,x,y,key,tone='base'){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;s.key[i]=key;s.tone[i]=tone;}
function rect(s,x0,y0,x1,y1,key,part){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)put(s,x,y,key,part);}
function spans(s,y0,rows,key,part){rows.forEach((r,i)=>{if(r)rect(s,r[0],y0+i,r[1],y0+i,key,part);});}
function ellipse(s,cx,cy,rx,ry,key,part,keep=()=>true){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry;if(dx*dx+dy*dy<=1&&keep(x,y))put(s,x,y,key,part);}}
function capsule(s,ax,ay,bx,by,r,key,part){
 const x0=Math.floor(Math.min(ax,bx)-r),x1=Math.ceil(Math.max(ax,bx)+r),y0=Math.floor(Math.min(ay,by)-r),y1=Math.ceil(Math.max(ay,by)+r),dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy||1;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)),qx=ax+t*dx-px,qy=ay+t*dy-py;if(qx*qx+qy*qy<=r*r)put(s,x,y,key,part);}
}
const at=(s,x,y)=>x<0||y<0||x>=W||y>=H?-1:s.part[y*W+x];

// Pose: where the joints are. Every pose starts from the standing figure. -----------------------------
function pose(name,spec){
 const m=spec.body==='m',sx=m?1:0;
 const p={view:'front',bob:0,eyes:0,blink:false,
  armL:{sh:[37.5-sx,37.5],el:null,hand:[35.5-sx,54]},armR:{sh:[58.5+sx,37.5],el:null,hand:[60.5+sx,54]},
  legL:{hip:[43.5,57],knee:null,foot:[43.5,77]},legR:{hip:[51.5,57],knee:null,foot:[52,77]},cup:false,wave:false};
 const [kind,n]=String(name).split(':');
 if(kind==='wave'){p.armR={sh:p.armR.sh,el:[63+sx,33],hand:[64+sx,25]};p.wave=true;}
 else if(kind==='look')p.eyes=1;
 else if(kind==='coffee'){p.armR={sh:p.armR.sh,el:[60+sx,49],hand:[55,46]};p.cup=true;}
 else if(kind==='step'){p.legL.foot=[39.5,77];p.legR.foot=[56,76];p.armL.hand=[38-sx,54];p.armR.hand=[58+sx,53];}
 else if(kind==='sit'){
  p.legL={hip:[44,57],knee:[56,57.5],foot:[56.5,77],sit:true};p.legR={hip:[50,58],knee:[60.5,59],foot:[61,77],sit:true};
  p.armL={sh:p.armL.sh,el:[40-sx,49],hand:[50,49]};p.armR={sh:p.armR.sh,el:[60+sx,48],hand:[65,49]};
 }else if(kind==='walk'||kind==='back'){
  // One gait cycle in eight frames: the legs swing and lift, the arms swing against them, the body bobs at the pass.
  const t=Number(n)/8*Math.PI*2,sw=Math.sin(t),lift=v=>Math.max(0,v)*2;
  p.view=kind==='back'?'back':'front';p.bob=Math.abs(sw)<.5?-1:0;
  p.legL.foot=[43-sw*1.5,77-lift(Math.cos(t))*1.5];p.legR.foot=[52+sw*1.5,77-lift(-Math.cos(t))*1.5];
  p.armL.hand=[35.5-sx-sw*2.5,54];p.armR.hand=[60.5+sx+sw*2.5,54];
 }
 return p;
}

// The figure --------------------------------------------------------------------------------------
function hairShape(spec,back){
 // Hair is a cap round the skull plus what each style adds; in front the face shows through a window.
 const h=spec.hair,cap={short:[47.5,15.5,11,9.6],bob:[47.5,16,12,10.6],long:[47.5,16,12,10.6],bun:[47.5,15.5,11,9.6]}[h];
 const fringe=x=>h==='short'?12+(x%3===0?1:0):h==='bun'?11+(x<44||x>51?1:0):h==='bob'?Math.max(12,Math.min(16,12+Math.round((x-41)*.45))):Math.max(12,Math.min(15,15-Math.round((x-40)*.35)));
 const side={short:20,bun:20,bob:31,long:33}[h];
 const inFace=(x,y)=>!back&&x>=39&&x<=56&&y>=fringe(x);
 return {cap,inFace,side,fringe};
}
function drawFigure(spec,name){
 const s=surface(),p=pose(name,spec),m=spec.body==='m',back=p.view==='back',b=p.bob,sleeve=spec.top!=='tee';
 const sx=m?1:0;
 const hair=hairShape(spec,back);
 // Long hair falls behind the shoulders.
 if(spec.hair==='long'){const hb=addPart(s,{shade:'hair'});rect(s,36,24+b,59,back?47+b:44+b,'hair',hb);for(const x of [36,59])put(s,x,(back?47:44)+b,null,-1);}
 // Legs, back one first.
 const leg=(L,key)=>{const part=addPart(s);const knee=L.knee||[(L.hip[0]+L.foot[0])/2,(L.hip[1]+b+L.foot[1])/2];capsule(s,L.hip[0],L.hip[1]+b,knee[0],knee[1],3.3,key,part);capsule(s,knee[0],knee[1],L.foot[0],L.foot[1]-1,3.1,key,part);return part;};
 const shoe=(L)=>{const part=addPart(s,{shade:'flat'});const fx=L.foot[0]+(L.sit?1.5:.8),fy=L.foot[1]+2.6;ellipse(s,fx,fy,4.1,2.6,'shoe',part,(x,y)=>y<=Math.round(L.foot[1])+5);};
 const legs=p.legL.foot[0]<p.legR.foot[0]-6&&!p.legL.sit?[p.legL,p.legR]:[p.legL,p.legR];
 for(const L of legs){leg(L,'bottom');shoe(L);}
 // Trousers top.
 const pel=addPart(s);rect(s,40,53+b,55,58+b,'bottom',pel);
 // Arms behind the torso when they swing back are still drawn after it: at this size the side view reads better.
 const neck=addPart(s,{shade:'skin'});rect(s,45,29+b,50,35+b,'skin',neck);
 // Torso.
 const torso=addPart(s),y0=34+b;
 const rows=m?[[40,55],[38,57],[37,58],[37,58],[37,58],[37,58],[37,58],[37,58],[37,58],[37,58],[37,58],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57]]
  :[[41,54],[39,56],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[39,56],[39,56],[39,56],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57],[38,57]];
 if(spec.top==='jacket')rows.push([38,57]);
 spans(s,y0,rows,'top',torso);
 if(!back){
  if(spec.top==='tee'){for(let x=45;x<=50;x++)put(s,x,y0,'skin',neck);for(let x=46;x<=49;x++)put(s,x,y0+1,'skin',neck);}
  if(spec.top==='shirt'){for(let x=46;x<=49;x++)put(s,x,y0,'skin',neck);for(let y=y0+2;y<=y0+20;y++)dot(s,47,y,'top','shade');for(let y=y0+4;y<=y0+18;y+=4)dot(s,48,y,'collar');
   const col=addPart(s,{shade:'flat'});for(const [x,y] of [[43,0],[44,0],[45,0],[44,1],[45,1],[45,2],[50,0],[51,0],[52,0],[50,1],[51,1],[50,2]])put(s,x,y0+y,'collar',col);}
  if(spec.top==='hoodie'){const hood=addPart(s);spans(s,y0-1,[[42,53],[41,54],[42,44],[42,43]],'top',hood);put(s,51,y0+1,'top',hood);put(s,52,y0+1,'top',hood);put(s,53,y0+1,'top',hood);put(s,52,y0+2,'top',hood);put(s,53,y0+2,'top',hood);
   for(let y=y0+2;y<=y0+7;y++){dot(s,46,y,'string');dot(s,49,y,'string');}
   for(let x=42;x<=53;x++)dot(s,x,y0+13,'top','shade');for(let y=y0+13;y<=y0+17;y++){dot(s,42,y,'top','shade');dot(s,53,y,'top','shade');}}
  if(spec.top==='jacket'){const inner=addPart(s,{shade:'flat'});for(let y=y0;y<=y0+19;y++)for(let x=45;x<=50;x++)put(s,x,y,'inner',inner);
   for(let x=46;x<=49;x++)put(s,x,y0,'skin',neck);
   for(const [x,y] of [[44,1],[44,2],[45,3],[45,4],[51,1],[51,2],[50,3],[50,4]])dot(s,x,y0+y,'top','shade');}
 }else{
  if(spec.top==='hoodie'){for(let y=y0;y<=y0+6;y++)for(let x=42+Math.max(0,y-y0-3);x<=53-Math.max(0,y-y0-3);x++)dot(s,x,y,'top',y===y0+6||x===42+Math.max(0,y-y0-3)?'shade':'base');}
  if(spec.top==='jacket')for(let y=y0+3;y<=y0+20;y++)dot(s,47,y,'top','shade');
  if(spec.top==='shirt')for(let x=44;x<=51;x++)dot(s,x,y0,'collar');
 }
 // Arms: sleeve, then the forearm (skin for a tee), then the hand.
 const arm=(A,right)=>{
  const part=addPart(s),el=A.el||[(A.sh[0]+A.hand[0])/2,(A.sh[1]+A.hand[1])/2],sh=[A.sh[0],A.sh[1]+b],hand=[A.hand[0],A.hand[1]+(A.el?b:b)];
  capsule(s,sh[0],sh[1],el[0],el[1]+b*0,2.6,'top',part);
  const fore=sleeve?part:addPart(s,{shade:'skin'});
  if(!sleeve){const mid=[sh[0]+(el[0]-sh[0])*.6,sh[1]+(el[1]-sh[1])*.6];capsule(s,sh[0],sh[1],mid[0],mid[1],2.8,'top',part);capsule(s,mid[0],mid[1]+1,el[0],el[1],2.1,'skin',fore);}
  capsule(s,el[0],el[1],hand[0],hand[1]-1.5,sleeve?2.4:2.1,sleeve?'top':'skin',fore);
  const hp=addPart(s,{edge:false,shade:'skin'});
  if(p.wave&&right){ellipse(s,hand[0],hand[1],2.7,3.2,'skin',hp);for(const fx of [-2,0,2])rect(s,hand[0]+fx-.4,hand[1]-4.6,hand[0]+fx-.4,hand[1]-3,'skin',hp);rect(s,hand[0]-3.6,hand[1]-.6,hand[0]-3.6,hand[1]+.4,'skin',hp);}
  else ellipse(s,hand[0],hand[1]+.6,2.4,2.4,'skin',hp);
 };
 arm(p.armL,false);arm(p.armR,true);
 if(p.cup){const c=addPart(s,{shade:'flat'});rect(s,49,41+b,54,47+b,'cup',c);for(let x=50;x<=53;x++)dot(s,x,41+b,'mouth','shade');put(s,48,43+b,'cup',c);put(s,48,44+b,'cup',c);const hp=addPart(s,{edge:false,shade:'skin'});ellipse(s,56,45+b,2.3,2.4,'skin',hp);}
 // Head: ears, face, then hair over it.
 const head=addPart(s,{shade:'skin'});
 ellipse(s,47.5,19.5+b,9.6,11.6,'skin',head);rect(s,37,19+b,37,23+b,'skin',head);rect(s,58,19+b,58,23+b,'skin',head);
 if(!back)face(s,spec,p,b);
 const hp=addPart(s,{shade:'hair'}),[hx,hy,rx,ry]=hair.cap;
 ellipse(s,hx,hy+b,rx,ry,'hair',hp,(x,y)=>!hair.inFace(x,y-b)&&(y-b<=hair.side||x<39||x>56||back));
 if(spec.hair!=='short'&&spec.hair!=='bun'){rect(s,36,16+b,39,hair.side+b,'hair',hp);rect(s,56,16+b,59,hair.side+b,'hair',hp);
  if(back)rect(s,36,16+b,59,hair.side+b,'hair',hp);
  // Ends: a step at the tips so the cut is not a plain box.
  put(s,36,hair.side+b,null,-1);put(s,59,hair.side+b,null,-1);}
 if(back&&(spec.hair==='short'||spec.hair==='bun'))rect(s,38,16+b,57,26+b,'hair',hp);
 if(spec.hair==='bun'){ellipse(s,47.5,5+b,4.3,3.8,'hair',hp);}
 if(!back&&spec.hair==='short'){put(s,38,20+b,'hair',hp);put(s,57,20+b,'hair',hp);}
 // Hair strands and the shine.
 for(let x=40;x<=50;x++){const y=(back?13:8)+b+(x<43?43-x:0);if(at(s,x,y)===hp)dot(s,x,y,'hair','light');if(x>41&&x<48&&at(s,x,y+1)===hp)dot(s,x,y+1,'hair','light');}
 if(back)for(const x of [43,47,52])for(let y=18;y<=hair.side-2;y+=1)if(at(s,x,y+b)===hp)dot(s,x,y+b,'hair','shade');
 if(back&&spec.glasses){dot(s,37,20+b,'frame');dot(s,58,20+b,'frame');}
 return finish(s,spec);
}
function face(s,spec,p,b){
 const e=p.eyes,Y=y=>y+b;
 const eyes=(shape)=>{for(const ox of [42,52]){const x=ox+e;
  if(shape==='arc'){dot(s,x-1,Y(21),'eye');dot(s,x,Y(20),'eye');dot(s,x+1,Y(20),'eye');dot(s,x+2,Y(21),'eye');}
  else if(shape==='small'){for(const [dx,dy] of [[0,20],[1,20],[0,21],[1,21]])dot(s,x+dx,Y(dy),'eye');}
  else{for(const [dx,dy] of [[0,19],[1,19],[0,20],[1,20],[0,21],[1,21]])dot(s,x+dx,Y(dy),'eye');dot(s,x+(shape==='bright'?1:0),Y(19),'white');}}};
 const brow=(rows)=>{for(const [x,y] of rows)dot(s,x,Y(y),'hair','shade');};
 if(spec.face==='calm'){eyes('dot');brow([[41,17],[42,17],[43,17],[52,17],[53,17],[54,17]]);for(let x=46;x<=49;x++)dot(s,x,Y(26),'mouth');dot(s,45,Y(25),'mouth','shade');dot(s,50,Y(25),'mouth','shade');}
 if(spec.face==='smile'){eyes('arc');brow([[41,17],[42,16],[43,16],[52,16],[53,16],[54,17]]);for(let x=45;x<=50;x++)dot(s,x,Y(25),x===45||x===50?'mouth':'white');for(let x=46;x<=49;x++)dot(s,x,Y(26),'mouth');dot(s,41,Y(23),'blush');dot(s,54,Y(23),'blush');}
 if(spec.face==='serious'){eyes('small');brow([[41,17],[42,17],[43,18],[44,18],[51,18],[52,18],[53,17],[54,17],[42,18],[53,18]]);for(let x=46;x<=49;x++)dot(s,x,Y(26),'skin','shade');dot(s,47,Y(26),'mouth','shade');dot(s,48,Y(26),'mouth','shade');}
 if(spec.face==='bright'){eyes('bright');brow([[42,16],[43,16],[52,16],[53,16]]);dot(s,41,Y(18),'eye');dot(s,54+0,Y(18),'eye');for(let x=46;x<=49;x++)dot(s,x,Y(25),'mouth');dot(s,47,Y(26),'mouth');dot(s,48,Y(26),'mouth');}
 // Nose: one shaded pixel and its tip.
 dot(s,48,Y(23),'skin','shade');
 if(spec.beard){for(let y=21;y<=30;y++)for(let x=38;x<=57;x++){const i=Y(y)*W+x,inHead=s.key[i]==='skin'||s.key[i]==='blush';if(!inHead)continue;
   const sideBurn=(x<=40||x>=55)&&y>=19,jaw=y>=27||(y>=24&&(x<=43||x>=52));const mouth=y>=25&&y<=26&&x>=45&&x<=50;
   if((sideBurn||jaw)&&!mouth)dot(s,x,Y(y),'hair',y>=29?'shade':'base');}}
 if(spec.moustache){for(let x=45;x<=50;x++)dot(s,x,Y(24),'hair');dot(s,44,Y(25),'hair');dot(s,51,Y(25),'hair');for(let x=46;x<=49;x++)dot(s,x,Y(23),'hair','light');}
 if(spec.glasses){
  for(const x0 of [40,50]){for(let x=x0;x<=x0+5;x++){dot(s,x,Y(18),'frame');dot(s,x,Y(22),'frame');}for(let y=18;y<=22;y++){dot(s,x0,Y(y),'frame');dot(s,x0+5,Y(y),'frame');}
   for(let y=19;y<=21;y++)for(let x=x0+1;x<=x0+4;x++){const i=Y(y)*W+x;if(s.key[i]==='skin')dot(s,x,Y(y),'lens');}}
  for(let x=46;x<=49;x++)dot(s,x,Y(19),'frame');dot(s,39,Y(19),'frame');dot(s,56,Y(19),'frame');
 }
}
// Shading, inner lines and the outline, then colours.
function finish(s,spec){
 const out=new Uint8ClampedArray(W*H*4),pal=palette(spec);
 const tone=new Array(W*H).fill('base');
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,part=s.part[i];if(!s.key[i])continue;
  if(s.tone[i]){tone[i]=s.tone[i];continue;}
  if(part<0)continue;
  const info=s.parts[part],same=(dx,dy)=>at(s,x+dx,y+dy)===part;
  // A front part meets one behind it: its edge pixel becomes a line in its own colour.
  if(info.edge){let line=false;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=at(s,x+dx,y+dy);if(q>=0&&q<part&&q!==part&&s.parts[q].edge)line=true;}if(line){tone[i]='line';continue;}}
  if(info.shade==='flat'){tone[i]=!same(1,0)||!same(0,1)?'shade':'base';continue;}
  if(info.shade==='skin'){tone[i]=!same(1,0)||!same(0,1)||at(s,x,y-1)>part&&s.key[(y-1)*W+x]==='hair'?'shade':'base';continue;}
  if(info.shade==='hair'){tone[i]=!same(0,1)||!same(1,0)||!same(2,0)?'shade':!same(-1,0)?'light':'base';continue;}
  tone[i]=!same(1,0)||!same(2,0)||!same(0,1)?'shade':!same(-1,0)?'light':'base';
 }
 for(let i=0;i<W*H;i++){
  const k=s.key[i];
  if(k){const c=pal[k]?.[tone[i]]||pal[k]?.base;out.set([...c,255],i*4);continue;}
  const x=i%W,y=(i-x)/W;
  if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const xx=x+dx,yy=y+dy;return xx>=0&&yy>=0&&xx<W&&yy<H&&s.key[yy*W+xx];}))out.set([...OUTLINE,255],i*4);
 }
 return {w:W,h:H,rgba:out};
}

function frame(spec,name='stand'){const clean=validate(spec);if(!clean)throw Error('invalid character');return drawFigure(clean,name);}
// Sheets at 1×. The office walk cell is square: an 88-pixel crop of the frame, feet on the walk baseline.
const IDLE=['stand','wave','look'],ACTIVITY=['sit','step','coffee'],WALK={frames:8,cell:88,columns:8};
function sheet(spec,kind){
 if(kind==='walk'){
  const w=WALK.cell*WALK.columns,h=WALK.cell*2,rgba=new Uint8ClampedArray(w*h*4);
  for(let r=0;r<2;r++)for(let n=0;n<WALK.frames;n++){const f=frame(spec,(r?'back:':'walk:')+n);
   for(let y=0;y<WALK.cell;y++){const sy=y+2;if(sy>=H)continue;for(let x=0;x<WALK.cell;x++){const sx=x+4,si=(sy*W+sx)*4,di=((r*WALK.cell+y)*w+n*WALK.cell+x)*4;rgba.set(f.rgba.subarray(si,si+4),di);}}}
  return {w,h,rgba};
 }
 const names=kind==='activity'?ACTIVITY:IDLE,w=W*3,rgba=new Uint8ClampedArray(w*H*4);
 names.forEach((n,k)=>{const f=frame(spec,n);for(let y=0;y<H;y++)rgba.set(f.rgba.subarray(y*W*4,(y+1)*W*4),(y*w+k*W)*4);});
 return {w,h:H,rgba};
}
// Where the right hand is in each walk frame (cell pixels at the served 4× size), for a cup carried while walking.
const handPositions=spec=>{const out=[];for(let r=0;r<2;r++)for(let n=0;n<WALK.frames;n++){const p=pose((r?'back:':'walk:')+n,validate(spec)||DEFAULT);out.push([(p.armR.hand[0]-4)*4,(p.armR.hand[1]+p.bob-2)*4]);}return out;};

window.BirdCharacterKit=Object.freeze({PARTS,TOGGLES,DEFAULT,COLOURS,validate,teamKey,frame,sheet,handPositions,WALK,SIZE:{w:W,h:H,scale:4}});
})();
