/* BIRD's approved v19 plan, drawn as an interactive 2D isometric illustration.
   All floor coordinates remain separate from the camera and generated sprites. */
(()=>{
'use strict';
const P=(x,y,z=0)=>[1800+.866*(x-y),260+.5*(x+y)-z];
const points=ps=>ps.map(p=>p.map(n=>Math.round(n*100)/100).join(',')).join(' ');
const polygon=(ps,fill,stroke='#555d5e',width=1.5,extra='')=>`<polygon points="${points(ps)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const line=(a,b,color,width=2,extra='')=>`<path d="M${a.join(' ')}L${b.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const quad=(x,y,w,h,z=0)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>P(a,b,z));
const rooms=[{id:'upper',x:60,y:30,w:480,h:680},{id:'corridor',x:540,y:30,w:720,h:730},{id:'hall',x:60,y:760,w:820,h:1080},{id:'middle',x:880,y:760,w:380,h:500},{id:'lower',x:880,y:1290,w:380,h:550}];
const counters={lecture:0,teamDesks:0,coffee:0,cooler:0,rack:0,lift:0,toilet:0};
const layers=[];let serial=0;
function add(x,y,html,kind='furniture',extra={}){layers.push({id:'iso-'+serial++,depth:x+y,html,kind,...extra});}
function box(x,y,w,h,z,fill='#f3f0e5',side='#c5c7bf',base=0){
 const top=quad(x,y,w,h,z),low=quad(x,y,w,h,base);
 return polygon([top[1],top[2],low[2],low[1]],side)+polygon([top[2],top[3],low[3],low[2]],'#aeb7b1')+polygon(top,fill,'#6f7773',1.4);
}
function table(x,y,w,h,height=54){
 let s=polygon(quad(x+8,y+10,w,h), '#263834','none',0,'opacity=".13"');
 for(const [a,b]of [[x+5,y+5],[x+w-5,y+5],[x+5,y+h-5],[x+w-5,y+h-5]])s+=box(a,b,4,4,height-3,'#59625d','#3b4540');
 return s+box(x,y,w,h,height,'#f7f4e9','#c6cdc4',height-5);
}
function sprite(key,x,y,width=64,height,flip=false,z=0){
 const asset=OFFICE_ISO_ASSETS[key];if(!asset)return '';
 const [sx,sy]=P(x,y,z);height=height||width*asset.height/asset.width;
 return `<g transform="translate(${sx} ${sy})${flip?' scale(-1 1)':''}"><ellipse cy="-2" rx="${width*.3}" ry="${width*.1}" fill="#25352f" opacity=".13"/><image href="${asset.url}" x="${-width/2}" y="${-height}" width="${width}" height="${height}"/></g>`;
}
function chair(x,y,front=false,flip=false){add(x,y,sprite(front?'chairFront':'chairBack',x,y,53,69,flip));}
function equipment(x,y,facing=1){
 // Both monitor planes follow world-y. Opposite seats see opposite faces.
 const panel=[P(x,y-19,65),P(x,y+19,65),P(x,y+19,98),P(x,y-19,98)];
 let body=box(x-7,y-8,14,16,58,'#64716b','#43534d',54)+box(x-2,y-2,4,4,68,'#53645b','#394b42',57);
 body+=polygon(panel,facing>0?'#263f3d':'#3c4843','#263e35',2);
 if(facing>0){
  const face=[P(x+.5,y-16,68),P(x+.5,y+16,68),P(x+.5,y+16,94),P(x+.5,y-16,94)];body+=polygon(face,'#668e8b','#263f36',.6);
  for(let i=0;i<4;i++)body+=line(P(x+1,y-11,72+i*5),P(x+1,y+(i%2?9:13),72+i*5),i%2?'#c1d7ba':'#92b6ac',1.2);
 }else body+=line(P(x,y-5,77),P(x,y+5,77),'#64766a',1.7);
 add(x,y,body,'equipment',{support:'desk',facing,depth:x+y+30});
 const kx=facing>0?x+10:x-27;
 let keys=polygon(quad(kx,y-15,17,30,55),'#40534b','#293e33',.8);
 for(let j=0;j<4;j++)keys+=line(P(kx+3+j*3,y-12,56),P(kx+3+j*3,y+12,56),'#92a393',.8);
 const [mx,my]=P(kx+8,y+22,56);keys+=`<ellipse cx="${mx}" cy="${my}" rx="4" ry="2.5" fill="#3d514b"/>`;
 keys+=box(kx+2,y+31,8,8,63,'#c1aa7f','#927e5b',54);
 add(kx+8,y+10,keys,'equipment',{support:'desk',facing,depth:kx+y+48});
 return '';
}
function addTable(x,y,w,h,height=54){
 add(x+w/2,y+h/2,polygon(quad(x+8,y+10,w,h),'#263834','none',0,'opacity=".13"'),'ground');
 for(const [a,b]of [[x+5,y+5],[x+w-5,y+5],[x+5,y+h-5],[x+w-5,y+h-5]])add(a,b,box(a,b,4,4,height-3,'#59625d','#3b4540'),'desk-leg');
 // Tile only the top surface for depth ordering; no internal seam strokes.
 for(let ix=0;ix<w;ix+=45)for(let iy=0;iy<h;iy+=45){
  const a=x+ix,b=y+iy,tw=Math.min(45,w-ix),th=Math.min(45,h-iy);
  let top=polygon(quad(a,b,tw,th,height),'#f7f4e9','none',0);
  if(ix===0)top+=line(P(a,b,height),P(a,b+th,height),'#6f7773',1.4);
  if(iy===0)top+=line(P(a,b,height),P(a+tw,b,height),'#6f7773',1.4);
  if(ix+tw===w)top+=polygon([P(a+tw,b,height),P(a+tw,b+th,height),P(a+tw,b+th,height-5),P(a+tw,b,height-5)],'#c6cdc4','#6f7773',1);
  if(iy+th===h)top+=polygon([P(a,b+th,height),P(a+tw,b+th,height),P(a+tw,b+th,height-5),P(a,b+th,height-5)],'#b3bfb2','#6f7773',1);
  add(a+tw/2,b+th/2,top,'desk-top',{footprint:[a,b,tw,th]});
 }
}
function teamDesk(x,y,w,bar,stem,stemLength,gap=0){
 const sx=x+(w-stem)/2;
 addTable(x,y,w,bar);addTable(sx,y+bar+gap,stem,stemLength);
 for(const yy of [y+bar+gap+58,y+bar+gap+stemLength-60]){
  chair(sx-35,yy,true,false);chair(sx+stem+35,yy,false,true);
  equipment(sx+stem/2-5,yy,-1);equipment(sx+stem/2+5,yy,1);
 }
 counters.teamDesks++;
}
function wall(x1,y1,x2,y2,height=122,{glass=false,window=false,near=false,tag=''}={}){
 const length=Math.hypot(x2-x1,y2-y1),steps=Math.ceil(length/170);
 for(let i=0;i<steps;i++){
  const a=[x1+(x2-x1)*i/steps,y1+(y2-y1)*i/steps],b=[x1+(x2-x1)*(i+1)/steps,y1+(y2-y1)*(i+1)/steps];
  const a0=P(...a),b0=P(...b),at=P(...a,height),bt=P(...b,height),poly=[a0,b0,bt,at];
  let s=polygon(poly,glass?'#bbd1ce':'url(#isoWall)','#788580',2,glass?'fill-opacity=".26"':'');
  s+=polygon([at,bt,[bt[0]+7,bt[1]-4],[at[0]+7,at[1]-4]],glass?'#425a52':'#a1b2a4','#63796a',1);
  s+=line(at,bt,glass?'#3d554d':'#738b7c',4)+line(a0,b0,glass?'#4c615d':'#86948c',4);

  if(glass){
   s+=line(a0,at,'#405853',4)+line(b0,bt,'#405853',4);
   const u=[a[0]+(b[0]-a[0])*.18,a[1]+(b[1]-a[1])*.18],v=[a[0]+(b[0]-a[0])*.46,a[1]+(b[1]-a[1])*.46];
   s+=line(P(...u,20),P(...v,height-17),'#f6fff4',3,'opacity=".55"');
  }else if(window){
   const u=[a[0]+(b[0]-a[0])*.06,a[1]+(b[1]-a[1])*.06],v=[a[0]+(b[0]-a[0])*.94,a[1]+(b[1]-a[1])*.94];
   const wp=[P(...u,18),P(...v,18),P(...v,height-15),P(...u,height-15)];
   s+=polygon(wp,'url(#isoWindow)','#3c5351',4);
   const mid=[(u[0]+v[0])/2,(u[1]+v[1])/2];s+=line(P(...mid,18),P(...mid,height-15),'#3c5351',3);
   s+=line(P(...u,62),P(...v,62),'#566d67',2);
  }
  add((a[0]+b[0])/2,(a[1]+b[1])/2,s,'wall',{polygon:poly,tag,near,height});
 }
}
function door(y1,y2,isLift){
 // Doors lie on the actual floor boundary. Their rooms continue outside this drawing.
 const x=1260,top=isLift?121:113,poly=[P(x,y1),P(x,y2),P(x,y2,top),P(x,y1,top)];
 let body=polygon(poly,isLift?'url(#isoMetal)':'#aaa28d',isLift?'#465355':'#667367',isLift?5:3);
 if(isLift){
  body+=line(P(x,y1+5,4),P(x,y1+5,116),'#e1e5df',2)+line(P(x,y2-5,4),P(x,y2-5,116),'#7c8988',2);
  body+=line(P(x,(y1+y2)/2,2),P(x,(y1+y2)/2,119),'#536266',2.7);
  body+=polygon([P(x,y1-3,121),P(x,y2+3,121),P(x,y2+3,145),P(x,y1-3,145)],'#d0d7ce','#65776d',2);
  const mid=(y1+y2)/2;body+=polygon([P(x,mid-24,127),P(x,mid+24,127),P(x,mid+24,141),P(x,mid-24,141)],'#293b35','#293b35',1);
  const [dx,dy]=P(x,mid,134);body+=`<path d="M${dx-7} ${dy+3}l4-6 4 6M${dx+4} ${dy-3}l4 6 4-6" fill="none" stroke="#c8dfb8" stroke-width="1.7"/>`;
  const u=P(x,y1-16,62);body+=`<rect x="${u[0]-3}" y="${u[1]-12}" width="7" height="24" rx="1" fill="#4d6058" stroke="#9dafa1"/><circle cx="${u[0]+.5}" cy="${u[1]-4}" r="1.6" fill="#d5e2cb"/><circle cx="${u[0]+.5}" cy="${u[1]+4}" r="1.6" fill="#d5e2cb"/>`;
  counters.lift++;
 }else{const[a,b]=P(x,y1+18,50);body+=`<circle cx="${a}" cy="${b}" r="2.5" fill="#414f49"/>`;counters.toilet++;}
 add(x,(y1+y2)/2,body,'wall',{polygon:poly,tag:isLift?'elevator':'toilet',height:top,boundary:true});
}
function light(x,y,w){
 const a=P(x,y,149),b=P(x+w,y,149),floor=quad(x-10,y-5,w+25,115);
 add(x+w/2,y,polygon(floor,'url(#isoLightPool)','none',0),'ground');

}
function plant(x,y){
 let s=box(x-10,y-10,20,20,23,'#af7758','#775a42');const [a,b]=P(x,y,23);
 s+=`<g transform="translate(${a} ${b})"><path d="M0 0Q-29-8-15-32Q3-23 0 0Q12-42 25-26Q21-8 0 0Q-4-42 7-42Q18-25 0 0" fill="#648251" stroke="#3c6550" stroke-width="2"/><path d="M0-2L-12-28M0-2L20-25M0-2L7-37" stroke="#a0b47a" stroke-width="2"/></g>`;
 add(x,y,s);
}
// Keep every accepted piece of v19 geometry literal and inspectable.
teamDesk(125,100,350,80,80,355,25);
teamDesk(930,820,280,65,76,310);
teamDesk(930,1360,280,70,75,300);
addTable(105,1070,80,330);equipment(128,1165,1);equipment(128,1340,1);
chair(225,1155,false,true);chair(225,1330,false,true);
addTable(95,805,230,50,73);
for(const x of [147,267]){
 let s=table(x-12,875,25,25,51);add(x,890,s);
}
for(let row=0;row<4;row++)for(let col=0;col<5;col++){
 const x=335+col*102,y=1380+row*110;
 add(x+40,y+55,sprite((row+col)%2?'lectureBlue':'lectureYellow',x+40,y+74,108,128,true),'lecture',{row:row+1,column:col+1});counters.lecture++;
}
// Correct service positions: same face of wall, low by the glass doorway.
add(850,835,sprite('cooler',850,835,41,105),'service');counters.cooler++;
add(842,747,sprite('coffee',842,747,59,125),'service');counters.coffee++;
add(850,625,sprite('rack',850,625,95,105),'service');counters.rack++;
// Kitchen inner wall reaches the glass-wall alignment; counter follows it.
let kitchen=box(905,145,340,48,55,'#f3f1e5','#b5c4b8');
for(let x=925;x<1180;x+=44)kitchen+=line(P(x,193,4),P(x,193,51),'#82998c',1);
kitchen+=polygon(quad(1040,153,44,32,56),'#8fa9aa','#557a78',2);
for(const x of [1125,1154]){const[a,b]=P(x+9,164,56);kitchen+=`<ellipse cx="${a}" cy="${b}" rx="8" ry="4" fill="#4c635f"/>`;}
kitchen+=box(945,151,30,27,76,'#3e514a','#263e37',55)+box(1190,140,55,52,112,'#e1e7db','#bbc8bf');
kitchen+=line(P(1194,192,65),P(1240,192,65),'#a0b0a6',2)+line(P(1198,192,73),P(1198,192,95),'#708d7f',3);
add(1080,168,kitchen,'kitchen');add(1060,95,table(970,80,185,25),'desk');chair(1020,58,true,true);chair(1100,126,false,false);
// Windows, room walls, service corner, flush elevator and toilet bank.
wall(60,30,1260,30,145);
wall(60,30,60,710,145);wall(60,760,60,1840,145,{window:true,tag:'windows'});
wall(540,30,540,710,110,{tag:'upper-partition'});
wall(60,710,540,710,110,{tag:'upper-room-end'});
wall(60,760,540,760,112,{tag:'hall-end'});
for(const [a,b]of [[760,980],[1060,1260],[1290,1470],[1570,1840]])wall(880,a,880,b,112,{glass:true,tag:'office-glass'});
wall(880,760,1260,760,100);wall(880,1260,1260,1260,60,{near:true});wall(880,1290,1260,1290,95);
wall(1260,760,1260,1840,43,{near:true});wall(60,1840,1260,1840,18,{near:true});
wall(886,565,886,760,128,{tag:'service-wall'});wall(886,565,1260,565,128,{tag:'service-turn'});
wall(1260,30,1260,270,145,{tag:'utility-bank'});wall(1260,350,1260,430,145,{tag:'utility-bank'});
door(430,565,true);door(270,350,false);
wall(878,195,1260,195,38,{tag:'kitchen-wall'});
// Retractable lecture screen is partly lowered at the agreed front edge.
const screen=[P(330,1835,55),P(840,1835,55),P(840,1835,118),P(330,1835,118)];
add(585,1835,polygon(screen,'#f7f5e9','#566b62',3)+line(P(325,1835,121),P(845,1835,121),'#41564d',7),'screen');
add(590,1500,box(580,1490,28,22,133,'#e8e8da','#8b9e91',115),'equipment-ceiling');
for(const [x,y,w]of [[95,150,330],[95,920,330],[400,1170,330],[420,1580,300],[930,950,220],[930,1500,220],[620,350,170]])light(x,y,w);
for(const [x,y]of [[90,90],[500,95],[910,790],[1220,1220],[915,1780],[90,1770]])plant(x,y);
const defs=`<defs><linearGradient id="isoWall" x2=".3" y2="1"><stop stop-color="#f4f0df"/><stop offset="1" stop-color="#c4cfc3"/></linearGradient><linearGradient id="isoWindow" x2=".8" y2="1"><stop stop-color="#d8e8dc"/><stop offset=".55" stop-color="#b1cbc5"/><stop offset="1" stop-color="#eddfa9"/></linearGradient><linearGradient id="isoMetal"><stop stop-color="#9eaaaa"/><stop offset=".45" stop-color="#d8dddc"/><stop offset=".5" stop-color="#a8b4b5"/><stop offset="1" stop-color="#c9d1d0"/></linearGradient><radialGradient id="isoLightPool"><stop stop-color="#fff1b6" stop-opacity=".3"/><stop offset="1" stop-color="#fff1b6" stop-opacity="0"/></radialGradient><pattern id="isoFloor" width="94" height="51" patternUnits="userSpaceOnUse"><rect width="94" height="51" fill="#aebbb1"/><path d="M0 0L47 25.5 94 0M0 51L47 25.5 94 51" fill="none" stroke="#97aaa0" stroke-opacity=".19"/><path d="M13 18h3m47 21h2m16-30h4" stroke="#d5d6c3" stroke-opacity=".32"/></pattern></defs>`;
function floors(zones=[]){
 let s=polygon([[60,30],[1260,30],[1260,1840],[60,1840]].map(([x,y])=>P(x,y)), '#354c43','#273f36',12);
 for(const r of rooms)s+=polygon(quad(r.x,r.y,r.w,r.h),'url(#isoFloor)','#7e978a',2);
 // The upper-left separation is a substantial wall footprint, not walkable floor.
 s+=polygon(quad(60,710,480,50),'#526b5e','#526b5e',1);
 for(const z of zones.filter(z=>z.virtual))s+=polygon(quad(z.wx,z.wy,z.ww,z.wh),'url(#isoFloor)','#91a58e',5);
 return s;
}
function bounds(x,y,w,h,pad=0){const ps=quad(x,y,w,h);return{x:Math.min(...ps.map(p=>p[0]))-pad,y:Math.min(...ps.map(p=>p[1]))-140-pad,width:Math.max(...ps.map(p=>p[0]))-Math.min(...ps.map(p=>p[0]))+2*pad,height:Math.max(...ps.map(p=>p[1]))-Math.min(...ps.map(p=>p[1]))+140+2*pad};}
function pointInside(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
function fades(w,people){
 if(!w.polygon)return false;
 return people.some(person=>person.depth<w.depth+12&&[-88,-65,-40,-12].some(y=>[-33,-16,0,16,33].some(x=>pointInside([person.x+x,person.y+y],w.polygon))));
}
function draw(people=[],zones=[],underlay=''){
 const items=layers.map(item=>({...item}));
 for(const z of zones.filter(z=>z.virtual)){
  const x=z.wx+45,y=z.wy+145;for(let r=0;r<Math.ceil(z.project.members.length/4);r++){items.push({id:'extra-'+z.id+'-'+r,depth:x+y+r*110,kind:'desk',html:table(x,y+r*110,z.ww-90,45)});}
 }
 let hidden=0;
 for(const item of items){if(item.kind==='wall'&&fades(item,people)){item.faded=true;hidden++;}}
 items.push(...people.map(p=>({...p,kind:'person',id:'person-'+p.memberId})));
 const priority={'desk-leg':0,wall:1,'desk-top':2,equipment:3,person:4};items.forEach((item,i)=>item.order=i);
 items.sort((a,b)=>(a.kind==='ground'?-1:0)-(b.kind==='ground'?-1:0)||a.depth-b.depth||(priority[a.kind]||0)-(priority[b.kind]||0)||a.order-b.order);
 return {html:defs+floors(zones)+underlay+items.map(i=>`<g class="iso-layer ${i.kind==='wall'?'iso-wall':''} ${i.faded?'is-faded':''}" data-scene-kind="${i.kind}" data-layer-id="${i.id}" ${i.tag?`data-wall-tag="${i.tag}"`:''} ${i.row?`data-row="${i.row}" data-column="${i.column}"`:''} ${i.faded?'data-occluded="true"':''} pointer-events="${i.kind==='person'?'auto':'none'}">${i.html}</g>`).join(''),fadedWalls:hidden};
}
const zoneDefinitions=[{wx:85,wy:65,ww:440,wh:610,seats:[[160,325],[440,430],[155,550],[440,590]]},{wx:910,wy:1320,ww:330,wh:470,seats:[[945,1590],[1215,1440],[940,1750],[1210,1660]]},{wx:910,wy:795,ww:330,wh:440,seats:[[940,1000],[1210,930],[940,1180],[1210,1120]]}];
window.BirdOfficeScene={project:P,quad,bounds,draw,floors,rooms,zoneDefinitions,counters,staticLayers:layers,utilityBank:{x:1260,lift:[430,565],toilet:[270,350]},
 width:3100,height:2200,version:'bird-isometric-v19',home:P(280,300),regions:{teams:P(280,300),lecture:P(530,1580),kitchen:P(965,365)},
 minimap:(zones=[])=>rooms.map(r=>polygon(quad(r.x,r.y,r.w,r.h),r.id==='hall'?'#c4cdb9':'#a1b39f','#5e7b68',9)).join('')+zones.filter(z=>z.virtual).map(z=>polygon(quad(z.wx,z.wy,z.ww,z.wh),'#b5b99b','#5e7b68',9)).join('')};
})();
