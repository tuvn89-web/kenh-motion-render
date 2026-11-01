import re, subprocess, json, sys, os
from pocketsphinx import Decoder, get_model_path
VO, TXT, OUT = sys.argv[1:4]
text = open(TXT).read().replace('\n', ' ')
SENT = [s.strip() for s in re.split(r'(?<=[.?!])"?\s+(?=["A-Z])', text) if s.strip()]
import difflib
dic = set(l.split()[0].split('(')[0] for l in open(os.path.join(get_model_path(), 'en-us', 'cmudict-en-us.dict')))
# same tokenizer as tools/dung/dung.py (one token per dictionary word; hyphens split)
tokens = lambda w: [x.strip("'") for x in re.sub(r"[^a-z' ]", '', w.lower().replace('-', ' ')).split() if x.strip("'")]
byfirst = {}
for d_ in dic:
    byfirst.setdefault(d_[:1], []).append(d_)
words, owner, orig = [], [], []
for si, s in enumerate(SENT):
    for w in s.split():
        for w2 in tokens(w):
            if w2 not in dic:  # names etc.: align with the closest-spelled dictionary word (timing only)
                sub = (difflib.get_close_matches(w2, byfirst.get(w2[:1], []), n=1, cutoff=0.5) or ['uh'])[0]
                print('OOV', w2, '->', sub)
                w2 = sub
            words.append(w2); owner.append(si)
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', VO, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
d = Decoder(samprate=16000, bestpath=False)
d.set_align_text(' '.join(words))
d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
segs = [(s.word, s.start_frame / 100, (s.end_frame + 1) / 100) for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '[NOISE]')]
segs = [(w.split('(')[0], a, b) for w, a, b in segs]
print(len(segs), 'aligned of', len(words))
assert len(segs) == len(words)
TS = []
for si in range(len(SENT)):
    ix = [k for k, o in enumerate(owner) if o == si]
    TS.append([round(segs[ix[0]][1], 3), round(segs[ix[-1]][2], 3)])
json.dump(TS, open(OUT, 'w'))
json.dump([[w, a, b, o] for (w, a, b), o in zip(segs, owner)], open(OUT.replace('.json', '-words.json'), 'w'))
for (x, y), s in zip(TS, SENT):
    print(f'{x:6.2f} {y:6.2f} {len(s.split()) / max(0.1, y - x):4.1f} w/s  {s[:60]}')
