'use strict';
const OFFICE_VERSION=1;
const OFFICE_STORAGE_KEY='bird-office-prototype-v1';
const OFFICE_STAGES=['idea','discovery','prototype','pilot'];
const officeSeed=()=>({version:OFFICE_VERSION,projects:[
 {id:'demo-sprout',name:'Sprout Lab',description:{en:'A fictional team testing ways to make urban gardening easier.',hr:'Izmišljeni tim koji ispituje kako olakšati urbano vrtlarstvo.',ru:'Вымышленная команда изучает, как упростить городское садоводство.'},stage:'discovery',demo:true,color:'#6b886c',members:[{id:'demo-ana',avatar:'woman',name:'Ana',role:'Founder'},{id:'demo-leo',avatar:'man',name:'Leo',role:'Product designer'},{id:'demo-mira',avatar:'woman',name:'Mira',role:'Developer'}],tasks:[],milestones:[],achievements:[]},
 {id:'demo-luma',name:'Luma Studio',description:{en:'A fictional project exploring short lessons for people learning a new language.',hr:'Izmišljeni projekt s kratkim lekcijama za učenje jezika.',ru:'Вымышленный проект с короткими уроками для изучающих новый язык.'},stage:'prototype',demo:true,color:'#b17957',members:[{id:'demo-ivan',avatar:'man',name:'Ivan',role:'Founder'},{id:'demo-sofia',avatar:'woman',name:'Sofia',role:'Developer'}],tasks:[],milestones:[],achievements:[]},
 {id:'demo-north',name:'North Notes',description:{en:'A fictional team building a simple planning tool for small creative teams.',hr:'Izmišljeni tim razvija jednostavan alat za planiranje u malim kreativnim timovima.',ru:'Вымышленная команда делает простой планировщик для небольших творческих команд.'},stage:'idea',demo:true,color:'#708ba5',members:[{id:'demo-noah',avatar:'man',name:'Noah',role:'Founder'},{id:'demo-ema',avatar:'woman',name:'Ema',role:'Researcher'},{id:'demo-luka',avatar:'man',name:'Luka',role:'Developer'},{id:'demo-nika',avatar:'woman',name:'Nika',role:'Designer'}],tasks:[],milestones:[],achievements:[]}
]});
function officeValidateState(value){
 if(!value||value.version!==OFFICE_VERSION||!Array.isArray(value.projects)||value.projects.length>1000)return false;
 const ids=new Set();
 for(const p of value.projects){if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||p.name.length>100||!OFFICE_STAGES.includes(p.stage)||!Array.isArray(p.members)||!p.members.length||p.members.length>40)return false;ids.add(p.id);if(typeof p.description!=='string'&&!(p.description&&['en','hr','ru'].every(l=>typeof p.description[l]==='string')))return false;for(const m of p.members){if(!m||typeof m.id!=='string'||ids.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>80||typeof m.role!=='string'||m.role.length>80||(m.avatar!==undefined&&!['woman','man'].includes(m.avatar)))return false;ids.add(m.id);}}
 return true;
}
class OfficeStore{
 constructor(storage){if(typeof window!=='undefined'&&window.BirdProjects){this.real=true;this.storage=storage;this.warning=null;this.state={version:OFFICE_VERSION,projects:window.BirdProjects.officeProjects('en')};return;}this.storage=storage;this.warning=null;this.state=officeSeed();let raw;try{raw=storage.getItem(OFFICE_STORAGE_KEY);}catch{this.warning='unavailable';return;}if(raw){try{const parsed=JSON.parse(raw);if(officeValidateState(parsed))this.state=parsed;else this.warning='invalid';}catch{this.warning='invalid';}}}
 addProject(input){
 const name=String(input.name||'').trim(),description=String(input.description||'').trim();
 if(!name||name.length>100||!description||description.length>1000||!OFFICE_STAGES.includes(input.stage)||!Array.isArray(input.members)||input.members.length<1||input.members.length>40)throw Error('invalid');
 const members=input.members.map(m=>({id:crypto.randomUUID(),name:String(m.name||'').trim(),role:String(m.role||'').trim(),avatar:m.avatar||'man'}));if(members.some(m=>!m.name||m.name.length>80||!m.role||m.role.length>80||!['woman','man'].includes(m.avatar)))throw Error('invalid');
 const palette=['#6b886c','#b17957','#708ba5','#9c7b9c','#a18b4c'];const project={id:crypto.randomUUID(),name,description,stage:input.stage,members,demo:false,color:palette[this.state.projects.length%palette.length],tasks:[],milestones:[],achievements:[]};
 const next={version:OFFICE_VERSION,projects:[...this.state.projects,project]};if(!officeValidateState(next))throw Error('invalid');
 if(this.warning!=='invalid'){try{this.storage.setItem(OFFICE_STORAGE_KEY,JSON.stringify(next));}catch{this.warning='unavailable';}}
 this.state=next;return project;
 }
 setAvatar(id,avatar){
  if(!['woman','man'].includes(avatar))throw Error('invalid');
  const next=JSON.parse(JSON.stringify(this.state));let found=false;
  for(const p of next.projects)for(const m of p.members)if(m.id===id){m.avatar=avatar;found=true;}
  if(!found)throw Error('invalid');
  if(this.warning!=='invalid')try{this.storage.setItem(OFFICE_STORAGE_KEY,JSON.stringify(next));}catch{this.warning='unavailable';}
  this.state=next;
 }
 project(id){return this.state.projects.find(p=>p.id===id);}
 person(id){for(const project of this.state.projects){const member=project.members.find(m=>m.id===id);if(member)return {member,project};}return null;}
}
/** Replace only this layout function when a real room plan is supplied. */
function officeLayout(projects,narrow=false){
 const columns=narrow?1:2,zoneWidth=440,gap=narrow?0:150,padding=60,worldWidth=narrow?560:1150;
 const slots=[...projects,null];while(slots.length%columns)slots.push(null);
 const zones=[];let y=118;
 for(let offset=0;offset<slots.length;offset+=columns){const row=slots.slice(offset,offset+columns);const height=Math.max(238,...row.map(p=>p?130+Math.ceil(p.members.length/4)*108:238));row.forEach((p,col)=>zones.push({id:p?.id||'free-'+(offset+col),project:p,x:padding+col*(zoneWidth+gap),y,width:zoneWidth,height}));y+=height+46;}
 return {id:narrow?'temporary-single-column-v1':'temporary-two-column-v1',temporary:true,width:worldWidth,height:y+190,zones};
}
