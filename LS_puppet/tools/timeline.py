import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))).replace('\\', '/') + '/'
import json, soundfile as sf, numpy as np, sys
B=ROOT + "build/"
L=json.load(open(B+"script.json"))
SR=24000; FPS=30; LEAD=1.3
t=LEAD; parts=[np.zeros(int(LEAD*SR),dtype=np.float32)]; tl=[]
for x in L:
    a,sr=sf.read(B+"vo/"+x["id"]+".wav",dtype="float32"); assert sr==SR
    d=len(a)/SR
    tl.append({"id":x["id"],"text":x["text"],"start":round(t,3),"end":round(t+d,3),"sf":round(t*FPS),"ef":round((t+d)*FPS)})
    parts.append(a); parts.append(np.zeros(int(x["pause"]*SR),dtype=np.float32)); t+=d+x["pause"]
vo=np.concatenate(parts); total=len(vo)/SR
sf.write(B+"vo_full.wav",vo,SR)
json.dump({"fps":FPS,"total":round(total,3),"frames":int(np.ceil(total*FPS)),"lines":tl},open(ROOT + "src/timeline.json","w"),indent=1)
print("total",round(total,2),"frames",int(np.ceil(total*FPS)))
for x in tl: print(x["id"],x["start"],x["end"])

# ---- word-level timing estimate (silence-aligned phrases, char-proportional words)
import re
def words_for(x):
    a,sr=sf.read(B+"vo/"+x["id"]+".wav",dtype="float32")
    hop=int(0.01*sr); env=np.array([np.sqrt(np.mean(a[i:i+hop]**2)) for i in range(0,len(a)-hop,hop)])
    quiet=env<max(0.004,0.05*env.max())
    sil=[]; i=0
    while i<len(quiet):
        if quiet[i]:
            j=i
            while j<len(quiet) and quiet[j]: j+=1
            if (j-i)>=7 and i>5 and j<len(quiet)-5: sil.append(((i+j)//2,j-i))
            i=j
        else: i+=1
    phrases=[p.strip() for p in re.split(r'(?<=[,.?!])\s+',x["text"]) if p.strip()]
    tot=sum(len(q)+6 for q in phrases); n=len(env)
    bounds=[0]
    for k in range(1,len(phrases)):
        exp=sum(len(q)+6 for q in phrases[:k])/tot*n
        cands=[c for c in sil if c[0]>bounds[-1]+10]
        if cands:
            best=min(cands,key=lambda c:abs(c[0]-exp)/ (1+0.15*c[1]))
            bounds.append(best[0] if abs(best[0]-exp)<0.25*n else int(exp))
        else: bounds.append(int(exp))
    bounds.append(n)
    out=[]
    for pi,p in enumerate(phrases):
        if bounds: s0=bounds[pi]*0.01; s1=bounds[pi+1]*0.01
        else:
            tot=sum(len(q) for q in phrases); pre=sum(len(q) for q in phrases[:pi]); dur=len(a)/sr
            s0=pre/tot*dur; s1=(pre+len(p))/tot*dur
        ws=p.split(); tot=sum(len(w)+1 for w in ws); c=0
        for w in ws:
            out.append({"w":re.sub(r'[^A-Za-z0-9\'-]','',w).lower(),"t":round(x["start"]+s0+(s1-s0)*c/tot,3)}); c+=len(w)+1
    return out
data=json.load(open(ROOT + "src/timeline.json"))
for x in data["lines"]: x["words"]=words_for(x)
json.dump(data,open(ROOT + "src/timeline.json","w"),indent=1)
print([ (w["w"],w["t"]) for w in data["lines"][15]["words"]])
