const fs=require('fs'),assert=require('assert'),vm=require('vm');
const C=require('./core.js'),bank=JSON.parse(fs.readFileSync(__dirname+'/questions.json','utf8'));
const now=Date.now();
function attempt(id='a-test-1'){return {id,mode:'test',ids:bank.map(q=>q.id),answers:Object.fromEntries(bank.map(q=>[q.id,q.answer])),checked:[],flags:[],pos:0,startedAt:now,endAt:null,completedAt:now+1000};}
const perfect=attempt(),p=C.score(perfect,bank);assert.equal(p.correct,100);assert.equal(p.answered,100);assert.equal(p.percent,100);assert.equal(p.proxy,5);assert.equal(p.audio,17);
assert.deepEqual(Object.values(p.areas).map(x=>x.total),[22,17,17,22,22]);assert.equal(Object.keys(p.objectives).length,23);
const mixed=attempt('a-test-2');mixed.answers={};for(let i=0;i<50;i++)mixed.answers[bank[i].id]=i<25?bank[i].answer:(bank[i].answer+1)%4;
const m=C.score(mixed,bank);assert.equal(m.correct,25);assert.equal(m.answered,50);assert.equal(m.total,100);assert.equal(m.percent,25);
const blank=attempt('a-test-3');blank.answers={};assert.equal(C.score(blank,bank).percent,0);
const total=C.aggregate([perfect,mixed,blank],bank);assert.equal(total.correct,125);assert.equal(total.answered,150);assert.equal(total.total,300);
assert(C.weak(total).length>0);assert(C.weak(total).every(o=>total.objectives[o].correct/total.objectives[o].total<.75));
const study={...attempt('a-study-1'),mode:'study',ids:bank.filter(q=>q.objective==='0023').map(q=>q.id),answers:{},checked:[],pos:1};study.answers[study.ids[0]]=bank.find(q=>q.id===study.ids[0]).answer;study.checked=[study.ids[0]];
const active={...attempt('a-active-1'),completedAt:null,pos:37,endAt:now+195*60000};
const data={...C.blank(),active,history:[perfect,mixed,blank,study]};assert.deepEqual(C.validate(JSON.parse(JSON.stringify(data)),bank),data);
assert.equal(C.score(study,bank).total,5);
let invalid=0;function bad(edit){const z=JSON.parse(JSON.stringify(data));edit(z);assert.throws(()=>C.validate(z,bank),/Invalid backup/);invalid++;}
bad(z=>z.schemaVersion=2);bad(z=>z.bankVersion='other');bad(z=>z.history={});bad(z=>z.active.pos=-1);bad(z=>z.active.pos=100);bad(z=>z.active.answers.Q001=4);bad(z=>z.active.answers.Q001='0');bad(z=>z.active.answers.unknown=0);bad(z=>z.active.ids[1]=z.active.ids[0]);bad(z=>z.active.ids[0]='Q999');bad(z=>z.active.ids.pop());bad(z=>z.active.flags=['Q999']);bad(z=>z.active.flags=['Q001','Q001']);bad(z=>z.active.checked=['Q001']);bad(z=>z.active.endAt=now+100);bad(z=>z.active.completedAt=now+1000);bad(z=>z.history[0].completedAt=now-1);bad(z=>z.history[0].id=z.active.id);bad(z=>z.active.mode='other');bad(z=>z.active.startedAt='yesterday');bad(z=>z.history[3].checked=['Q001']);bad(z=>z.history[3].checked=[z.history[3].ids[1]]);bad(z=>delete z.active);bad(z=>z.active.id='<script>');
const sanitized=JSON.parse(JSON.stringify(data));sanitized.history[0].percent=999;sanitized.history[0].extra='<img onerror=evil()>';assert(!Object.hasOwn(C.validate(sanitized,bank).history[0],'extra'));
const html=fs.readFileSync(__dirname+'/Music-212-Practice-Studio.html','utf8');let scriptCount=0;for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(match[1].includes('application/json'))JSON.parse(match[2]);else{new vm.Script(match[2]);scriptCount++;}}assert.equal(scriptCount,2);assert(!/__BANK__|__AUDIO__|__CORE__/.test(html));assert(!/<(?:script|link)[^>]+(?:src|href)=/i.test(html));assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html));
console.log(`PASS: scoring, omissions, all subarea/23 objective rollups, repeat history, practice, resume roundtrip, weak ranking, ${invalid} invalid-backup cases, sanitization, both JavaScript programs parsed, offline static check.`);
