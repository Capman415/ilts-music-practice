const fs=require('fs'),assert=require('assert'),vm=require('vm');
const C=require('./core.js'),bank=JSON.parse(fs.readFileSync(__dirname+'/questions.json','utf8')),legacy=JSON.parse(fs.readFileSync(__dirname+'/legacy-questions-v1.json','utf8'));
const now=Date.now();let seed=7;const rand=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
// Bank structure and legacy stability
assert.equal(bank.length,300);assert.deepEqual(bank.slice(0,100),legacy);
const count=(arr,f)=>arr.reduce((m,x)=>(m[f(x)]=(m[f(x)]||0)+1,m),{});
assert.deepEqual(count(bank,q=>q.area),{0:66,1:51,2:51,3:66,4:66});assert.equal(Object.keys(count(bank,q=>q.objective)).length,23);
assert.deepEqual(count(bank,q=>q.answer),{0:75,1:75,2:75,3:75});assert.equal(new Set(bank.map(q=>q.id)).size,300);assert.equal(new Set(bank.map(q=>q.stem)).size,300);
// Randomized forms follow the blueprint and favor unseen questions
function attemptFrom(ids,id,right=true){return {id,mode:'test',ids,answers:Object.fromEntries(ids.map(i=>{const q=bank.find(x=>x.id===i);return [i,right?q.answer:(q.answer+1)%4];})),checked:[],flags:[],pos:0,startedAt:now,endAt:null,completedAt:now+1000};}
const byId=new Map(bank.map(q=>[q.id,q]));
function checkForm(ids){assert.equal(ids.length,100);assert.equal(new Set(ids).size,100);const qs=ids.map(i=>byId.get(i));
 assert.deepEqual(count(qs,q=>q.area),{0:22,1:17,2:17,3:22,4:22});assert.deepEqual(count(qs,q=>q.objective),C.BLUEPRINT);assert(qs.slice(0,22).every(q=>q.area===0));}
const f1=C.buildForm(bank,[],rand);checkForm(f1);const h1=[attemptFrom(f1,'a-f1')];
const f2=C.buildForm(bank,h1,rand);checkForm(f2);assert.equal(f2.filter(i=>f1.includes(i)).length,0,'second form must be all unseen');
const h2=[...h1,attemptFrom(f2,'a-f2',false)];const f3=C.buildForm(bank,h2,rand);checkForm(f3);
const overlap3=f3.filter(i=>f1.includes(i)||f2.includes(i)).length;const objN=count(bank,q=>q.objective),expectReuse=Object.entries(C.BLUEPRINT).reduce((t,[o,k])=>t+Math.max(0,3*k-objN[o]),0);assert.equal(overlap3,expectReuse,'third form should reuse only where objective pools are exhausted');
const h3=[...h2,attemptFrom(f3,'a-f3')];const f4=C.buildForm(bank,h3,rand);checkForm(f4);
const seen3=C.exposure(h3);assert.equal(seen3.size,300-expectReuse);const unseenIn4=f4.filter(i=>!seen3.get(i)).length;assert.equal(unseenIn4,300-seen3.size);
// Different random draws give different forms
assert.notDeepEqual(C.buildForm(bank,[],()=>0.1),C.buildForm(bank,[],()=>0.9));
// First-attempt vs repeat tracking
const sp=C.split(h3,bank);assert.equal(sp.first.total,seen3.size);assert.equal(sp.repeat.total,300-seen3.size);assert.equal(sp.perAttempt['a-f2'].first.correct,0);assert.equal(sp.perAttempt['a-f1'].first.correct,100);
const again=[...h3,attemptFrom(f1,'a-f1b',false)];const sp2=C.split(again,bank);assert.equal(sp2.perAttempt['a-f1b'].repeat.total,100);assert.equal(sp2.perAttempt['a-f1b'].first.total,0);assert.equal(sp2.repeat.total,sp.repeat.total+100);
// Practice sets prefer unseen items
const pool=bank.filter(q=>q.objective==='0004');const ps=C.practiceSet(pool,h1,8,rand);assert.equal(ps.length,8);
const seen1=C.exposure(h1);const firstUnseen=ps.slice(0,pool.filter(q=>!seen1.get(q.id)).length);assert(firstUnseen.every(i=>!seen1.get(i)));
// Scoring/aggregation unchanged for legacy-style attempts
const legacyIds=legacy.map(q=>q.id),perfect=attemptFrom(legacyIds,'a-test-1'),p=C.score(perfect,bank);assert.equal(p.correct,100);assert.equal(p.proxy,5);assert.equal(p.audio,17);
assert.deepEqual(Object.values(p.areas).map(x=>x.total),[22,17,17,22,22]);
// v1 localStorage / backup migration preserves every attempt and answer
const v1={schemaVersion:1,bankVersion:'ilts212-original-v1',history:[perfect,{...attemptFrom(legacyIds.filter(i=>byId.get(i).objective==='0023'),'a-study-1'),mode:'study',checked:[]}],active:{...attemptFrom(legacyIds,'a-active-1'),answers:{Q001:1},completedAt:null,pos:37,endAt:now+195*60000}};
assert(C.isLegacy(v1));const m=C.validate(JSON.parse(JSON.stringify(v1)),bank);assert.equal(m.schemaVersion,2);assert.equal(m.bankVersion,'ilts212-original-v2');assert.equal(m.history.length,2);assert.deepEqual(m.history[0].answers,perfect.answers);assert.equal(m.active.pos,37);assert.equal(C.score(m.history[0],bank).correct,100);
const v2=C.validate(JSON.parse(JSON.stringify(m)),bank);assert.deepEqual(v2,m);
// Validation rejects malformed data
const data={...C.blank(),history:[attemptFrom(f1,'a-x1')],active:{...attemptFrom(f2,'a-x2'),answers:{},completedAt:null,endAt:now+195*60000}};C.validate(JSON.parse(JSON.stringify(data)),bank);
let invalid=0;function bad(edit){const z=JSON.parse(JSON.stringify(data));edit(z);assert.throws(()=>C.validate(z,bank),/Invalid backup/);invalid++;}
bad(z=>z.schemaVersion=3);bad(z=>z.bankVersion='other');bad(z=>{z.schemaVersion=1;});bad(z=>z.history={});bad(z=>z.active.pos=-1);bad(z=>z.active.pos=100);bad(z=>z.active.answers[z.active.ids[0]]=4);bad(z=>z.active.answers.unknown=0);bad(z=>z.active.ids[1]=z.active.ids[0]);bad(z=>z.active.ids[0]='Q999');bad(z=>z.active.ids.pop());bad(z=>z.active.mode='other');bad(z=>z.active.id='<script>');bad(z=>z.history[0].id=z.active.id);
// Standalone HTML: both scripts parse, no network, all markers replaced, every audio item embedded
const html=fs.readFileSync(__dirname+'/Music-212-Practice-Studio.html','utf8');let scripts=0;for(const mm of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(mm[1].includes('application/json'))JSON.parse(mm[2]);else{new vm.Script(mm[2]);scripts++;}}
assert.equal(scripts,2);assert(!/__BANK__|__AUDIO__|__CORE__|__TITLES__|__TIPS__|__AREAS__/.test(html));assert(!/<(?:script|link)[^>]+(?:src|href)=/i.test(html));assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html));
const media=JSON.parse(html.match(/<script id="audio-data" type="application\/json">(.*?)<\/script>/s)[1]);assert(bank.filter(q=>q.audio).every(q=>media[q.audio]?.startsWith('data:audio/wav;base64,')));
console.log(`PASS core v2: 300-item bank (legacy 100 unchanged), blueprint forms (form 2 fully unseen, form 3 reuse ${overlap3}), weighted unseen-first practice, first/repeat split, v1→v2 migration, ${invalid} invalid-backup cases, HTML static checks.`);
