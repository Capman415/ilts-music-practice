'use strict';
const PracticeCore=(()=>{
 const VERSION=2, BANK_VERSION='ilts212-original-v2', LEGACY_BANK='ilts212-original-v1', FORM_SIZE=100;
 // Per-objective blueprint for one 100-item form (subareas 22/17/17/22/22), matching the original fixed form.
 const BLUEPRINT={'0001':8,'0002':5,'0003':3,'0004':2,'0005':4,'0006':4,'0007':4,'0008':5,'0009':4,'0010':4,'0011':4,'0012':4,'0013':5,'0014':5,'0015':5,'0016':4,'0017':4,'0018':4,'0019':5,'0020':4,'0021':4,'0022':4,'0023':5};
 function exposure(history){const n=new Map();for(const a of history)for(const id of a.ids)n.set(id,(n.get(id)||0)+1);return n;}
 // Weighted draw without replacement: never-presented items first; if a pool runs short, seen items are drawn with weight 1/(1+times seen)^2.
 function pick(pool,k,seen,rand){
  const unseen=pool.filter(q=>!seen.get(q.id)),old=pool.filter(q=>seen.get(q.id));const out=[];
  const u=unseen.slice();for(let i=u.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[u[i],u[j]]=[u[j],u[i]];}
  out.push(...u.slice(0,k));
  const rest=old.slice();while(out.length<k&&rest.length){const w=rest.map(q=>1/Math.pow(1+seen.get(q.id),2)),t=w.reduce((x,y)=>x+y,0);let r=rand()*t,i=0;while(i<rest.length-1&&(r-=w[i])>0)i++;out.push(rest.splice(i,1)[0]);}
  return out;
 }
 function buildForm(bank,history,rand=Math.random){
  const seen=exposure(history),ids=[];
  for(let area=0;area<5;area++){const chosen=[];
   for(const [obj,k] of Object.entries(BLUEPRINT)){const pool=bank.filter(q=>q.objective===obj&&q.area===area);if(!pool.length)continue;if(pool.length<k)throw Error('Objective '+obj+' has too few items');chosen.push(...pick(pool,k,seen,rand).sort((x,y)=>x.id<y.id?-1:1));}
   // Listening items stay grouped by objective (as in the exam's listening section); other subareas are shuffled.
   if(area>0)for(let i=chosen.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}
   ids.push(...chosen.map(q=>q.id));}
  if(ids.length!==FORM_SIZE)throw Error('Form must contain 100 items');return ids;
 }
 function practiceSet(pool,history,k,rand=Math.random){return pick(pool,Math.min(k,pool.length),exposure(history),rand).map(q=>q.id);}
 // First attempt = the first completed attempt in which an item was presented; later presentations are repeats.
 function split(history,bank){
  const map=new Map(bank.map(q=>[q.id,q])),seen=new Set(),z=()=>({correct:0,answered:0,total:0,objectives:{},areas:{}}),out={first:z(),repeat:z(),perAttempt:{}};
  for(const a of history){const pa={first:{correct:0,total:0},repeat:{correct:0,total:0}};
   for(const id of a.ids){const q=map.get(id);if(!q)continue;const kind=seen.has(id)?'repeat':'first';seen.add(id);
    const answered=Object.prototype.hasOwnProperty.call(a.answers,id),right=answered&&a.answers[id]===q.answer,b=out[kind];
    b.total++;b.answered+=Number(answered);b.correct+=Number(right);pa[kind].total++;pa[kind].correct+=Number(right);
    for(const [g,label] of [['objectives',q.objective],['areas',q.area]]){const s=b[g][label]??={correct:0,answered:0,total:0};s.total++;s.answered+=Number(answered);s.correct+=Number(right);}}
   out.perAttempt[a.id]=pa;}
  out.seenCount=seen.size;return out;
 }
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
  if(!obj(data)||!((data.schemaVersion===VERSION&&data.bankVersion===BANK_VERSION)||(data.schemaVersion===1&&data.bankVersion===LEGACY_BANK)))fail('wrong schema or question-bank version.');
  if(!Array.isArray(data.history)||data.history.length>500)fail('history must contain at most 500 attempts.');
  const known=new Set(bank.map(q=>q.id)), seen=new Set();
  const time=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1e14;
  function attempt(a,active){
   if(!obj(a)||typeof a.id!=='string'||!/^a-[a-zA-Z0-9-]{1,90}$/.test(a.id)||seen.has(a.id))fail('invalid or duplicate attempt ID.');seen.add(a.id);
   if(!['test','study','weak','unseen'].includes(a.mode))fail('invalid mode.');
   if(!Array.isArray(a.ids)||a.ids.length<1||a.ids.length>100||new Set(a.ids).size!==a.ids.length||a.ids.some(id=>!known.has(id)))fail('invalid question IDs.');
   if(a.mode==='test'&&a.ids.length!==FORM_SIZE)fail('a full test must contain 100 questions.');
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
 function isLegacy(data){return !!data&&data.schemaVersion===1&&data.bankVersion===LEGACY_BANK;}
 return {VERSION,BANK_VERSION,LEGACY_BANK,FORM_SIZE,BLUEPRINT,score,aggregate,weak,validate,blank,exposure,buildForm,practiceSet,split,isLegacy};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PracticeCore;
