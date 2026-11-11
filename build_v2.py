"""Assemble the 300-item v2 bank: frozen legacy 100 (IDs, options, keys unchanged) + 8 validated batches.
Synthesizes new audio, merges the audio manifest, and writes the standalone HTML."""
import json, base64, collections, re
from bank_v2 import *
from validate_batch import validate
legacy,_,_=load_legacy(); legacy_manifest=json.loads((ROOT/'legacy-audio-manifest-v1.json').read_text())
new=[]
for n in range(1,9): new+=validate(n,quiet=True)
manifest=dict(legacy_manifest)
for q in new:
    if 'audio' in q:
        spec=q['audio']; manifest[spec['name']]=render(spec['name'],events_for(spec),spec.get('timbre','soft'))
bank=legacy+[to_bank_item(q) for q in new]
# Structural guarantees
assert [q['id'] for q in bank]==[f'Q{i:03}' for i in range(1,301)]
assert bank[:100]==legacy, 'legacy items changed'
assert len({q['stem'] for q in bank})==300
assert collections.Counter(q['area'] for q in bank)=={0:66,1:51,2:51,3:66,4:66}
obj=collections.Counter(q['objective'] for q in bank); assert len(obj)==23
for q in bank:
    assert len(q['options'])==len(set(q['options']))==4 and 0<=q['answer']<4 and q['rationale'] and q['area']==area(int(q['objective']))
    if 'audio' in q: assert q['audio'] in manifest
pos=collections.Counter(q['answer'] for q in bank)
AREAS=['Listening skills','Music theory','Creating & performing','History, culture & context','Music education pedagogy']
src=(ROOT/'build_v1_legacy.py').read_text()
TITLES=eval(re.search(r'^TITLES=(\[.*\])$',src,re.M).group(1)); TIPS=eval(re.search(r'^TIPS=(\[.*\])$',src,re.M).group(1))
TITLES[2]='Historical/cultural listening — mostly text substitutes'; TITLES[3]='Timbre listening — text substitutes only'
TIPS[2]='Use licensed authentic recordings across Western, US, and world traditions. Three synthetic rhythm/harmony items help, but most items here are text substitutes and do not measure aural style recognition.'
(ROOT/'questions.json').write_text(json.dumps(bank,indent=2,ensure_ascii=False))
(ROOT/'audio-manifest.json').write_text(json.dumps(manifest,indent=2))
media={name:'data:audio/wav;base64,'+base64.b64encode((ROOT/'audio'/info['file']).read_bytes()).decode() for name,info in manifest.items()}
html=(ROOT/'template.html').read_text()
for marker,value in {'__BANK__':json.dumps(bank,ensure_ascii=False).replace('</','<\\/'),'__AUDIO__':json.dumps(media),'__CORE__':(ROOT/'core.js').read_text(),'__AREAS__':json.dumps(AREAS),'__TITLES__':json.dumps(TITLES,ensure_ascii=False),'__TIPS__':json.dumps(TIPS,ensure_ascii=False)}.items():
    assert marker in html; html=html.replace(marker,value)
(ROOT/'Music-212-Practice-Studio.html').write_text(html)
print(f'Built {len(bank)} questions ({sum("audio" in q for q in bank)} audio, {sum(bool(q.get("proxy")) for q in bank)} text substitutes), {len(manifest)} recordings, {len(html.encode()):,} bytes')
print('areas',dict(sorted(collections.Counter(q["area"] for q in bank).items())),'key positions',dict(sorted(pos.items())))
print('objectives',dict(sorted(obj.items())))
