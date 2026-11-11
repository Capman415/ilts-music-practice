"""Apply option-length revisions (reduce longest-answer cues) to one batch file."""
import json,sys
def apply(n,rev):
    p=f'batches/questions-batch-{n:02}.json'; B=json.load(open(p)); ids={q['id'] for q in B}
    for k,(c,ds) in rev.items():
        assert k in ids,k
        q=next(q for q in B if q['id']==k)
        if c: q['correct']=c
        if ds: assert len(ds)==3; q['distractors']=ds
    open(p,'w').write(json.dumps(B,indent=1,ensure_ascii=False)); print('revised',len(rev),'in batch',n)
