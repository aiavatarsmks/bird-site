/* Ambient office routines. Local visual simulation, never attendance tracking. */
(()=>{'use strict';
const STEP=20,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const DENSITY_RADIUS=175,AREA_LIMIT=3,MAX_WALKERS=5,PRESENT_TARGET=13,MAX_TEAM_ABSENCE=120;
function fitsArea(point,others){if(others.filter(p=>dist(p,point)<DENSITY_RADIUS).length>=AREA_LIMIT)return false;return !others.some(center=>dist(point,center)<DENSITY_RADIUS&&others.filter(p=>dist(p,center)<DENSITY_RADIUS).length>=AREA_LIMIT);}
const activities=['work','walk','chat','coffee','water','food','away','lecture','exercise'];
// Startup small talk, always in English. At most two speech bubbles in the whole office.
const SPEECH_LIMIT=2,LINE_SECONDS=3.2;
const SOLO={
 coffee:['Coffee time!','One more espresso','Need caffeine','Coffee, then pitch deck'],
 water:['Quick water break','Stay hydrated!','Just some water'],
 food:['Lunch time!','Snack break','Anyone hungry?'],
 smoke:['Going for a smoke','Smoke break','Fresh air, back soon'],
 away:['Heading home','See you tomorrow!','Off to a meeting','Back in a bit','Customer call, bye!'],
 arrive:['Hi everyone!','Morning, team!','I\'m back!','What did I miss?'],
 exercise:['Stretch break!','Time for pull-ups','Five more reps'],
 lecture:['Reviewing my notes','Study time','Pricing notes again'],
 work:['Back to work','Deep work mode','Shipping it'],
};
const DIALOGUES=[
 ['Hi! How\'s it going?','Busy week, but good!'],
 ['How did your pitch go?','They asked about pricing.','Classic. Had an answer?','Working on it!'],
 ['Coffee later?','Always.'],
 ['Talked to users this week?','Five interviews!','Any surprises?','They want it simpler.'],
 ['What\'s the MVP doing now?','Onboarding our first pilot.'],
 ['Need help with the deck?','Yes! Slide 3 is a mess.'],
 ['How many users so far?','Twelve. Real ones!','That\'s traction!'],
 ['Pitch practice at five?','Deal. Two minutes max.'],
 ['What\'s your burn rate?','Mostly coffee.','Same here.'],
 ['Hey!','Hey! Good to see you.'],
 ['Read the pricing notes?','Twice. So useful.'],
 ['Any mentor feedback?','Focus on one segment.','Good advice.'],
 ['When do we launch?','Friday. Promise.','Which Friday?'],
 ['Who\'s your first customer?','A clinic in Zagreb.','Nice, local first!'],
 ['Did you ship the update?','Last night. No bugs yet.'],
];
function navigation(scene){
 const desks=scene.staticLayers.filter(x=>x.kind==='desk-top').map(x=>x.footprint),walls=scene.staticLayers.filter(x=>x.kind==='wall'&&x.worldSegment).map(x=>x.worldSegment);
 const chairs=scene.staticLayers.filter(x=>x.kind==='chair').map(x=>x.footprint);
 const lectureBlocks=[];for(let r=0;r<4;r++)for(let c=0;c<5;c++)lectureBlocks.push([335+c*102+18,1380+r*110+40,44,44]);
 const exerciseBlocks=scene.staticLayers.filter(x=>x.kind==='exercise').map(x=>x.footprint);
 const blocks=[...desks,...chairs,...exerciseBlocks,...lectureBlocks,[905,140,340,53],[823,800,46,45],[814,712,58,63],[815,595,62,65]];

 const inside=(x,y)=>scene.rooms.some(r=>x>=r.x+14&&x<=r.x+r.w-14&&y>=r.y+14&&y<=r.y+r.h-14);
 const free=(x,y)=>inside(x,y)&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12);
 // Floor strips share open boundaries; only actual walls block crossings.
 const cells=new Map();for(let x=80;x<=1240;x+=STEP)for(let y=40;y<=2580;y+=STEP){
  const inFloor=scene.rooms.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  if(inFloor&&!blocks.some(([a,b,w,h])=>x>a-10&&x<a+w+10&&y>b-10&&y<b+h+10)&&!walls.some(([a,b,c,d])=>a===c?Math.abs(x-a)<14&&y>Math.min(b,d)-12&&y<Math.max(b,d)+12:Math.abs(y-b)<14&&x>Math.min(a,c)-12&&x<Math.max(a,c)+12))cells.set(x+','+y,[x,y]);
 }
 const within=(p,r)=>p[0]>r[0]-10&&p[0]<r[0]+r[2]+10&&p[1]>r[1]-10&&p[1]<r[1]+r[3]+10;
 const wallHit=p=>walls.some(([a,b,c,d])=>a===c?Math.abs(p[0]-a)<14&&p[1]>Math.min(b,d)-12&&p[1]<Math.max(b,d)+12:Math.abs(p[1]-b)<14&&p[0]>Math.min(a,c)-12&&p[0]<Math.max(a,c)+12);
 const canStep=(from,to,seated=false)=>!(!wallHit(from)&&wallHit(to))&&!blocks.some(r=>within(to,r)&&!within(from,r)&&!(seated&&(chairs.includes(r)||lectureBlocks.includes(r)||exerciseBlocks.includes(r))));
 const nearest=(p,blocked=new Set())=>[...cells.values()].filter(v=>!blocked.has(v.join(','))).reduce((a,b)=>dist(a,p)<dist(b,p)?a:b);
 function route(from,to,seated=false,avoid=[]){
  const key=p=>p.join(','),blocked=new Set();
  for(const other of avoid)for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){const p=[Math.round(other[0]/STEP)*STEP+dx*STEP,Math.round(other[1]/STEP)*STEP+dy*STEP];if(dist(p,other)<45)blocked.add(key(p));}
  if(avoid.length){const saturated=avoid.filter(p=>avoid.filter(q=>dist(p,q)<DENSITY_RADIUS).length>=AREA_LIMIT);for(const p of cells.values())if(avoid.filter(q=>dist(p,q)<DENSITY_RADIUS).length>=AREA_LIMIT||saturated.some(q=>dist(p,q)<DENSITY_RADIUS))blocked.add(key(p));}
  const start=nearest(from,blocked),goal=nearest(to);if(blocked.has(key(goal)))return [];
  const open=[start],came=new Map(),seen=new Set([key(start)]);
  for(let i=0;i<open.length;i++){
   const p=open[i];if(key(p)===key(goal)){const result=[p];let k=key(p);while(came.has(k)){const prev=came.get(k);result.push(prev);k=key(prev);}return [from,...result.reverse(),...(seated&&dist(goal,to)<120?[to]:[])];}
   for(const [dx,dy]of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]){const n=[p[0]+dx,p[1]+dy],k=key(n);if(cells.has(k)&&!seen.has(k)&&!blocked.has(k)){seen.add(k);came.set(k,p);open.push(n);}}
  }return [];
 }
 return{route,free,cells,canStep};
}
// Mentors are visitors: one at a time, roughly every ten minutes, a short stay near the teams.
const MENTOR_EVERY=600,MENTOR_STAY=150,MENTOR_SPOTS=[[620,920],[470,1190],[650,680]];
const MENTOR_LINES=['Hi team! How is the pitch going?','Who wants quick feedback?','Talk to five customers this week!','Great progress, folks!','Book my office hours if you need help.','What is your biggest blocker?'];
function create(scene,roster,options={}){
 const smokers=new Set(['person-pavel-isaykov','person-javier-garcia-zaballos']);
 const nav=navigation(scene),actors=new Map(),seats=[[225,263],[375,263],[225,500],[375,500],[997,943],[1143,943],[997,1135],[1143,1135],[998,1488],[1142,1488],[998,1670],[1142,1670],[1010,2050],[1170,2050],[1010,2320],[1170,2320]],windowSeats=[[225,1155],[225,1330]];
 const lectureIds=['person-karlo-ciciliani','person-antonio-kocijan','person-marko-milardic','person-nada','person-christopher-sawyer-bateman','person-kristina-kratofil','person-quynh-tran','person-lotus-kattini'];
 const lectureSeats=[[0,0],[0,2],[0,4],[3,0],[3,2],[3,4],[1,1],[1,3]].map(([r,c])=>[375+c*102,1454+r*110]);
 const exerciseIds=new Set(['person-antun-matijasec','person-filip-glavica']);
 const workSeats=seats.filter((_,i)=>i<4||i>7),allocated=[];
 let clock=0,serial=0;
 for(const row of roster){const i=serial++;let home=row.id==='person-maxim-ilin'?windowSeats[0]:row.id==='person-pavel-isaykov'?windowSeats[1]:row.id.startsWith('staff-')?seats[4+Number(row.id.slice(-1))-1]:lectureIds.includes(row.id)?lectureSeats[lectureIds.indexOf(row.id)]:workSeats.find(p=>!allocated.includes(p))||row.home;
  allocated.push(home);
  actors.set(row.id,{...row,index:i,home:[...home],pos:[...home],mode:'idle',activity:'work',until:2+(i*7)%17,path:[],round:0,variant:[...row.id].reduce((n,c)=>n+c.charCodeAt(0),0)%7,visited:new Set(),seated:true,hidden:false,carry:null});}
 const groups=new Map();for(const a of actors.values())if(a.projectId){if(!groups.has(a.projectId))groups.set(a.projectId,[]);groups.get(a.projectId).push(a.id);}
 // Participant presence: a fixed number are in the office, the rest are
 // outside. People swap through the lift; no team stays empty for long.
 const LIFT=[1220,500],participants=[...actors.values()].filter(a=>!a.id.startsWith('staff-'));
 const presence={target:Math.min(options.present??PRESENT_TARGET,participants.length),maxTeamAbsence:options.maxTeamAbsence??MAX_TEAM_ABSENCE,nextAt:20,swaps:[],absentSince:new Map(),turn:0};
 {const inside=new Set(['person-maxim-ilin','person-pavel-isaykov','person-antun-matijasec','person-javier-garcia-zaballos'].filter(id=>actors.has(id)));
  for(const ids of groups.values())if(!ids.some(id=>inside.has(id)))inside.add(ids[0]);
  for(const a of participants)if(inside.size<presence.target)inside.add(a.id);
  for(const a of participants){a.enteredAt=0;a.offSince=-30-a.index;if(!inside.has(a.id)){a.mode='offsite';a.hidden=true;}}}
 // Start with varied, useful occupations already spread across the floor.
 const gymActor=actors.get('person-antun-matijasec');if(gymActor){gymActor.pos=[260,2240];gymActor.activity='exercise';gymActor.seated=false;gymActor.arrived=0;gymActor.until=22;gymActor.visited.add('exercise');}
 const outsideActor=actors.get('person-javier-garcia-zaballos');if(outsideActor){outsideActor.pos=[840,2520];outsideActor.activity='smoke';outsideActor.seated=false;outsideActor.arrived=0;outsideActor.until=24;outsideActor.visited.add('smoke');outsideActor.visited.add('away');}
 // The whole BIRD team works in its office at the same time (owner's choice, 5 Nov); no shifts.
 const random=options.random||Math.random,staffIds=[...actors.keys()].filter(id=>id.startsWith('staff-'));
 const staffShift={active:staffIds[0],index:0,nextAt:Infinity,departing:false};
 const mentorIds=(options.mentors||[]).map(m=>m.id).filter(id=>!actors.has(id));
 for(const id of mentorIds)actors.set(id,{id,mentor:true,index:serial++,home:[...LIFT],pos:[...LIFT],mode:'offsite',activity:'mentor',until:Infinity,path:[],round:0,variant:0,visited:new Set(),seated:false,hidden:true,carry:null});
 const mentorVisit={active:null,last:null,nextAt:options.firstMentorAt??150,stayUntil:0,line:0,lineAt:0};
 const visible=except=>[...actors.values()].filter(b=>b!==except&&!b.hidden);
 // BIRD staff have right of way: they never count against the walker limit and others step around them.
 const isStaff=a=>a.id.startsWith('staff-');
 const walkers=()=>[...actors.values()].filter(b=>b.mode==='walking'&&!isStaff(b)).length;
 const speech={lines:new Map(),events:[],dialogue:null,nextAt:6,turn:0,used:new Set()};
 const say=(a,text)=>speech.lines.set(a.id,{text,until:clock+LINE_SECONDS});
 const note=(a,kind)=>{if(SOLO[kind])speech.events.push({id:a.id,kind,at:clock});if(speech.events.length>20)speech.events.shift();};
 function updateSpeech(){
  for(const [id,l] of speech.lines)if(clock>l.until||actors.get(id).hidden)speech.lines.delete(id);
  const d=speech.dialogue;
  if(d){const a=actors.get(d.ids[d.line%2]),b=actors.get(d.ids[1-d.line%2]);
   const together=a.activity==='chat'&&b.activity==='chat'&&a.mode==='idle'&&b.mode==='idle'&&dist(a.pos,b.pos)<130;
   if(!together||d.line>=d.script.length){if(together&&d.line>=d.script.length&&clock>=d.nextAt-.4){a.heartAt=b.heartAt=clock;}speech.dialogue=null;}
   else if(clock>=d.nextAt&&!speech.lines.has(b.id)&&speech.lines.size<SPEECH_LIMIT){say(a,d.script[d.line]);d.line++;d.nextAt=clock+LINE_SECONDS+.4;}
  }
  if(clock<speech.nextAt||speech.lines.size>=SPEECH_LIMIT)return;
  speech.nextAt=clock+4+(speech.turn++*7)%6;
  // A fresh pair at a chat spot may start a dialogue; other pairs talk silently.
  if(!speech.dialogue&&speech.turn%2){
   const pair=[...actors.values()].find(a=>a.activity==='chat'&&a.mode==='idle'&&!a.hidden&&a.partner&&actors.get(a.partner)?.mode==='idle'&&actors.get(a.partner).activity==='chat'&&dist(a.pos,actors.get(a.partner).pos)<130&&!speech.used.has(a.id+a.partner));
   if(pair){speech.used.add(pair.id+pair.partner);speech.used.add(pair.partner+pair.id);const script=DIALOGUES[(speech.count=(speech.count||0)+1)*7%DIALOGUES.length];speech.dialogue={ids:[pair.id,pair.partner],script,line:0,nextAt:clock};return;}
  }
  const event=speech.events.filter(e=>clock-e.at<2.5&&!speech.lines.has(e.id)&&!actors.get(e.id).hidden).pop();
  if(event){speech.events=speech.events.filter(e=>e!==event);const list=SOLO[event.kind];say(actors.get(event.id),list[(speech.turn+actors.get(event.id).index)%list.length]);}
 }
 const choices={walk:[[620,920],[470,1190],[650,680],[700,340],[650,2140],[730,2320],[1080,2120]],coffee:[[780,740]],water:[[790,850]],food:[[1020,58]]};
 const atStation=(kind,except)=>visible(except).some(b=>b.activity===kind&&['walking','idle','departing'].includes(b.mode));
 function go(a,type,target){
  if(!isStaff(a)&&a.mode!=='walking'&&walkers()>=MAX_WALKERS)return false;
  const others=visible(a);if(!fitsArea(target,others.map(b=>b.mode==='walking'?b.goal:b.pos)))return false;
  const path=nav.route(a.pos,target,['work','food','return','lecture','exercise','staff-in'].includes(type),others.map(b=>b.pos));if(path.length<2)return false;
  if(['work','food','return','lecture','exercise','staff-in'].includes(type)||type==='smoke')a.carry=null;if(type==='return')a.rotationOut=false;
  note(a,type==='staff-out'||type==='rotate-out'?'away':type);
  a.activity=type;a.visited.add(type==='smoke'?'away':type);if(type==='smoke')a.visited.add('smoke');a.goal=[...target];a.path=path.slice(1);a.mode='walking';a.seated=false;a.hidden=false;a.variant=(a.variant+1)%7;a.started=clock;return true;
 }
 function plan(a){
  if(!isStaff(a)&&walkers()>=MAX_WALKERS-1){a.until=clock+7+a.index%5;return;}
  // BIRD staff never leave: at least two stay at their desks, the others sometimes get coffee, water or stretch their legs.
  if(a.id.startsWith('staff-')){
   const roaming=staffIds.filter(id=>id!==a.id&&(actors.get(id).activity!=='work'||actors.get(id).mode==='walking')).length;
   const kind=['work','coffee','work','water','work','walk','work','chat'][(a.index+a.round++)%8];
   if(roaming<staffIds.length-2&&kind!=='work'){
    if(kind==='chat'){const hubs=[[620,920],[650,680],[700,550]].sort((b,c)=>dist(a.pos,b)-dist(a.pos,c));for(const hub of hubs)if(go(a,'staff-break',hub)){a.until=clock+25;return;}}
    else if(!atStation(kind,a)){const targets=[...choices[kind]].sort((b,c)=>dist(a.home,b)-dist(a.home,c));for(const target of targets)if(go(a,kind,target))return;}
   }
   a.until=clock+18+a.index%14;return;
  }
  if(a.mentor){a.until=clock+20;return;}
  const schedule=exerciseIds.has(a.id)?['work','exercise','coffee','work','water','walk','food','chat','away']:lectureIds.includes(a.id)?['work','coffee','lecture','water','work','chat','food','away']:['work','coffee','water','work','chat','food','walk','away'];
  const next=schedule[(a.index+a.round++)%schedule.length],kind=smokers.has(a.id)&&!a.visited.has('smoke')?'away':exerciseIds.has(a.id)&&!a.visited.has('exercise')?'exercise':next;
  if(kind==='exercise'&&!atStation('exercise',a)&&go(a,'exercise',[260,2240]))return;
  if(kind==='lecture'&&lectureIds.includes(a.id)){const p=lectureSeats[lectureIds.indexOf(a.id)];if(go(a,'lecture',p))return;}

  if(kind==='chat'&&!atStation('chat',a)){
   const partner=visible(a).filter(b=>b.mode==='idle'&&b.activity==='work'&&!b.pinned).sort((b,c)=>dist(a.pos,b.pos)-dist(a.pos,c.pos))[0];
   const hubs=[[620,920],[470,1190],[600,1310],[770,1650],[650,680],[700,340],[700,550]].sort((b,c)=>dist(a.pos,b)-dist(a.pos,c));
   if(partner)for(const hub of hubs){if(!fitsArea(hub,visible(a).map(b=>b.pos)))continue;
    if(go(a,'chat',hub)&&go(partner,'chat',[hub[0]+85,hub[1]])){a.partner=partner.id;partner.partner=a.id;a.until=partner.until=clock+40;return;}
    if(a.activity==='chat')go(a,'return',a.home);
   }
  }
  if(kind==='work'){
   const preferred=a.home;
   a.targetSeat=preferred||a.home;if(dist(a.pos,a.targetSeat)<10){a.seated=scene.staticLayers.some(c=>['chair','lecture'].includes(c.kind)&&c.anchor&&dist(a.pos,c.anchor)<12);a.until=clock+22+a.index%15;return;}if(go(a,'work',a.targetSeat))return;
  }else if(kind==='away'&&smokers.has(a.id)){const spot=a.id==='person-pavel-isaykov'?[440,2520]:[840,2520];if(go(a,'smoke',spot))return;
  }else if(kind==='away'){a.wantsOut=true;
  }else if(choices[kind]&&!atStation(kind,a)){
   const targets=[...choices[kind]].sort((b,c)=>dist(a.home,b)-dist(a.home,c));for(const target of targets)if(go(a,kind,target))return;
  }
  // Busy destinations do not create queues: wait at the current work place.
  a.until=clock+12+a.index%7;
 }

 const inOffice=a=>a.mode!=='offsite';
 const team=a=>groups.get(a.projectId)||[a.id];
 const teamPresent=a=>team(a).filter(id=>inOffice(actors.get(id))).length;
 function arrive(a){a.pos=[...LIFT];a.hidden=false;a.enteredAt=clock;a.wantsOut=false;note(a,'arrive');if(!go(a,'return',a.home)){a.mode='idle';a.activity='return';a.seated=false;a.until=clock+2;}}
 function startSwap(forced){
  const absent=[...presence.absentSince.entries()].sort((x,y)=>x[1]-y[1]).map(([id])=>id),reserved=new Set(presence.swaps.map(w=>w.in));
  const count=participants.filter(inOffice).length+presence.swaps.filter(w=>w.in&&!w.out).length;
  const pool=participants.filter(a=>a.mode==='offsite'&&!reserved.has(a.id)&&(clock-a.offSince>=30||absent.includes(a.projectId)));
  // Nobody waits outside for ever: after three minutes a person goes to the front of the queue.
  const long=a=>clock-a.offSince>180?0:1;
  pool.sort((x,y)=>(absent.includes(x.projectId)?absent.indexOf(x.projectId):99)-(absent.includes(y.projectId)?absent.indexOf(y.projectId):99)||long(x)-long(y)||teamPresent(x)-teamPresent(y)||x.offSince-y.offSince||(x.index+presence.turn)%7-(y.index+presence.turn)%7);
  const incoming=forced||pool[0];
  // An overdue team cannot wait for the ideal candidate: anyone settled enough may make room.
  const leaving=participants.filter(a=>inOffice(a)&&!a.hidden&&!a.pinned&&(forced?a.mode==='idle'||a.mode==='walking'&&!['away','rotate-out','return'].includes(a.activity):a.mode==='idle'&&!a.partner&&clock-a.enteredAt>40)&&!presence.swaps.some(w=>w.out===a.id)&&(incoming&&a.projectId===incoming.projectId?true:teamPresent(a)>1));
  leaving.sort((x,y)=>Number(!!y.wantsOut)-Number(!!x.wantsOut)||teamPresent(y)-teamPresent(x)||x.enteredAt-y.enteredAt||(x.index+presence.turn)%5-(y.index+presence.turn)%5);
  presence.turn++;
  if(count<presence.target&&incoming){arrive(incoming);return true;}
  if(count>presence.target){for(const a of leaving)if(go(a,'away',LIFT)){a.rotationOut=true;presence.swaps.push({out:a.id,in:null,at:clock});return true;}return false;}
  if(!incoming)return false;
  for(const a of leaving)if(go(a,'away',LIFT)){a.rotationOut=true;presence.swaps.push({out:a.id,in:incoming.id,at:clock});return true;}
  return false;
 }
 function updatePresence(){
  for(const ids of groups.values()){const pid=actors.get(ids[0]).projectId,here=ids.some(id=>inOffice(actors.get(id)));if(here)presence.absentSince.delete(pid);else if(!presence.absentSince.has(pid))presence.absentSince.set(pid,clock);}
  for(const swap of [...presence.swaps]){const out=actors.get(swap.out);
   if(out.mode==='offsite'){out.offSince=clock;out.wantsOut=false;presence.swaps.splice(presence.swaps.indexOf(swap),1);if(swap.in)arrive(actors.get(swap.in));}
   else if(out.activity!=='away'||clock-swap.at>90){out.rotationOut=false;presence.swaps.splice(presence.swaps.indexOf(swap),1);if(out.activity==='away'&&!go(out,'return',out.home)){out.mode='idle';out.until=clock+3;}}
  }
  const waiting=[...presence.absentSince.entries()].filter(([pid,since])=>!presence.swaps.some(w=>w.in&&actors.get(w.in).projectId===pid));
  const overdue=waiting.find(([,since])=>clock-since>presence.maxTeamAbsence-60);
  // An overdue team takes the next free place: it replaces a waiting arrival or starts a swap, so the count never goes over.
  if(overdue){const a=participants.find(b=>b.projectId===overdue[0]&&b.mode==='offsite');if(a){
   const pending=presence.swaps.find(w=>w.in&&actors.get(w.in).projectId!==overdue[0]);
   if(participants.filter(inOffice).length<presence.target)arrive(a);
   else if(pending)pending.in=a.id;
   else if(!presence.swaps.some(w=>w.in)&&startSwap(a))presence.nextAt=clock+16;
  }}
  const urgent=waiting.some(([,since])=>clock-since>35);
  if(presence.swaps.length<2&&(clock>=presence.nextAt||urgent&&presence.swaps.length<1||participants.filter(inOffice).length>presence.target&&!presence.swaps.length)){
   if(startSwap())presence.nextAt=clock+16+(presence.turn*7)%14;else presence.nextAt=clock+4;
  }
 }
 function updateMentor(){
  const id=mentorVisit.active,a=id&&actors.get(id);
  if(!a){
   if(!mentorIds.length||clock<mentorVisit.nextAt)return;
   const pool=mentorIds.filter(x=>x!==mentorVisit.last),pick=actors.get(pool[Math.floor(random()*pool.length)]);
   pick.pos=[...LIFT];pick.hidden=false;pick.mode='idle';pick.rotationOut=false;
   if(go(pick,'mentor-visit',MENTOR_SPOTS[Math.floor(random()*MENTOR_SPOTS.length)])){mentorVisit.active=pick.id;mentorVisit.stayUntil=Infinity;mentorVisit.lineAt=clock+3;}
   else{pick.hidden=true;pick.mode='offsite';mentorVisit.nextAt=clock+5;}
   return;
  }
  if(a.mode==='offsite'){mentorVisit.last=a.id;mentorVisit.active=null;mentorVisit.nextAt=clock+MENTOR_EVERY;return;}
  if(a.activity==='mentor-visit'&&a.mode==='idle'){
   if(mentorVisit.stayUntil===Infinity)mentorVisit.stayUntil=clock+MENTOR_STAY;
   if(clock>=mentorVisit.lineAt&&speech.lines.size<SPEECH_LIMIT){say(a,MENTOR_LINES[mentorVisit.line++%MENTOR_LINES.length]);mentorVisit.lineAt=clock+18;}
   if(clock>=mentorVisit.stayUntil&&go(a,'staff-out',LIFT))a.rotationOut=true;
  }
 }
 function step(dt){clock+=dt;
  const staff=actors.get(staffShift.active);
  if(staff&&staffShift.departing&&staff.mode==='offsite'){
   const next=actors.get(staffIds[(staffShift.index+1)%staffIds.length]);
   if(fitsArea([1220,500],visible(next).map(b=>b.pos))&&!visible(next).some(b=>dist(b.pos,[1220,500])<60)){
    next.pos=[1220,500];if(go(next,'staff-in',next.home)){staffShift.index=(staffShift.index+1)%staffIds.length;staffShift.active=next.id;staffShift.departing=false;staffShift.nextAt=Infinity;}
   }
  }else if(staff&&staffShift.departing&&staff.mode!=='departing'&&staff.activity!=='staff-out'){staffShift.departing=false;staffShift.nextAt=clock+10;
  }else if(staff&&!staffShift.departing&&clock>=staffShift.nextAt&&!staff.pinned&&go(staff,'staff-out',[1220,500])){staff.rotationOut=true;staffShift.departing=true;}

  for(const a of actors.values()){
   if(a.carryUntil&&clock>a.carryUntil)a.carry=null;if(a.pinned||a.mode==='offsite')continue;
   if(a.mode==='departing'){if(clock>a.until){a.mode=a.rotationOut?'offsite':'away';a.hidden=true;a.until=clock+15+a.index%10;}continue;}
   if(a.mode==='away'){if(clock>a.until){a.pos=[1220,500];if(visible(a).some(b=>dist(b.pos,a.pos)<60)||!fitsArea(a.pos,visible(a).map(b=>b.pos))||!go(a,'return',a.home)){a.hidden=true;a.until=clock+4;}}continue;}
   if(a.mode==='walking'){
    a.moving=false;let left=dt*(54+(a.index%4)*3);
    while(left>0&&a.path.length){const target=a.path[0],distance=dist(a.pos,target);if(distance<.1){a.path.shift();continue;}const travel=Math.min(left,distance),next=[a.pos[0]+(target[0]-a.pos[0])*travel/distance,a.pos[1]+(target[1]-a.pos[1])*travel/distance],others=visible(a);
     const blocked=!nav.canStep(a.pos,next,(['work','food','return','lecture','exercise','staff-in'].includes(a.activity))&&a.path.length===1)||!fitsArea(next,others.map(b=>b.pos))||!isStaff(a)&&others.some(b=>dist(next,b.pos)<45&&dist(next,b.pos)<dist(a.pos,b.pos));
     if(blocked){a.blocked=(a.blocked||0)+dt;if(a.blocked>2&&clock>(a.replanAt||0)){a.replanAt=clock+4;const detour=nav.route(a.pos,a.goal,['work','food','return','lecture','exercise','staff-in'].includes(a.activity),others.map(b=>b.pos));if(detour.length>1){a.path=detour.slice(1);a.blocked=0;}else if(a.blocked>12&&!['away','return','rotate-out','staff-out','mentor-visit'].includes(a.activity)){if(!go(a,'return',a.home)){a.mode='idle';a.activity='walk';a.until=clock+5;} }}break;}
     a.blocked=0;a.moving=true;a.walkDistance=(a.walkDistance||0)+travel;a.walkBack=(next[0]+next[1])<(a.pos[0]+a.pos[1]);a.facingLeft=(next[0]-a.pos[0])-(next[1]-a.pos[1])<0;a.pos=next;left-=travel;if(travel===distance)a.path.shift();
    }
    if(!a.path.length){const returning=a.activity==='return'||a.activity==='staff-in';if(returning)a.activity='work';a.mode='idle';a.arrived=clock;a.until=clock+(a.activity==='work'?26:a.activity==='lecture'?30:a.activity==='exercise'?18:a.activity==='chat'?16:a.activity==='smoke'?20:6)+(a.index%15);a.seated=['food','work','lecture'].includes(a.activity)&&scene.staticLayers.some(chair=>['chair','lecture'].includes(chair.kind)&&chair.anchor&&dist(a.pos,chair.anchor)<12);
     if(a.activity==='coffee'||a.activity==='water'){a.carry=a.activity;a.carryUntil=clock+35;}
     if(['away','rotate-out','staff-out'].includes(a.activity)){a.mode='departing';a.hidden=false;a.until=clock+1;}
     if(a.activity==='chat')a.celebrate=a.variant===0;
    }
   }else if(a.activity==='chat'&&a.partner&&actors.get(a.partner)?.mode==='walking'&&clock<a.started+70){a.until=clock+12;}
   else if(clock>a.until){if(a.mentor){a.until=clock+20;continue;}a.partner=null;a.targetSeat=null;if(a.activity!=='work'){if(!go(a,'return',a.home))a.until=clock+5;}else plan(a);}
  }
  updatePresence();updateMentor();
  updateSpeech();
 }
 function words(a){return a.hidden?'':speech.lines.get(a.id)?.text||'';}
 return{actors,nav,step,words,get time(){return clock},activities,plan,presence,speech,staffShift,mentorVisit,limits:{radius:DENSITY_RADIUS,area:AREA_LIMIT,walkers:MAX_WALKERS},fitsArea};
}
window.BirdOfficeLife={create,navigation,activities};
})();
