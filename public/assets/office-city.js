/* Light office visit for the Zagreb city (contract bird-city.v1). No accounts, tasks or uploads here. */
(()=>{'use strict';
const VERSION=1;
const PRODUCTION_PARENTS=['https://zagreb-pomalo-production.up.railway.app'];
const DEV_PARENTS=['http://127.0.0.1:5173','http://localhost:5173'];
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
// The same-origin harness is always allowed; local city origins only on a local BIRD.
const allowed=()=>[location.origin,...PRODUCTION_PARENTS,...(local?DEV_PARENTS:[])];
const LANGS=['en','hr','ru'],APPEARANCES=['woman','man',''];
const TEXT={
 exit:{en:'Back to the city',hr:'Natrag u grad',ru:'Вернуться в город'},
 full:{en:'Open full BIRD',hr:'Otvori cijeli BIRD',ru:'Открыть полный BIRD'},
 visit:{en:'Visit to the BIRD office',hr:'Posjet uredu BIRD',ru:'Визит в офис BIRD'},
 waiting:{en:'Connecting to the city…',hr:'Povezivanje s gradom…',ru:'Подключение к городу…'},
 left:{en:'You left the office.',hr:'Napustili ste ured.',ru:'Вы вышли из офиса.'},
 note:{en:'People here are an animation, not live presence.',hr:'Ljudi ovdje su animacija, a ne stvarna prisutnost.',ru:'Люди здесь — анимация, а не реальное присутствие.'},
};
let state=null;

function isRoute(){const p=location.hash.replace(/^#\/?/,'').split('/');return p[0]==='office'&&p[1]==='city';}
function nonceFromHash(){const n=location.hash.replace(/^#\/?/,'').split('/')[2]||'';return /^[A-Za-z0-9_-]{16,64}$/.test(n)?n:null;}

function send(type,payload={}){
 if(!state?.framed)return;
 const message={type,version:VERSION,visitId:state.visitId,nonce:state.nonce,...payload};
 // Never '*': before the handshake, try each allowed parent origin explicitly.
 for(const origin of state.parentOrigin?[state.parentOrigin]:allowed())window.parent.postMessage(message,origin);
}
const error=code=>send('office.error',{code});

function validEnter(data){
 const keys=new Set(['type','version','visitId','nonce','language','visitor']);
 if(!data||typeof data!=='object'||Object.keys(data).some(k=>!keys.has(k)))return 'MALFORMED';
 if(data.version!==VERSION)return 'VERSION_MISMATCH';
 if(data.nonce!==state.nonce)return 'BAD_NONCE';
 if(typeof data.visitId!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(data.visitId))return 'MALFORMED';
 if(!LANGS.includes(data.language))return 'MALFORMED';
 const v=data.visitor;
 if(v!==undefined){if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['displayName','appearance'].includes(k)))return 'MALFORMED';
  if(v.displayName!==undefined&&(typeof v.displayName!=='string'||v.displayName.length>40||/[<>]/.test(v.displayName)))return 'MALFORMED';
  if(v.appearance!==undefined&&!APPEARANCES.includes(v.appearance))return 'MALFORMED';}
 return null;
}

function onMessage(event){
 if(!state||event.source!==window.parent||!allowed().includes(event.origin))return;
 if(state.parentOrigin&&event.origin!==state.parentOrigin)return;
 const data=event.data;
 if(data?.type==='city.office.enter'){
  if(state.entered){if(data.visitId===state.visitId)send('bird.office.entered');return;}
  const problem=validEnter(data);
  if(problem){window.parent.postMessage({type:'office.error',version:VERSION,visitId:null,nonce:state.nonce,code:problem},event.origin);return;}
  state.parentOrigin=event.origin;state.visitId=data.visitId;state.entered=true;
  state.onLanguage?.(data.language);
  send('bird.office.entered');
  return;
 }
 if(data?.type==='city.office.exit.accepted'&&state.entered&&data.nonce===state.nonce&&data.visitId===state.visitId){state.left=true;state.onExit?.();return;}
 if(data&&typeof data==='object'&&data.type)error('UNKNOWN_TYPE');
}

function start({onLanguage,onExit}){
 const framed=window.parent!==window;
 state={framed,nonce:nonceFromHash(),visitId:null,entered:false,parentOrigin:null,onLanguage,onExit};
 window.addEventListener('message',onMessage);
 if(framed){if(!state.nonce){state.parentOrigin=null;return state;}send('bird.office.ready',{capabilities:['walk','inspect','shortCards','exit']});}
 return state;
}
function stop(){window.removeEventListener('message',onMessage);state=null;}
function requestExit(){if(state?.framed&&state.entered)send('bird.office.exit.request');else location.hash='#/office';}
function openProject(projectId){
 if(!/^[a-z0-9-]{1,80}$/.test(projectId))return;
 if(state?.framed&&state.entered)send('bird.office.project.open',{projectId});
 else window.open(location.origin+'/#/projects/'+encodeURIComponent(projectId),'_blank','noopener');
}
window.BirdCity={isRoute,start,stop,requestExit,openProject,TEXT,get state(){return state;}};
})();
