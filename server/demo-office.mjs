/**
 * The office of a demo workspace: BIRD's drawn characters reused for invented people.
 * Visitors see only the invented ids and names; which drawing stands behind each one stays on the server,
 * and the artwork is served under the invented id so no real name reaches a URL.
 */
import {readFileSync} from 'node:fs';

// Invented person, staff member or mentor → drawing. Chosen so the look matches the invented name.
const CAST={
 'demo-person-greenloop-1':'person-kristina-kratofil','demo-person-greenloop-2':'person-antonio-parunov','demo-person-greenloop-3':'person-nada',
 'demo-person-mednote-1':'person-antonio-kocijan','demo-person-mednote-2':'person-lotus-kattini',
 'demo-person-edunest-1':'person-quynh-tran','demo-person-edunest-2':'person-matej-rene-cihlar','demo-person-edunest-3':'staff-bird-1',
 'demo-person-agrobit-1':'person-tea-madzarac','demo-person-agrobit-2':'person-filip-glavica',
 'demo-person-parkpilot-1':'person-dominik-mandic','demo-person-parkpilot-2':'staff-bird-3',
 'demo-person-tourloop-1':'person-javier-garcia-zaballos','demo-person-tourloop-2':'person-christopher-sawyer-bateman',
 'demo-person-finbuddy-1':'person-karlo-ciciliani','demo-person-finbuddy-2':'person-marko-pavic',
 'demo-person-solarshare-1':'person-antun-matijasec','demo-person-solarshare-2':'person-vedran-odeljan',
 'demo-person-shiftly-1':'person-marko-milardic','demo-person-shiftly-2':'person-filip-ljubotina',
 'demo-staff-1':'staff-bird-4','demo-staff-2':'staff-bird-2','demo-staff-3':'person-tomislav-toplak',
 'demo-mentor-vesna-radic':'mentor-jana-klaric','demo-mentor-goran-peric':'mentor-davor-anicic',
 'demo-mentor-jelena-matic':'mentor-lisa-lines','demo-mentor-boris-lovric':'mentor-nikola-tavic',
};
export const DEMO_STAFF=[
 {id:'demo-staff-1',name:'Mia',role:{en:'Programme manager',hr:'Voditeljica programa',ru:'Руководитель программы'}},
 {id:'demo-staff-2',name:'Tomo',role:{en:'Director',hr:'Direktor',ru:'Директор'}},
 {id:'demo-staff-3',name:'Leon',role:{en:'Community coordinator',hr:'Koordinator zajednice',ru:'Координатор сообщества'}},
];
const GLOBALS=['BIRD_OFFICE_WALK','BIRD_OFFICE_ACTIVITIES','BIRD_OFFICE_SEATED','BIRD_OFFICE_ROUTINES'];

function readGlobals(file){
 const source=readFileSync(file,'utf8'),out={};
 for(const m of source.matchAll(/window\.(\w+)=/g)){
  let depth=0,end=m.index+m[0].length;
  // The values are plain JSON objects; find where each one closes.
  for(let i=end,str=false;i<source.length;i++){const c=source[i];if(str){if(c==='\\')i++;else if(c==='"')str=false;continue;}if(c==='"')str=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){out[m[1]]=JSON.parse(source.slice(end,i+1));break;}}
 }
 return out;
}

/** Builds the office data script and the map from served artwork paths to the real files. */
export function createDemoOffice(publicDir){
 const data={...readGlobals(publicDir+'/assets/office-activity-data.js'),...readGlobals(publicDir+'/assets/office-seated-data.js')};
 const files=new Map(),out=Object.fromEntries(GLOBALS.map(g=>[g,{}]));
 const rename=(value,demo,real)=>JSON.parse(JSON.stringify(value).replaceAll(`assets/${real}-`,`assets/${demo}-`).replaceAll(`assets/${real}.`,`assets/${demo}.`));
 for(const [demo,real] of Object.entries(CAST)){
  for(const g of GLOBALS)if(data[g]?.[real])out[g][demo]=rename(data[g][real],demo,real);
  for(const suffix of ['','-thumb','-walk','-activity','-seated-chair','-lecture','-exercise'])files.set(`/assets/${demo}${suffix}.webp`,`assets/${real}${suffix}.webp`);
 }
 const script=GLOBALS.map(g=>`window.${g}=${JSON.stringify(out[g])};`).join('\n')+`\nwindow.BIRD_OFFICE_CONFIG=${JSON.stringify({staff:DEMO_STAFF,mentors:Object.keys(CAST).filter(id=>id.startsWith('demo-mentor-'))})};\n`;
 return {script,files,has:id=>Boolean(out.BIRD_OFFICE_WALK[id])};
}
