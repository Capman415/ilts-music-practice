from pathlib import Path
import json,base64,re,wave,io,collections
import numpy as np
r=Path(__file__).parent
full=json.loads((r/'questions.json').read_text());bank=full[:100];manifest=json.loads((r/'audio-manifest.json').read_text());html=(r/'Music-212-Practice-Studio.html').read_text()
media=json.loads(re.search(r'<script id="audio-data" type="application/json">(.*?)</script>',html,re.S).group(1))
assert len(bank)==len({q['id'] for q in bank})==len({q['stem'] for q in bank})==100
assert collections.Counter(q['area'] for q in bank)=={0:22,1:17,2:17,3:22,4:22}
assert collections.Counter(q['answer'] for q in bank)=={0:25,1:25,2:25,3:25}
assert len({q['objective'] for q in bank})==23
assert len(full)==300 and sum('audio' in q for q in bank)==17 and sum(q.get('proxy',False) for q in bank)==5
assert all(q.get('audio') or q.get('proxy') for q in bank[:22])
# Independent reference checks for the explicit note data and keyed labels.
expected=[('interval_up','minor sixth'),('interval_down','perfect fifth'),('dorian','Dorian'),('harmonic_minor','harmonic minor'),('dom7','dominant seventh'),('halfdim','half-diminished seventh'),('deceptive','deceptive'),('half_cadence','half'),('compound_duple','6/8'),('simple_triple','3/4'),('syncopation','syncopation'),('articulation','from connected to detached articulation'),('crescendo','crescendo')]
for audio,key in expected:
 q=next(q for q in bank if q.get('audio')==audio);assert q['options'][q['answer']]==key
for q in bank:
 assert len(q['options'])==len(set(q['options']))==4 and q['rationale'] and 0<=q['answer']<4
 if 'evidence' not in q:continue
 e=q['evidence'];kind=e['kind'];events=manifest[q['audio']]['events']
 if kind=='interval':assert events[1]['notes'][0]-events[0]['notes'][0]==e['semitones']
 if kind=='scale':
  notes=e['midi'];assert list(np.diff(notes))==e['steps'];assert [v['notes'][0] for v in events[:len(notes)]]==notes
 if kind=='chord':
  notes=events[-1]['notes'];assert [v-notes[0] for v in notes]==e['intervals']
 if kind=='cadence':
  assert [v['notes'] for v in events[-len(e['final']):]]==e['final'];assert [v['notes'][0]%12 for v in events[:4]]==[0,5,7,0]
  if e['roman'][-1]=='vi':assert [n%12 for n in e['final'][-1]]==[9,9,0,4]
  else:assert set(n%12 for n in e['final'][-1])=={7,11,2}
 if kind=='meter':
  n=sum(e['groups']);assert len(events)==24
  starts={0};t=0
  for g in e['groups'][:-1]:t+=g;starts.add(t)
  assert all((x['notes'][0]>67)==(i%n in starts) for i,x in enumerate(events))
 if kind=='dynamics':assert all(b>a for a,b in zip(e['amplitudes'],e['amplitudes'][1:]));assert all(abs(events[i+1]['start']-events[i]['start']-.48)<1e-8 for i in range(9))
 if kind=='error':
  b=e['measure']-1;assert q['options'][q['answer']]==f'measure {b+1}'
  expected_notes=[n for bar in q['score']['bars'] for n in bar]
  for i,event in enumerate(events):
   if e['errorType']=='pitch' and i==b*4+1:assert event['notes'][0]==expected_notes[i]+2
   else:assert event['notes'][0]==expected_notes[i]
   if e['errorType']=='intonation':assert event.get('cents',[0])[0]==(45 if i==b*4+2 else 0)
   if e['errorType']=='articulation':assert event['duration']==(.09 if i//4==b else .32)
   if e['errorType']=='rhythm':assert abs(event['start']-(.4+i*.4)-(.2 if i==b*4+1 else 0))<1e-8
for name,info in manifest.items():
 assert media[name].startswith('data:audio/wav;base64,')
 raw=base64.b64decode(media[name].split(',')[1]);assert raw==(r/'audio'/info['file']).read_bytes();assert raw[:4]==b'RIFF' and raw[8:12]==b'WAVE'
 with wave.open(io.BytesIO(raw)) as w:
  assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==16000
  assert abs(w.getnframes()/w.getframerate()-info['duration'])<1e-8
  assert 1<info['duration']<15
  y=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32767
  assert len(y)>0 and np.sqrt(np.mean(y*y))>.015 and np.max(np.abs(y))<.96
  # Check every isolated or chord event's specified fundamental against the decoded WAV spectrum.
  # Use a Hann window over the stable part of the event, with resolution-scaled tolerance.
  for event in info['events']:
   start=int((event['start']+.012)*16000);stop=int((event['start']+event['duration']-.020)*16000)
   if stop-start<320:continue
   a=y[start:stop];spec=np.abs(np.fft.rfft(a*np.hanning(len(a)),n=65536));freq=np.fft.rfftfreq(65536,1/16000)
   for midi,c in zip(event['notes'],event.get('cents',[0]*len(event['notes']))):
    target=440*2**((midi-69+c/100)/12);window=(freq>target-9)&(freq<target+9)
    assert spec[window].max()>spec.max()*.22,(name,midi)
# v2 additions: independent evidence checks for every new audio item, using the explicit manifest events.
import sys;sys.path.insert(0,str(r))
from validate_batch import check_evidence
new_audio=[q for q in full[100:] if 'audio' in q]
for q in new_audio: check_evidence(q,manifest[q['audio']]['events'])
assert len(manifest)==len(media)==len({q['audio'] for q in full if 'audio' in q})==51
print(f'PASS v2: {len(new_audio)} new audio items evidence-checked (intervals, scales, chords, cadences, canon texture, meters, hemiola, tempo, dynamics, ornaments, blues, clave, aksak, 7 score errors); all {len(media)} embedded WAVs decoded and spectrally verified.')
print('PASS legacy: 100 unique questions; 22/17/17/22/22 allocation; 23 objectives; answer positions 25 each; all 17 WAV data URIs decoded, headers/duration/RMS/peaks checked; every event fundamental verified; note/scale/chord/cadence/meter/error reference checks passed.')
print('Objective counts:',dict(sorted(collections.Counter(q['objective'] for q in bank).items())))
print('Audio durations:',{n:round(v['duration'],2) for n,v in manifest.items()})
