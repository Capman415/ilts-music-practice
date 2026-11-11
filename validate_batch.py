"""Validate one authoring batch (and its consistency with legacy + earlier batches).
Usage: python3 validate_batch.py 01"""
import sys, json, collections, tempfile, wave
import numpy as np
from bank_v2 import *
PLAN={1:{1:14,2:10},2:{3:7,4:6,5:7,6:5},3:{6:4,7:8,8:9,9:4},4:{9:4,10:9,11:8,12:4},
      5:{12:4,13:9,14:10,15:2},6:{15:7,16:9,17:8,18:1},7:{18:7,19:9,20:9},8:{21:9,22:8,23:9}}

def check_evidence(q, events):
    e=q.get('evidence'); 
    if not e: return
    k=e['kind']; first=[x['notes'][0] for x in events]
    if k=='interval': assert first[1]-first[0]==e['semitones']
    elif k=='scale': assert first[:len(e['midi'])]==e['midi'] and list(np.diff(e['midi']))==e['steps']
    elif k=='chord': n=events[-1]['notes']; assert [v-n[0] for v in n]==e['intervals']
    elif k=='cadence': assert [x['notes'] for x in events[-len(e['final']):]]==e['final']
    elif k=='meter':
        lv=[{84:2,79:1,72:0}[m] for m in first]; per=sum(e['groups']); bar=[]
        for gi,g in enumerate(e['groups']): bar+=[2 if gi==0 else 1]+[0]*(g-1)
        assert len(lv)%per==0 and lv==bar*(len(lv)//per), (lv,bar)
    elif k=='tempo':
        d=np.diff([x['start'] for x in events]); assert all(b<a-1e-9 for a,b in zip(d,d[1:])) if e['change']=='accelerando' else all(b>a+1e-9 for a,b in zip(d,d[1:]))
    elif k=='dynamics':
        a=[x['amp'] for x in events]
        if e['change']=='diminuendo': assert all(y<x for x,y in zip(a,a[1:]))
        if e['change']=='terraced': assert len(set(a))==2 and sum(1 for x,y in zip(a,a[1:]) if x!=y)>=2 and all(abs(x-y)>.2 for x,y in zip(a,a[1:]) if x!=y)
    elif k=='onsets': assert [round(x['start'],4) for x in events]==[round(v,4) for v in e['onsets']]
    elif k=='notes': assert first==e['midi']
    elif k=='canon':
        st=e['step']; got={(round(x['start'],4),x['notes'][0]) for x in events}
        exp={(round(.3+i*st,4),m) for i,m in enumerate(e['melody'])}|{(round(.3+(i+e['delay'])*st,4),m+e['transpose']) for i,m in enumerate(e['melody'])}
        assert got==exp and len(events)==2*len(e['melody'])
    elif k=='accents':
        assert [i for i,x in enumerate(events) if x['amp']>.5]==e['indices']
        d=np.diff([x['start'] for x in events]); assert max(d)-min(d)<1e-6
    elif k=='progression': assert [x['notes'][0]%12 for x in events]==e['bassPcs']
    elif k=='error':
        b=e['measure']-1; written=[n for bar in q['score']['bars'] for n in bar]; t=e['errorType']
        assert q['options'][q['answer']]==f'measure {b+1}'
        diffs=[i for i,(x,w) in enumerate(zip(events,written)) if x['notes'][0]!=w]
        if t=='pitch': assert len(diffs)==1 and diffs[0]//4==b
        else: assert not diffs
        if t=='intonation': assert [i for i,x in enumerate(events) if x.get('cents',[0])[0]]==[b*4+e['note']]
        if t=='dynamics': assert {i//4 for i,x in enumerate(events) if x['amp']!=.5}=={b}
        if t=='articulation': assert {i//4 for i,x in enumerate(events) if x['duration']!=.32}=={b}
        if t=='rhythm':
            off=[i for i,x in enumerate(events) if abs(x['start']-(.4+i*.4))>1e-6]; assert off and {i//4 for i in off}=={b}
        if t=='tempo':
            d=np.diff([x['start'] for x in events]); fast=[i for i,v in enumerate(d) if v<.39]; assert fast and {i//4 for i in fast}=={b}, fast
    else: raise AssertionError('unknown evidence '+k)

def spectral(name, info, path):
    with wave.open(str(path)) as w: y=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32767
    assert np.sqrt(np.mean(y*y))>.015 and np.max(np.abs(y))<.96, name
    for e in info['events']:
        a0=int((e['start']+.012)*SR); a1=int((e['start']+e['duration']-.02)*SR)
        if a1-a0<320: continue
        a=y[a0:a1]; spec=np.abs(np.fft.rfft(a*np.hanning(len(a)),n=65536)); fr=np.fft.rfftfreq(65536,1/SR)
        for m,c in zip(e['notes'],e.get('cents',[0]*len(e['notes']))):
            f=440*2**((m-69+c/100)/12); win=(fr>f-9)&(fr<f+9)
            assert spec[win].max()>spec.max()*.22,(name,m)

def validate(n, quiet=False):
    legacy,lids,lstems=load_legacy(); prior=[]
    for i in range(1,n):
        prior+=json.loads((ROOT/'batches'/f'questions-batch-{i:02}.json').read_text())
    items=json.loads((ROOT/'batches'/f'questions-batch-{n:02}.json').read_text())
    errs=[]
    for q in items:
        for e in check_item(q,lids,lstems): errs.append(f"{q.get('id')}: {e}")
    ids=[q['id'] for q in prior+items]; stems=[q['stem'] for q in prior+items]
    if len(set(ids))!=len(ids): errs.append('duplicate ids')
    if len(set(stems))!=len(stems): errs.append('duplicate stems')
    expect_start=101+len(prior); 
    if [q['id'] for q in items]!=[f'Q{expect_start+i:03}' for i in range(len(items))]: errs.append('ids not consecutive')
    got=collections.Counter(int(q['objective']) for q in items)
    if dict(got)!=PLAN[n]: errs.append(f'objective plan mismatch {dict(got)} vs {PLAN[n]}')
    names=[q['audio']['name'] for q in prior+items if 'audio' in q]
    if len(set(names))!=len(names): errs.append('duplicate audio names')
    if errs: print('\n'.join(errs)); sys.exit(1)
    final=assign_positions(items,n)
    with tempfile.TemporaryDirectory() as td:
        for q in final:
            if 'audio' in q:
                events=events_for(q['audio']); info=render(q['audio']['name'],events,q['audio'].get('timbre','soft'),td)
                assert 1<info['duration']<16,(q['id'],info['duration'])
                check_evidence(q,events); spectral(q['id'],info,Path(td)/info['file'])
    pos=collections.Counter(q['answer'] for q in final)
    if not quiet: print(f'batch {n:02} PASS: {len(final)} items {final[0]["id"]}–{final[-1]["id"]}; objectives {dict(sorted(got.items()))}; key positions {dict(sorted(pos.items()))}; audio {sum("audio" in q for q in final)}; proxy {sum(bool(q.get("proxy")) for q in final)}')
    return final
if __name__=='__main__': validate(int(sys.argv[1]))
