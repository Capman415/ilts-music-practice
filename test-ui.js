// DOM-level integration only: this does not launch or drive any browser.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {parseHTML}=require(require('path').resolve(__dirname,'../test-tools/node_modules/linkedom'));
const html=fs.readFileSync(__dirname+'/Music-212-Practice-Studio.html','utf8'),store=new Map();let clock=Date.now(),consent=true;
function boot(){
 const {window,document}=parseHTML(html);window.HTMLElement.prototype.pause=function(){};window.HTMLElement.prototype.focus=function(){};
 const jobs=[];const ctx=vm.createContext({window,document,console,Map,Set,Math,JSON,Blob,URL,Date:class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},confirm:()=>consent,setTimeout:()=>{},setInterval:f=>jobs.push(f)});
 window.scrollTo=()=>{};
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('application/json'))vm.runInContext(m[2],ctx);
 return {ctx,document,jobs,run:s=>vm.runInContext(s,ctx),click:id=>{const e=document.getElementById(id);assert(e,'Missing #'+id);e.click();}};
}
(async()=>{
 // Migration: v1 data saved by the 100-question app loads, upgrades, and keeps a pre-migration copy.
 {const legacy=JSON.parse(fs.readFileSync(__dirname+'/legacy-questions-v1.json','utf8'));const t=clock;const v1={schemaVersion:1,bankVersion:'ilts212-original-v1',history:[{id:'a-old-1',mode:'test',ids:legacy.map(q=>q.id),answers:Object.fromEntries(legacy.map(q=>[q.id,q.answer])),flags:[],checked:[],pos:0,startedAt:t-9e6,endAt:null,completedAt:t-8e6}],active:null};store.set('christopher-ilts212-v1',JSON.stringify(v1));
  let m=boot();assert.equal(m.run('state.schemaVersion'),2);assert.equal(m.run('state.history.length'),1);assert.equal(m.run('C.score(state.history[0],BANK).correct'),100);assert(store.get('christopher-ilts212-v1-premigration-v1').includes('ilts212-original-v1'));assert(JSON.parse(store.get('christopher-ilts212-v1')).bankVersion==='ilts212-original-v2');assert(m.document.getElementById('flash').textContent.includes('upgraded'));
  // Next full test must avoid all 100 already-seen legacy items.
  m.click('startTest');m.click('begin');assert.equal(m.run('state.active.ids.filter(id=>+id.slice(1)<=100).length'),0);m.run('state.active=null;save()');
  m=boot();assert(m.document.body.innerHTML.includes('First attempt vs. repeat'));assert(m.document.body.innerHTML.includes('200</strong> questions you have not seen'));store.clear();}
 let b=boot();assert(b.document.getElementById('startTest'));assert.equal(b.run('state.history.length'),0);
 b.document.getElementById('timed').checked=true;b.click('startTest');assert(b.document.getElementById('begin'));assert.equal(b.run('state.active'),null);clock+=60000;b.click('begin');assert.equal(b.run('state.active.endAt-state.active.startedAt'),195*60000);assert.equal(b.run('state.active.pos'),0);assert(!b.document.querySelector('.explanation'));assert(b.document.querySelector('audio source').getAttribute('src').startsWith('data:audio/wav;base64,'));
 const firstId=b.run('state.active.ids[0]');assert.equal(b.run('state.active.ids.length'),100);assert.equal(b.run('new Set(state.active.ids).size'),100);const correct=b.run('byId.get(state.active.ids[0]).answer');const input=b.document.querySelector(`input[name=answer][value="${correct}"]`);input.onchange();assert.equal(b.run('state.active.answers[state.active.ids[0]]'),correct);assert.equal(b.document.getElementById('answeredCount').textContent,'1/100 answered.');assert(!b.document.querySelector('.explanation'));
 b.click('flag');assert.equal(b.run('state.active.flags.length'),1);b.click('next');assert.equal(b.run('state.active.pos'),1);b.click('saveExit');assert(b.document.getElementById('resume'));
 // Reopening uses the persisted answer, flag, current question, and original deadline.
 b=boot();assert(b.document.getElementById('resume'));b.click('resume');assert.equal(b.run('state.active.pos'),1);assert.equal(b.run('state.active.flags[0]'),firstId);assert.equal(b.run('state.active.answers[state.active.ids[0]]'),correct);
 consent=false;b.click('submit');assert.equal(b.run('state.history.length'),0);consent=true;b.click('submit');assert.equal(b.run('state.history.length'),1);assert.equal(b.run('state.active'),null);assert.equal(b.run('C.score(state.history[0],BANK).correct'),1);assert(b.document.getElementById('incorrect'));
 b.click('incorrect');assert(b.document.querySelector('.explanation'));assert(b.run('state.history[0].ids.length')===100);assert(b.document.querySelector('input[name=answer]').disabled);b.click('backResults');b.click('resultHome');
 // Practice gives immediate, locked feedback only after explicit Check.
 const options=b.document.getElementById('objective').querySelectorAll('option');options.forEach(o=>{if(o.value==='0023')o.setAttribute('selected','');else o.removeAttribute('selected');});b.click('startStudy');assert.equal(b.run('state.active.ids.length'),14);assert.equal(b.run('state.active.mode'),'study');assert(!b.document.querySelector('.explanation'));const choice=b.document.querySelector('input[name=answer]');choice.onchange();b.click('check');assert(b.document.querySelector('.explanation'));assert(b.document.querySelector('input[name=answer]').disabled);b.click('submit');assert.equal(b.run('state.history.length'),2);
 // A timed full test auto-submits on the next clock tick after its deadline.
 b.click('resultHome');b.document.getElementById('timed').checked=true;b.click('startTest');b.click('begin');clock+=195*60000+1000;b.jobs[0]();assert.equal(b.run('state.active'),null);assert.equal(b.run('state.history.length'),3);assert(b.document.getElementById('incorrect'));assert(b.document.getElementById('flash').textContent.includes('countdown ended'));
 // Reset and valid backup replacement require confirmation; invalid import is non-destructive.
 b.click('resultHome');consent=false;b.click('reset');assert.equal(b.run('state.history.length'),3);
 const backup=b.run('JSON.stringify(state)');await b.document.getElementById('importFile').onchange({target:{files:[{size:100,text:async()=>'{"bad":true}'}],value:'x'}});assert.equal(b.run('state.history.length'),3);assert(b.document.getElementById('flash').textContent.includes('Import rejected'));
 consent=true;b.click('reset');assert.equal(b.run('state.history.length'),0);await b.document.getElementById('importFile').onchange({target:{files:[{size:backup.length,text:async()=>backup}],value:'x'}});assert.equal(b.run('state.history.length'),3);assert(b.document.getElementById('flash').textContent.includes('imported'));
 console.log('PASS: DOM integration v2 — v1 storage migration + pre-migration copy, unseen-first next form, 100-item random form, tutorial excludes timer, start, answer, flag, navigation, save/exit, storage resume, hidden test explanations, submit confirmation, results/incorrect review, locked study feedback, timer expiry, reset confirmation, invalid and valid import. No browser was launched.');
})().catch(e=>{console.error(e);process.exit(1);});
