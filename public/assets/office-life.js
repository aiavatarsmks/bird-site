/* Ambient office routines. Local visual simulation, never attendance tracking. */
(()=>{'use strict';
const STEP=20,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const DENSITY_RADIUS=175,AREA_LIMIT=3,MAX_WALKERS=5;
function fitsArea(point,others){if(others.filter(p=>dist(p,point)<DENSITY_RADIUS).length>=AREA_LIMIT)return false;return !others.some(center=>dist(point,center)<DENSITY_RADIUS&&others.filter(p=>dist(p,center)<DENSITY_RADIUS).length>=AREA_LIMIT);}
const activities=['work','walk','chat','coffee','water','food','away'];
const phrases={
 smoke:{en:['Smoke break','A quick break','Stepping outside','Back in a minute','A little fresh air','Outside for a bit','See you in a minute'],hr:['Pauza za cigaretu','Kratka pauza','Idem van','Vraćam se brzo','Malo svježeg zraka','Nakratko van','Vidimo se uskoro'],ru:['Выйду покурить','Короткая пауза','На балкон','Скоро вернусь','Свежий воздух','Ненадолго на улицу','До скорого']},
 coffee:{en:['Coffee time','I want coffee','One espresso','Coffee break','Refill time','A little caffeine','Back in a minute'],hr:['Vrijeme za kavu','Želim kavu','Jedan espresso','Pauza za kavu','Još jednu','Malo kofeina','Vraćam se brzo'],ru:['Время кофе','Хочу кофе','Один эспрессо','Кофе-пауза','Ещё чашечку','Немного кофеина','Скоро вернусь']},
 water:{en:['Water break','Stay hydrated','Just some water','Refill time','A fresh glass','Cheers','Water first'],hr:['Pauza za vodu','Vrijeme za vodu','Samo voda','Napuniti čašu','Čaša vode','Živjeli','Prvo voda'],ru:['Попить воды','Время воды','Просто воды','Наполнить стакан','Стакан воды','За здоровье','Сначала вода']},
 food:{en:['Lunch time','Snack break','I am hungry','Something to eat','Kitchen break','Time for a bite','Be right back'],hr:['Vrijeme za ručak','Mali zalogaj','Gladan sam','Nešto za jelo','Pauza u kuhinji','Vrijeme za obrok','Vraćam se brzo'],ru:['Время обеда','Перекус','Хочу поесть','Что-нибудь съесть','Пауза на кухне','Пора перекусить','Скоро вернусь']},
 away:{en:['Be right back','A little fresh air','Quick break','Heading home','See you soon','Stretch my legs','Stepping outside'],hr:['Vraćam se brzo','Malo zraka','Kratka pauza','Idem kući','Vidimo se','Prošetati malo','Idem van'],ru:['Скоро вернусь','На свежий воздух','Короткая пауза','Пойду домой','До встречи','Размять ноги','Выйду ненадолго']}
};
function navigation(scene){
 const desks=scene.staticLayers.filter(x=>x.kind==='desk-top').map(x=>x.footprint),walls=scene.staticLayers.filter(x=>x.kind==='wall'&&x.worldSegment).map(x=>x.worldSegment);
 const chairs=scene.staticLayers.filter(x=>x.kind==='chair').map(x=>x.footprint);
 const blocks=[...desks,...chairs,...scene.staticLayers.filter(x=>x.kind==='exercise').map(x=>x.footprint),[905,140,340,53],[823,800,46,45],[814,712,58,63],[815,595,62,65]];
 for(let r=0;r<4;r++)for(let c=0;c<5;c++)blocks.push([335+c*102+18,1380+r*110+40,44,44]);
 const inside=(x,y)=>scene.rooms.some(r=>x>=r.x+14&&x<=r.x+r.w-14&&y>=r.y+14&&y<=r.y+r.h-14);
 const free=(x,y)=>inside(x,y)&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12);
 // Floor strips share open boundaries; only actual walls block crossings.
 const cells=new Map();for(let x=80;x<=1240;x+=STEP)for(let y=40;y<=2580;y+=STEP){
  const inFloor=scene.rooms.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  if(inFloor&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12))cells.set(x+','+y,[x,y]);
 }
 const within=(p,r)=>p[0]>r[0]-10&&p[0]<r[0]+r[2]+10&&p[1]>r[1]-10&&p[1]<r[1]+r[3]+10;
 const wallHit=p=>walls.some(([a,b,c,d])=>a===c?Math.abs(p[0]-a)<14&&p[1]>Math.min(b,d)-12&&p[1]<Math.max(b,d)+12:Math.abs(p[1]-b)<14&&p[0]>Math.min(a,c)-12&&p[0]<Math.max(a,c)+12);
 const canStep=(from,to,seated=false)=>!(!wallHit(from)&&wallHit(to))&&!blocks.some(r=>within(to,r)&&!within(from,r)&&!(seated&&chairs.includes(r)));
 const nearest=(p,blocked=new Set())=>[...cells.values()].filter(v=>!blocked.has(v.join(','))).reduce((a,b)=>dist(a,p)<dist(b,p)?a:b);
 function route(from,to,seated=false,avoid=[]){
  const key=p=>p.join(','),blocked=new Set();
  for(const other of avoid)for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){const p=[Math.round(other[0]/STEP)*STEP+dx*STEP,Math.round(other[1]/STEP)*STEP+dy*STEP];if(dist(p,other)<45)blocked.add(key(p));}
  if(avoid.length){const saturated=avoid.filter(p=>avoid.filter(q=>dist(p,q)<DENSITY_RADIUS).length>=AREA_LIMIT);for(const p of cells.values())if(avoid.filter(q=>dist(p,q)<DENSITY_RADIUS).length>=AREA_LIMIT||saturated.some(q=>dist(p,q)<DENSITY_RADIUS))blocked.add(key(p));}
  const start=nearest(from,blocked),goal=nearest(to);if(blocked.has(key(goal)))return [];
  const open=[start],came=new Map(),seen=new Set([key(start)]);
  for(let i=0;i<open.length;i++){
   const p=open[i];if(key(p)===key(goal)){const result=[p];let k=key(p);while(came.has(k)){const prev=came.get(k);result.push(prev);k=key(prev);}return [from,...result.reverse(),...(seated&&dist(goal,to)<55?[to]:[])];}
   for(const [dx,dy]of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]){const n=[p[0]+dx,p[1]+dy],k=key(n);if(cells.has(k)&&!seen.has(k)&&!blocked.has(k)){seen.add(k);came.set(k,p);open.push(n);}}
  }return [];
 }
 return{route,free,cells,canStep};
}
function create(scene,roster){
 const smokers=new Set(['person-pavel-isaykov','person-javier-garcia-zaballos']);
 const nav=navigation(scene),actors=new Map(),seats=[[225,263],[375,263],[225,500],[375,500],[997,943],[1143,943],[997,1135],[1143,1135],[998,1488],[1142,1488],[998,1670],[1142,1670],[1010,2050],[1170,2050],[1010,2320],[1170,2320]],windowSeats=[[225,1155],[225,1330]];
 let clock=0,serial=0;
 for(const row of roster){const i=serial++,home=row.id==='person-maxim-ilin'?windowSeats[0]:row.id==='person-pavel-isaykov'?windowSeats[1]:row.home;
  actors.set(row.id,{...row,index:i,home:[...home],pos:[...home],mode:'idle',activity:'work',until:2+(i*7)%17,path:[],round:0,variant:[...row.id].reduce((n,c)=>n+c.charCodeAt(0),0)%7,visited:new Set(),seated:row.id==='person-maxim-ilin'||row.id==='person-pavel-isaykov',hidden:false,carry:null});}
 const groups=new Map();for(const a of actors.values())if(a.projectId){if(!groups.has(a.projectId))groups.set(a.projectId,[]);groups.get(a.projectId).push(a.id);}
 const rotations=[...groups.values()].filter(ids=>ids.length>2).map(ids=>{const absent=ids[ids.length-1],a=actors.get(absent);a.mode='offsite';a.hidden=true;return{ids,absent,nextAt:100,turn:0,departing:null,retryAt:0};});
 const visible=except=>[...actors.values()].filter(b=>b!==except&&!b.hidden);
 const walkers=()=>[...actors.values()].filter(b=>b.mode==='walking').length;
 const choices={walk:[[620,920],[470,1190],[650,680],[700,340],[650,2140],[730,2320],[1080,2120]],coffee:[[780,740]],water:[[790,850]],food:[[1020,58]],away:[[1220,500]]};
 const atStation=(kind,except)=>visible(except).some(b=>b.activity===kind&&['walking','idle','departing'].includes(b.mode));
 function go(a,type,target){
  if(a.mode!=='walking'&&walkers()>=MAX_WALKERS)return false;
  const others=visible(a);if(!fitsArea(target,others.map(b=>b.mode==='walking'?b.goal:b.pos)))return false;
  const path=nav.route(a.pos,target,type==='work'||type==='food',others.map(b=>b.pos));if(path.length<2)return false;
  if(type==='work'||type==='food'||type==='smoke')a.carry=null;if(type==='return')a.rotationOut=false;
  a.activity=type;a.visited.add(type==='smoke'?'away':type);if(type==='smoke')a.visited.add('smoke');a.goal=[...target];a.path=path.slice(1);a.mode='walking';a.seated=false;a.hidden=false;a.variant=(a.variant+1)%7;a.started=clock;return true;
 }
 function plan(a){
  if(walkers()>=MAX_WALKERS-1){a.until=clock+7+a.index%5;return;}
  const kind=activities[(a.index+a.round++)%7];
  if(kind==='chat'&&!atStation('chat',a)){
   const partner=visible(a).filter(b=>b.mode==='idle'&&b.activity==='work'&&!b.pinned).sort((b,c)=>dist(a.pos,b.pos)-dist(a.pos,c.pos))[0];
   const hubs=[[620,920],[470,1190],[600,1310],[770,1650],[650,680],[700,340],[700,550]].sort((b,c)=>dist(a.pos,b)-dist(a.pos,c));
   if(partner)for(const hub of hubs){if(!fitsArea(hub,visible(a).map(b=>b.pos)))continue;
    if(go(a,'chat',hub)&&go(partner,'chat',[hub[0]+85,hub[1]])){a.partner=partner.id;partner.partner=a.id;a.until=partner.until=clock+40;return;}
    if(a.activity==='chat')go(a,'return',a.home);
   }
  }
  if(kind==='work'){
   const candidates=a.id==='person-maxim-ilin'?[windowSeats[0]]:a.id==='person-pavel-isaykov'?[windowSeats[1]]:a.id.startsWith('staff-')?seats.slice(4,8):seats.filter((_,i)=>i<4||i>7);
   const preferred=[...candidates].sort((b,c)=>dist(a.home,b)-dist(a.home,c)).find(p=>!visible(a).some(b=>dist(b.pos,p)<50||b.goal&&b.mode==='walking'&&dist(b.goal,p)<50));
   a.targetSeat=preferred||a.home;if(dist(a.pos,a.targetSeat)<10){a.seated=scene.staticLayers.some(c=>c.kind==='chair'&&c.anchor&&dist(a.pos,c.anchor)<12);a.until=clock+22+a.index%15;return;}if(go(a,'work',a.targetSeat))return;
  }else if(kind==='away'&&smokers.has(a.id)){const spot=a.id==='person-pavel-isaykov'?[440,2520]:[840,2520];if(go(a,'smoke',spot))return;
  }else if(choices[kind]&&!atStation(kind,a)){
   const targets=[...choices[kind]].sort((b,c)=>dist(a.home,b)-dist(a.home,c));for(const target of targets)if(go(a,kind,target))return;
  }
  // Busy destinations do not create queues: wait at the current work place.
  a.until=clock+12+a.index%7;
 }
 function step(dt){clock+=dt;
  for(const group of rotations){
   if(clock<group.retryAt)continue;
   if(group.departing){const out=actors.get(group.departing),incoming=actors.get(group.absent);
    if(out.mode==='offsite'&&!visible(incoming).some(b=>dist(b.pos,[1220,500])<60)&&fitsArea([1220,500],visible(incoming).map(b=>b.pos))){incoming.pos=[1220,500];if(go(incoming,'return',incoming.home)){group.absent=out.id;group.departing=null;group.nextAt=clock+100;}else{incoming.hidden=true;group.retryAt=clock+3;}}
   }else if(clock>=group.nextAt){const id=group.ids[group.turn++%group.ids.length],a=actors.get(id);if(id!==group.absent&&!a.hidden&&!a.pinned&&go(a,'rotate-out',[1220,500])){a.rotationOut=true;group.departing=id;}else group.retryAt=clock+5;}
  }
  for(const a of actors.values()){
   if(a.carryUntil&&clock>a.carryUntil)a.carry=null;if(a.pinned||a.mode==='offsite')continue;
   if(a.mode==='departing'){if(clock>a.until){a.mode=a.rotationOut?'offsite':'away';a.hidden=true;a.until=clock+15+a.index%10;}continue;}
   if(a.mode==='away'){if(clock>a.until){a.pos=[1220,500];if(visible(a).some(b=>dist(b.pos,a.pos)<60)||!fitsArea(a.pos,visible(a).map(b=>b.pos))||!go(a,'return',a.home)){a.hidden=true;a.until=clock+4;}}continue;}
   if(a.mode==='walking'){
    let left=dt*(32+(a.index%4)*3);
    while(left>0&&a.path.length){const target=a.path[0],distance=dist(a.pos,target);if(distance<.1){a.path.shift();continue;}const travel=Math.min(left,distance),next=[a.pos[0]+(target[0]-a.pos[0])*travel/distance,a.pos[1]+(target[1]-a.pos[1])*travel/distance],others=visible(a);
     const blocked=!nav.canStep(a.pos,next,(a.activity==='work'||a.activity==='food')&&a.path.length===1)||!fitsArea(next,others.map(b=>b.pos))||others.some(b=>dist(next,b.pos)<45&&dist(next,b.pos)<dist(a.pos,b.pos));
     if(blocked){a.blocked=(a.blocked||0)+dt;if(a.blocked>2&&clock>(a.replanAt||0)){a.replanAt=clock+4;const detour=nav.route(a.pos,a.goal,a.activity==='work'||a.activity==='food',others.map(b=>b.pos));if(detour.length>1){a.path=detour.slice(1);a.blocked=0;}else if(a.blocked>12&&!['away','return','rotate-out'].includes(a.activity)){if(!go(a,'return',a.home)){a.mode='idle';a.activity='walk';a.until=clock+5;} }}break;}
     a.blocked=0;a.facingLeft=(next[0]-a.pos[0])-(next[1]-a.pos[1])<0;a.pos=next;left-=travel;if(travel===distance)a.path.shift();
    }
    if(!a.path.length){const returning=a.activity==='return';if(returning)a.activity='work';a.mode='idle';a.arrived=clock;a.until=clock+(a.activity==='work'?24:a.activity==='chat'?16:a.activity==='smoke'?20:6)+(a.index%15);a.seated=['food','work'].includes(a.activity)&&scene.staticLayers.some(chair=>chair.kind==='chair'&&chair.anchor&&dist(a.pos,chair.anchor)<12);
     if(a.activity==='coffee'||a.activity==='water'){a.carry=a.activity;a.carryUntil=clock+35;}
     if(['away','rotate-out'].includes(a.activity)){a.mode='departing';a.hidden=false;a.until=clock+1;}
     if(a.activity==='chat')a.celebrate=a.variant===0;
    }
   }else if(a.activity==='chat'&&a.partner&&actors.get(a.partner)?.mode==='walking'&&clock<a.started+70){a.until=clock+12;}
   else if(clock>a.until){a.partner=null;a.targetSeat=null;if(a.activity!=='work'){if(!go(a,'return',a.home))a.until=clock+5;}else plan(a);}
  }
 }
 function words(a,lang){if(a.hidden)return '';const partner=actors.get(a.partner);if(a.activity==='chat'&&a.mode==='idle'&&partner?.mode==='idle'&&partner.activity==='chat'&&dist(a.pos,partner.pos)<100)return Math.floor(clock/2+(a.id<a.partner?0:1))%2?'…':'';const list=phrases[a.activity==='rotate-out'?'away':a.activity]?.[lang]||phrases[a.activity]?.en;return list&&clock-(a.mode==='walking'?a.started:a.arrived)<3.8?list[a.variant]:'';}
 return{actors,nav,step,words,get time(){return clock},activities,plan,rotations,limits:{radius:DENSITY_RADIUS,area:AREA_LIMIT,walkers:MAX_WALKERS},fitsArea};
}
window.BirdOfficeLife={create,navigation,activities};
})();
