/* Ambient office routines. Local visual simulation, never attendance tracking. */
(()=>{'use strict';
const STEP=20,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const activities=['work','walk','chat','coffee','water','food','away'];
const phrases={
 coffee:{en:['Coffee time','I want coffee','One espresso','Coffee break','Refill time','A little caffeine','Back in a minute'],hr:['Vrijeme za kavu','Želim kavu','Jedan espresso','Pauza za kavu','Još jednu','Malo kofeina','Vraćam se brzo'],ru:['Время кофе','Хочу кофе','Один эспрессо','Кофе-пауза','Ещё чашечку','Немного кофеина','Скоро вернусь']},
 water:{en:['Water break','Stay hydrated','Just some water','Refill time','A fresh glass','Cheers','Water first'],hr:['Pauza za vodu','Vrijeme za vodu','Samo voda','Napuniti čašu','Čaša vode','Živjeli','Prvo voda'],ru:['Попить воды','Время воды','Просто воды','Наполнить стакан','Стакан воды','За здоровье','Сначала вода']},
 food:{en:['Lunch time','Snack break','I am hungry','Something to eat','Kitchen break','Time for a bite','Be right back'],hr:['Vrijeme za ručak','Mali zalogaj','Gladan sam','Nešto za jelo','Pauza u kuhinji','Vrijeme za obrok','Vraćam se brzo'],ru:['Время обеда','Перекус','Хочу поесть','Что-нибудь съесть','Пауза на кухне','Пора перекусить','Скоро вернусь']},
 away:{en:['Be right back','A little fresh air','Quick break','Heading home','See you soon','Stretch my legs','Stepping outside'],hr:['Vraćam se brzo','Malo zraka','Kratka pauza','Idem kući','Vidimo se','Prošetati malo','Idem van'],ru:['Скоро вернусь','На свежий воздух','Короткая пауза','Пойду домой','До встречи','Размять ноги','Выйду ненадолго']}
};
function navigation(scene){
 const desks=scene.staticLayers.filter(x=>x.kind==='desk-top').map(x=>x.footprint),walls=scene.staticLayers.filter(x=>x.kind==='wall'&&x.worldSegment).map(x=>x.worldSegment);
 const chairs=scene.staticLayers.filter(x=>x.kind==='chair').map(x=>x.footprint);
 const blocks=[...desks,...chairs,[905,140,340,53],[823,800,46,45],[814,712,58,63],[815,595,62,65]];
 for(let r=0;r<4;r++)for(let c=0;c<5;c++)blocks.push([335+c*102+18,1380+r*110+40,44,44]);
 const inside=(x,y)=>scene.rooms.some(r=>x>=r.x+14&&x<=r.x+r.w-14&&y>=r.y+14&&y<=r.y+r.h-14);
 const free=(x,y)=>inside(x,y)&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12);
 // Floor strips share open boundaries; only actual walls block crossings.
 const cells=new Map();for(let x=80;x<=1240;x+=STEP)for(let y=40;y<=1820;y+=STEP){
  const inFloor=scene.rooms.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  if(inFloor&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12))cells.set(x+','+y,[x,y]);
 }
 const nearest=p=>[...cells.values()].reduce((a,b)=>dist(a,p)<dist(b,p)?a:b);
 function route(from,to,seated=false){
  const start=nearest(from),goal=nearest(to),key=p=>p.join(','),open=[start],came=new Map(),seen=new Set([key(start)]);
  for(let i=0;i<open.length;i++){
   const p=open[i];if(key(p)===key(goal)){const result=[p];let k=key(p);while(came.has(k)){const prev=came.get(k);result.push(prev);k=key(prev);}return [from,...result.reverse(),...(seated&&dist(goal,to)<55?[to]:[])];}
   for(const [dx,dy]of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]){const n=[p[0]+dx,p[1]+dy],k=key(n);if(cells.has(k)&&!seen.has(k)){seen.add(k);came.set(k,p);open.push(n);}}
  }return [];
 }
 return{route,free,cells};
}
function create(scene,roster){
 const nav=navigation(scene),actors=new Map(),seats=[[225,263],[375,263],[225,500],[375,500],[997,943],[1143,943],[997,1135],[1143,1135],[998,1488],[1142,1488],[998,1670],[1142,1670]],windowSeats=[[225,1155],[225,1330]];
 let clock=0,serial=0;
 for(const row of roster){const i=serial++,home=row.id==='person-maxim-ilin'?windowSeats[0]:row.id==='person-pavel-isaykov'?windowSeats[1]:row.home;
  actors.set(row.id,{...row,index:i,home:[...home],pos:[...home],mode:'idle',activity:'work',until:3+(i*7)%24,path:[],round:0,variant:i%7,visited:new Set(),seated:row.id==='person-maxim-ilin'||row.id==='person-pavel-isaykov',hidden:false,carry:null});}
 const choices={walk:[[620,900],[650,1120],[740,940],[650,1280],[600,820],[750,1190],[620,1050]],coffee:[[780,740],[780,780]],water:[[790,850],[750,850]],food:[[1020,58],[1100,126]],away:[[1220,500]]};
 function go(a,type,target){const path=nav.route(a.pos,target,type==='work'||type==='food');if(path.length<2)return false;if(type==='work'||type==='food')a.carry=null;a.activity=type;a.visited.add(type);a.path=path.slice(1);a.mode='walking';a.seated=false;a.hidden=false;a.variant=(a.variant+1)%7;a.started=clock;return true;}
 function plan(a){
  const kind=activities[(a.index+a.round++)%7];
  if(kind==='chat'){
   const partner=[...actors.values()].filter(b=>b!==a&&!b.hidden&&b.mode==='idle'&&b.activity!=='chat').sort((b,c)=>dist(a.pos,b.pos)-dist(a.pos,c.pos))[0];
   if(partner){const hubs=[[620,920],[680,1100],[720,1240],[660,820],[620,1280],[700,980],[620,1180]],hub=hubs[a.variant];
    if(go(a,'chat',hub)&&go(partner,'chat',[hub[0]+60,hub[1]])){a.partner=partner.id;partner.partner=a.id;a.until=partner.until=clock+40;return;}}
  }
  if(kind==='work'){
   const preferred=a.id==='person-maxim-ilin'?windowSeats[0]:a.id==='person-pavel-isaykov'?windowSeats[1]:a.id.startsWith('staff-')?seats[4+a.index%4]:seats[[0,1,2,3,8,9,10,11][a.index%8]];
   const used=[...actors.values()].some(b=>b!==a&&b.targetSeat&&dist(b.targetSeat,preferred)<30);
   a.targetSeat=used?a.home:preferred;if(go(a,'work',a.targetSeat))return;
  }else if(choices[kind]){
   const targets=choices[kind],target=targets[(a.variant+a.index)%targets.length];
   if(go(a,kind,[target[0],target[1]+(['away','food'].includes(kind)?0:(a.index%3)*24)]))return;
  }
  if(!go(a,'walk',choices.walk[a.variant])){a.mode='idle';a.until=clock+8;}
 }
 function step(dt){clock+=dt;
  for(const a of actors.values()){
   if(a.carryUntil&&clock>a.carryUntil)a.carry=null;
   if(a.pinned)continue;
   if(a.mode==='departing'){if(clock>a.until){a.mode='away';a.hidden=true;a.until=clock+12+a.index%9;}continue;}
   if(a.mode==='away'){if(clock>a.until){a.hidden=false;a.pos=[1220,500];go(a,'return',a.home);}continue;}
   if(a.mode==='walking'){
    let left=dt*(35+(a.index%4)*3);
    while(left>0&&a.path.length){const target=a.path[0],distance=dist(a.pos,target);if(distance<.1){a.path.shift();continue;}const travel=Math.min(left,distance),next=[a.pos[0]+(target[0]-a.pos[0])*travel/distance,a.pos[1]+(target[1]-a.pos[1])*travel/distance];
     const blocked=[...actors.values()].some(b=>b!==a&&!b.hidden&&dist(next,b.pos)<23&&dist(next,b.pos)<dist(a.pos,b.pos));
     if(blocked){a.blocked=(a.blocked||0)+dt;if(a.blocked>5){a.path=[];a.activity='walk';}break;}
     a.blocked=0;a.pos=next;left-=travel;if(travel===distance)a.path.shift();
    }
    if(!a.path.length){a.mode='idle';a.arrived=clock;a.until=clock+(a.activity==='chat'?15:a.activity==='work'?18:9)+(a.index%7);a.seated=a.activity==='food'||a.activity==='work'&&dist(a.pos,a.home)>20;
     if(a.id==='person-maxim-ilin'||a.id==='person-pavel-isaykov')a.seated=a.activity==='work';
     if(a.activity==='coffee'||a.activity==='water'){a.carry=a.activity;a.carryUntil=clock+35;}
     if(a.activity==='away'){a.mode='departing';a.hidden=false;a.until=clock+1;}
     if(a.activity==='chat')a.celebrate=a.variant===0;
    }
   }else if(a.activity==='chat'&&a.partner&&actors.get(a.partner)?.mode==='walking'&&clock<a.started+70){a.until=clock+15;}else if(clock>a.until){a.partner=null;a.targetSeat=null;plan(a);}
  }
 }
 function words(a,lang){if(a.mode==='away')return '';if(a.activity==='chat'&&a.mode==='idle'&&actors.get(a.partner)?.mode==='idle')return Math.floor(clock/2+a.index)%2?'…':'';const list=phrases[a.activity]?.[lang]||phrases[a.activity]?.en;return list&&clock-(a.mode==='walking'?a.started:a.arrived)<3.8?list[a.variant]:'';}
 return{actors,nav,step,words,get time(){return clock},activities,plan};
}
window.BirdOfficeLife={create,navigation,activities};
})();
