(()=>{
'use strict';
const data=window.BIRD_PROJECT_DATA;
const projectMap=new Map(data.projects.map(p=>[p.id,p])),personMap=new Map(data.people.map(p=>[p.id,p]));
const locale=language=>language==='hr'?'hr':'en';
const label=(p,language)=>p.displayName[locale(language)];
const description=(p,language)=>p.descriptions[locale(language)];
window.BirdProjects=Object.freeze({data,locale,label,description,project:id=>projectMap.get(id),person:id=>personMap.get(id),
 officeProjects(language){return data.projects.map((p,i)=>({id:p.id,teamId:p.teamId,name:label(p,language),description:description(p,language).short,stage:'idea',real:true,color:['#6b886c','#b17957','#708ba5','#967e9c'][i%4],members:p.memberIds.map(id=>{const m=personMap.get(id);return {id:m.id,personId:m.id,teamId:p.teamId,projectId:p.id,name:m.displayName,role:m.roles[p.id]?.[locale(language)]||'',avatar:'neutral'};})}));}
});
})();
