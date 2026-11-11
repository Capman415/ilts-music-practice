"""Shared helpers for the v2 (300-item) bank: authoring-format normalization,
answer-position assignment, original numerical audio synthesis, and validation."""
from pathlib import Path
import json, random, collections, wave
import numpy as np
ROOT = Path(__file__).resolve().parent
SR = 16000
OBJ_TARGET_NEW = {1:14,2:10,3:7,4:6,5:7, 6:9,7:8,8:9,9:8, 10:9,11:8,12:8,13:9,
                  14:10,15:9,16:9,17:8,18:8, 19:9,20:9,21:9,22:8,23:9}
assert sum(OBJ_TARGET_NEW.values()) == 200
def area(o): return 0 if o<=5 else 1 if o<=9 else 2 if o<=13 else 3 if o<=18 else 4
TIMBRES = {  # harmonic amplitude profiles; fundamentals stay dominant for verification
    'soft':[1,.18,.06], 'bright':[1,.45,.28,.16,.09], 'reedy':[1,.08,.38,.05,.2],
    'organ':[1,.5,.0,.25,.0,.12]}

def render(name, events, timbre='soft', outdir=None):
    end = max(e['start']+e['duration'] for e in events)+.35
    y = np.zeros(int((end+.08)*SR))
    prof = TIMBRES[timbre]
    for e in events:
        dur=e['duration']; n=int(dur*SR); t=np.arange(n)/SR
        env=np.maximum(np.minimum(t/.012,1)*np.minimum((dur-t)/.035,1),0)
        if e.get('pluck'): env=env*np.exp(-t*3.2)
        cents=e.get('cents',[0]*len(e['notes'])); sig=np.zeros(n)
        for m,c in zip(e['notes'],cents):
            f=440*2**((m-69+c/100)/12)
            for h,a in enumerate(prof,1):
                if a and f*h<SR/2: sig+=a*np.sin(2*np.pi*f*h*t)
        sig*=1.24/sum(prof); sig/=max(1,len(e["notes"])); s=int(e['start']*SR)
        y[s:s+n]+=sig*env*e.get('amp',.55)
    peak=float(np.max(np.abs(y))); assert 0<peak<.96,(name,peak)
    pcm=np.round(y*32767).astype('<i2'); outdir=Path(outdir or ROOT/'audio'); outdir.mkdir(exist_ok=True)
    p=outdir/f'{name}.wav'
    with wave.open(str(p),'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    return {'events':events,'duration':len(y)/SR,'peak':peak,'file':p.name,'timbre':timbre}

def ev(start,dur,notes,amp=.55,**kw):
    d=dict(start=round(start,6),duration=round(dur,6),notes=list(notes),amp=amp); d.update(kw); return d

def events_for(spec):
    """Turn a compact audio spec into explicit events."""
    g=spec['gen']
    if g=='seq':
        step=spec.get('step',.55); ln=spec.get('length',.43); amps=spec.get('amps')
        return [ev(.3+i*step,ln,[m],amps[i] if amps else .55) for i,m in enumerate(spec['notes'])]
    if g=='arpblock':
        ns=spec['notes']; st=spec.get('step',.45)
        es=[ev(.3+i*st,st*.85,[m]) for i,m in enumerate(ns)]
        return es+[ev(.3+len(ns)*st+.25,1.3,ns,.6)]
    if g=='chords':
        sp=spec.get('spacing',.9); return [ev(.3+i*sp,sp*.8,c,.6) for i,c in enumerate(spec['chords'])]
    if g=='cadence':
        sp=spec.get('spacing',.8); intro=spec['intro']; fin=spec['final']
        es=[ev(.3+i*sp,sp*.8,c,.6) for i,c in enumerate(intro)]
        t0=.3+len(intro)*sp+spec.get('gap',1.0)
        return es+[ev(t0+i*sp,sp*.85 if i<len(fin)-1 else 1.2,c,.6) for i,c in enumerate(fin)]
    if g=='pulse':  # levels per subdivision: 2 downbeat, 1 beat, 0 subdivision
        st=spec.get('step',.25); P={2:(84,.62),1:(79,.48),0:(72,.26)}; lv=spec['levels']*spec.get('reps',4)
        return [ev(.3+i*st,.12,[P[l][0]],P[l][1]) for i,l in enumerate(lv)]
    if g=='raw':
        return [ev(s,d,n if isinstance(n,list) else [n],a) for s,d,n,a in spec['notes']]
    if g=='error':
        bars=spec['bars']; kind=spec['kind']; b=spec['bar']; j=spec.get('note',1); beat=spec.get('beat',.4)
        es=[]
        for bi,notes in enumerate(bars):
            for k,m in enumerate(notes):
                e=ev(.4+(bi*4+k)*beat,.32,[m],.5)
                if bi==b:
                    if kind=='pitch' and k==j: e['notes']=[m+spec['shift']]
                    if kind=='intonation' and k==j: e['cents']=[spec['cents']]
                    if kind=='rhythm' and k==j: e['start']=round(e['start']+spec['delay'],6); e['duration']=round(.32-spec['delay'],6) if spec['delay']>0 else .32
                    if kind=='dynamics': e['amp']=spec['amp']
                    if kind=='articulation': e['duration']=.09
                    if kind=='tempo': e['start']=round(.4+(bi*4)*beat+k*beat*spec['factor'],6); e['duration']=round(.32*spec['factor'],6)
                if kind=='tempo' and bi>b: e['start']=round(e['start']-(4*beat*(1-spec['factor'])),6)
                es.append(e)
        return es
    if g=='canon':
        mel=spec['melody']; st=spec.get('step',.4); d=spec['delay']; tr=spec['transpose']
        es=[ev(.3+i*st,st*.85,[m],.45) for i,m in enumerate(mel)]
        es+=[ev(.3+(i+d)*st,st*.85,[m+tr],.45) for i,m in enumerate(mel)]
        return sorted(es,key=lambda e:e['start'])
    raise ValueError('unknown generator '+g)

REQ={'id','objective','stem','rationale'}
def check_item(q, legacy_ids, legacy_stems):
    errs=[]
    if not REQ<=set(q): errs.append('missing fields')
    if not (isinstance(q.get('id'),str) and len(q['id'])==4 and q['id'][0]=='Q' and 101<=int(q['id'][1:])<=300): errs.append('bad id')
    if q.get('id') in legacy_ids: errs.append('id collides with legacy')
    o=int(q.get('objective','0')); 
    if not 1<=o<=23 or q['objective']!=f'{o:04}': errs.append('bad objective')
    if q.get('stem') in legacy_stems: errs.append('stem duplicates legacy')
    if 'options' in q:
        if not (q.get('fixed') and isinstance(q.get('answer'),int) and 0<=q['answer']<4): errs.append('fixed items need answer')
        opts=q['options']
    else:
        if not (isinstance(q.get('correct'),str) and isinstance(q.get('distractors'),list) and len(q['distractors'])==3): errs.append('need correct + 3 distractors')
        opts=[q.get('correct')]+list(q.get('distractors',[]))
    if len(opts)!=4 or len(set(o.strip().lower() for o in opts))!=4 or not all(isinstance(x,str) and x.strip() for x in opts): errs.append('need 4 unique non-empty options')
    if any(x.lower() in ('all of the above','none of the above') for x in opts): errs.append('all/none-of-the-above')
    if len(q.get('rationale',''))<60: errs.append('rationale too short')
    if q.get('proxy') and not q['stem'].startswith('TEXT SUBSTITUTE'): errs.append('proxy needs label')
    if 'audio' in q:
        if not area(o)==0: errs.append('audio outside listening')
        events_for(q['audio'])  # raises if malformed
        if q['audio'].get('timbre','soft') not in TIMBRES: errs.append('bad timbre')
        if 'name' not in q['audio']: errs.append('audio needs name')
    if area(o)==0 and not (q.get('audio') or q.get('proxy')): errs.append('listening item needs audio or proxy label')
    if o==5 and not q.get('score'): errs.append('0005 needs score')
    return errs

def assign_positions(items, batch_no):
    """Deterministic, balanced, non-cyclic key positions. Fixed-order items keep their key."""
    rng=random.Random(212000+batch_no)
    n=len(items); base=[n//4]*4
    for i in range(n%4): base[(batch_no+i)%4]+=1
    for q in items:
        if q.get('fixed'): base[q['answer']]-=1
    assert min(base)>=0, 'fixed keys unbalance batch'
    keys=[k for k in range(4) for _ in range(base[k])]; rng.shuffle(keys)
    out=[]; it=iter(keys)
    for q in items:
        q=dict(q)
        if not q.get('fixed'):
            k=next(it); ds=list(q.pop('distractors')); rng.shuffle(ds); c=q.pop('correct'); ds.insert(k,c)
            q['options']=ds; q['answer']=k
        q.pop('fixed',None)
        o=int(q['objective']); q['area']=area(o)
        out.append(q)
    return out

def to_bank_item(q):
    keys=['id','objective','area','stem','options','answer','rationale','audio','score','proxy','evidence']
    d={k:q[k] for k in keys if k in q}
    if 'audio' in d: d['audio']=d['audio']['name']
    return d

def load_legacy():
    bank=json.loads((ROOT/'legacy-questions-v1.json').read_text())
    return bank,{q['id'] for q in bank},{q['stem'] for q in bank}
