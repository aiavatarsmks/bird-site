/* Turns a pasted email into a task draft: title, text, language and deadline. Runs in the browser and in tests. */
(function(root){
 const HEADER=/^(from|to|cc|sent|date|od|za|kopija|poslano|datum|от|кому|копия|отправлено|дата)\s*:/i;
 const SUBJECT=/^(subject|predmet|тема)\s*:\s*/i;
 const FORWARD=/^-{2,}\s*(forwarded message|proslijeđena poruka|prosljeđena poruka|пересылаемое сообщение|начало пересылаемого)/i;
 const DUE=/\b(rok|do|deadline|due|until|by|najkasnije)\b|(срок|дедлайн|до)(?![а-яё])/i;
 const MONTHS={
  en:['january','february','march','april','may','june','july','august','september','october','november','december'],
  hr:['siječnja','veljače','ožujka','travnja','svibnja','lipnja','srpnja','kolovoza','rujna','listopada','studenoga','prosinca'],
  hr2:['siječanj','veljača','ožujak','travanj','svibanj','lipanj','srpanj','kolovoz','rujan','listopad','studeni','prosinac'],
  ru:['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
 };
 const month=w=>{w=w.toLowerCase().replace(/\.$/,'');if(w==='studenog')return 10;for(const list of Object.values(MONTHS)){const i=list.findIndex(m=>m===w||(w.length>=3&&m.startsWith(w)));if(i>=0)return i;}return -1;};
 const pad=n=>String(n).padStart(2,'0');

 function language(text){
  if(/[а-яё]/i.test(text))return 'ru';
  if(/[čćžšđ]/i.test(text)||/\b(je|su|za|što|tim|zadatak|molim|pozdrav)\b/i.test(text))return 'hr';
  return 'en';
 }
 // Every date in the text with its position; a missing year means the next such date from now.
 function dates(text,now){
  const found=[];
  const add=(index,y,m,d,rest)=>{
   if(m<0||m>11||d<1||d>31)return;
   let year=y?(y<100?2000+y:y):now.getFullYear();
   const time=/^[^\n\d]{0,8}?(\d{1,2})[:.h](\d{2})?\b/.exec(rest)||/^[^\n\d]{0,8}?\b(?:u|at|в)\s*(\d{1,2})\s*(?:h|ч|sati)?\b/i.exec(rest);
   const hh=time?Math.min(23,Number(time[1])):23,mm=time?Number(time[2]||0):59;
   let at=new Date(year,m,d,hh,mm);
   if(!y&&at<now)at=new Date(year+1,m,d,hh,mm);
   found.push({index,at});
  };
  for(const x of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/g))add(x.index,+x[1],+x[2]-1,+x[3],x[4]?` ${x[4]}:${x[5]}`:text.slice(x.index+x[0].length,x.index+x[0].length+20));
  for(const x of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})?\.?(?!\d)/g))if(!/\d{4}-$/.test(text.slice(Math.max(0,x.index-5),x.index)))add(x.index,x[3]?+x[3]:0,+x[2]-1,+x[1],text.slice(x.index+x[0].length,x.index+x[0].length+20));
  for(const x of text.matchAll(/\b(\d{1,2})\.?\s+([a-zčćžšđа-яё]{3,}\.?)(?:\s+(\d{4}))?/gi)){const m=month(x[2]);if(m>=0)add(x.index,x[3]?+x[3]:0,m,+x[1],text.slice(x.index+x[0].length,x.index+x[0].length+20));}
  for(const x of text.matchAll(/\b([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi)){const m=MONTHS.en.findIndex(n=>n.startsWith(x[1].toLowerCase()));if(m>=0)add(x.index,x[3]?+x[3]:0,m,+x[2],text.slice(x.index+x[0].length,x.index+x[0].length+20));}
  return found.sort((a,b)=>a.index-b.index);
 }
 // The deadline is the first date that follows a word like "rok", "do", "deadline", "срок" on the same line.
 function deadline(text,now){
  const all=dates(text,now);if(!all.length)return null;
  const lineStart=i=>text.lastIndexOf('\n',i)+1;
  const near=all.find(d=>DUE.test(text.slice(Math.max(lineStart(d.index),d.index-40),d.index)));
  const pick=near||(all.length===1?all[0]:null);
  return pick?pick.at:null;
 }
 function parse(raw,now=new Date()){
  const lines=String(raw||'').replace(/\r\n?/g,'\n').split('\n');
  let title='';const body=[];
  for(const line of lines){
   const s=line.trim();
   if(SUBJECT.test(s)){if(!title)title=s.replace(SUBJECT,'').replace(/^((fwd?|re|aw|odg|пересл)\s*:\s*)+/i,'').trim();continue;}
   if(FORWARD.test(s)||HEADER.test(s)||s.startsWith('>'))continue;
   if(s==='--'||s==='-- ')break;
   body.push(line.replace(/\s+$/,''));
  }
  while(body.length&&!body[0].trim())body.shift();
  while(body.length&&!body.at(-1).trim())body.pop();
  if(!title&&body.length&&body[0].length<=120&&body[1]!==undefined&&!body[1].trim()){title=body.shift().trim();while(body.length&&!body[0].trim())body.shift();}
  const instructions=body.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!title)title=(instructions.split('\n')[0]||'').slice(0,80);
  const due=deadline(title+'\n'+instructions,now);
  return {title:title.slice(0,160),instructions,language:language(title+' '+instructions),dueAt:due,dueLocal:due?`${due.getFullYear()}-${pad(due.getMonth()+1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`:''};
 }
 const api={parse};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BirdLetter=api;
})(typeof window!=='undefined'?window:globalThis);
