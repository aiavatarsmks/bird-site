/**
 * Project stage and financing: one ordered stage list for every hub, the funding round types and the checks.
 * Keys never change (they are stored and exported); labels live in assets/account-i18n.js and in STAGE_LABEL below
 * for the server's exports (a test keeps the two equal). Funding is private to the team and the organisers:
 * it is stored in its own columns, never in the published project text.
 */
import {fail} from './http.mjs';

export const STAGES=['idea','prototype','mvp','product','first_customer','revenue','scaling'];
/** Stage keys used before schema 28 (and by the office prototype) and where they land in the shared list. */
export const LEGACY_STAGE={research:'idea',discovery:'idea',pilot:'mvp',launched:'product'};
export const ROUNDS=['none','pre_seed','seed','series_a'];
/** Highest amount a team can enter: one billion euro. Anything above is a typing error. */
export const MAX_EUR=1_000_000_000;

const L=(en,hr,ru)=>({en,hr,ru});
export const STAGE_LABEL={
 idea:L('Idea','Ideja','Идея'),
 prototype:L('Pitch deck / prototype','Prezentacija / prototip','Презентация / прототип'),
 mvp:L('MVP','MVP','MVP'),
 product:L('Working product','Proizvod koji radi','Работающий продукт'),
 first_customer:L('First customer','Prvi kupac','Первый клиент'),
 revenue:L('Regular sales','Redovna prodaja','Регулярные продажи'),
 scaling:L('Scaling','Rast','Масштабирование'),
};
export const ROUND_LABEL={none:L('No round','Bez runde','Без раунда'),pre_seed:L('Pre-seed','Pre-seed','Pre-seed'),seed:L('Seed','Seed','Seed'),series_a:L('Series A+','Serija A+','Серия A+')};

/** A known key as it is, an old key mapped onto the shared list, anything else null. */
export const normalizeStage=s=>STAGES.includes(s)?s:LEGACY_STAGE[s]||null;
/** For stored text: a project always has a stage, idea when nothing usable is there. */
export const stageOf=s=>normalizeStage(s)||'idea';

/** Stage sent by the editor: a key from the list (old keys accepted and mapped); missing gives `fallback`. */
export function cleanStage(input,fallback='idea'){
 if(input===undefined||input===null||input==='')return fallback;
 const s=normalizeStage(String(input));
 if(!s)fail(400,'INVALID_FIELDS',{field:'stage'});
 return s;
}

/** Whole euros, 0 … MAX_EUR; empty means "not stated" (null). */
export function cleanEur(v,field){
 if(v===undefined||v===null||v==='')return null;
 const s=typeof v==='string'?v.trim().replace(/[\s.,'’_](?=\d{3}(\D|$))/g,''):v;
 const n=typeof s==='number'?s:/^\d+$/.test(s)?Number(s):NaN;
 if(!Number.isInteger(n)||n<0||n>MAX_EUR)fail(400,'INVALID_FIELDS',{field});
 return n;
}

/** Financing block of the editor. Every field is optional; the investor switch is off unless sent as true. */
export function cleanFunding(input){
 if(!input||typeof input!=='object')fail(400,'INVALID_FIELDS',{field:'funding'});
 const round=input.round===undefined||input.round===null||input.round===''?null:String(input.round);
 if(round!==null&&!ROUNDS.includes(round))fail(400,'INVALID_FIELDS',{field:'round'});
 return {raisedEur:cleanEur(input.raisedEur,'raisedEur'),raisingEur:cleanEur(input.raisingEur,'raisingEur'),round,investorVisible:input.investorVisible===true||input.investorVisible==='1'||input.investorVisible==='on'};
}

export const fundingOf=p=>({raisedEur:p.raised_eur??null,raisingEur:p.raising_eur??null,round:p.funding_round||null,investorVisible:!!p.investor_visible});

/** One line in the stage history when the stage is new or changed. */
export function recordStage(db,projectId,stage,{previous=null,by=null,source='team',at=new Date().toISOString()}={}){
 if(previous===stage)return false;
 db.query('INSERT INTO project_stage_history(project_id,stage,previous,changed_by,source,changed_at) VALUES(?,?,?,?,?,?)').run(projectId,stage,previous,by,source,at);
 return true;
}
export const stageHistory=(db,projectId,limit=20)=>db.query('SELECT h.stage,h.previous,h.source,h.changed_at,u.display_name FROM project_stage_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.project_id=? ORDER BY h.id DESC LIMIT ?').all(projectId,limit).map(r=>({stage:r.stage,previous:r.previous,source:r.source,changedAt:r.changed_at,by:r.display_name||''}));
/** When the current stage was set (the newest history line), null when there is no history. */
export const stageSince=(db,projectId)=>db.query('SELECT changed_at FROM project_stage_history WHERE project_id=? ORDER BY id DESC LIMIT 1').get(projectId)?.changed_at||null;

/** Filter from the query string: ?stage=idea,mvp&raisedMin=0&raisedMax=50000. Bad values are ignored, not fatal. */
export function teamFilter(params){
 const stages=String(params.get('stage')||'').split(',').map(s=>normalizeStage(s.trim())).filter(Boolean);
 const num=k=>{const v=params.get(k);return v!==null&&/^\d{1,10}$/.test(v.trim())?Number(v):null;};
 return {stages:[...new Set(stages)],raisedMin:num('raisedMin'),raisedMax:num('raisedMax')};
}
/**
 * Teams that match: stage among the chosen ones (none chosen = any), raised amount inside the range.
 * With a range set, a team that has not stated what it raised is left out: unknown is not zero.
 */
export function matchesTeam(t,{stages=[],raisedMin=null,raisedMax=null}={}){
 if(stages.length&&!stages.includes(t.stage))return false;
 if(raisedMin===null&&raisedMax===null)return true;
 const r=t.funding?.raisedEur;
 if(r===null||r===undefined)return false;
 return (raisedMin===null||r>=raisedMin)&&(raisedMax===null||r<=raisedMax);
}
