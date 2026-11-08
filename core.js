'use strict';
const PracticeCore=(()=>{
 const VERSION=1, BANK_VERSION='ilts212-original-v1';
 function score(attempt,bank){
  const map=new Map(bank.map(q=>[q.id,q]));
  const out={correct:0,answered:0,total:attempt.ids.length,areas:{},objectives:{},proxy:0,audio:0};
  for(const id of attempt.ids){const q=map.get(id);if(!q)throw Error('Unknown question');
   const answered=Object.prototype.hasOwnProperty.call(attempt.answers,id),right=answered&&attempt.answers[id]===q.answer;
   out.answered+=Number(answered);out.correct+=Number(right);out.proxy+=Number(!!q.proxy);out.audio+=Number(!!q.audio);
   for(const [key,label] of [['areas',q.area],['objectives',q.objective]]){
    const s=out[key][label]??={correct:0,answered:0,total:0};s.total++;s.answered+=Number(answered);s.correct+=Number(right);
   }
  }out.percent=out.total?Math.round(100*out.correct/out.total):0;return out;
 }
 function aggregate(history,bank){
  const out={correct:0,answered:0,total:0,objectives:{},areas:{}};
  for(const a of history){const s=score(a,bank);for(const k of ['correct','answered','total'])out[k]+=s[k];
   for(const group of ['objectives','areas'])for(const [id,v] of Object.entries(s[group])){
    const z=out[group][id]??={correct:0,answered:0,total:0};for(const k of ['correct','answered','total'])z[k]+=v[k];
   }
  }return out;
 }
 function weak(stats){return Object.entries(stats.objectives).filter(([,s])=>s.total&&s.correct/s.total<.75).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)||b[1].total-a[1].total).map(([id])=>id);}
 function validate(data,bank){
  const fail=(s)=>{throw Error('Invalid backup: '+s);};
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(!obj(data)||data.schemaVersion!==VERSION||data.bankVersion!==BANK_VERSION)fail('wrong schema or question-bank version.');
  if(!Array.isArray(data.history)||data.history.length>500)fail('history must contain at most 500 attempts.');
  const known=new Set(bank.map(q=>q.id)), seen=new Set();
  const time=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1e14;
  function attempt(a,active){
   if(!obj(a)||typeof a.id!=='string'||!/^a-[a-zA-Z0-9-]{1,90}$/.test(a.id)||seen.has(a.id))fail('invalid or duplicate attempt ID.');seen.add(a.id);
   if(!['test','study','weak'].includes(a.mode))fail('invalid mode.');
   if(!Array.isArray(a.ids)||a.ids.length<1||a.ids.length>100||new Set(a.ids).size!==a.ids.length||a.ids.some(id=>!known.has(id)))fail('invalid question IDs.');
   if(a.mode==='test'&&(a.ids.length!==100||known.size!==100))fail('a full test must contain all 100 questions.');
   if(!obj(a.answers)||Object.entries(a.answers).some(([id,v])=>!a.ids.includes(id)||!Number.isInteger(v)||v<0||v>3))fail('invalid answer.');
   if(!Array.isArray(a.flags)||new Set(a.flags).size!==a.flags.length||a.flags.some(id=>!a.ids.includes(id)))fail('invalid flags.');
   if(!Array.isArray(a.checked)||new Set(a.checked).size!==a.checked.length||a.checked.some(id=>!a.ids.includes(id)||!Object.hasOwn(a.answers,id))||(a.mode==='test'&&a.checked.length))fail('invalid study feedback state.');
   if(!Number.isInteger(a.pos)||a.pos<0||a.pos>=a.ids.length)fail('invalid position.');
   if(!time(a.startedAt)||(a.endAt!==null&&(!time(a.endAt)||a.mode!=='test'||a.endAt!==a.startedAt+195*60000)))fail('invalid timer.');
   if(active){if(a.completedAt!==null)fail('active attempt marked completed.');}
   else if(!time(a.completedAt)||a.completedAt<a.startedAt)fail('invalid completion time.');
   // Reconstruct only supported fields; never retain executable markup or computed scores from a backup.
   return {id:a.id,mode:a.mode,ids:[...a.ids],answers:{...a.answers},flags:[...a.flags],checked:[...a.checked],pos:a.pos,startedAt:a.startedAt,endAt:a.endAt,completedAt:a.completedAt};
  }
  const history=data.history.map(a=>attempt(a,false));const active=data.active===null?null:attempt(data.active,true);if(active&&history.length>=500)fail('active attempt exceeds the 500-attempt capacity.');
  return {schemaVersion:VERSION,bankVersion:BANK_VERSION,history,active};
 }
 function blank(){return {schemaVersion:VERSION,bankVersion:BANK_VERSION,history:[],active:null};}
 return {VERSION,BANK_VERSION,score,aggregate,weak,validate,blank};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PracticeCore;
