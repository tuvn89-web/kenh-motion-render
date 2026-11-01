import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))).replace('\\', '/') + '/'
import sherpa_onnx, soundfile as sf, json, sys, numpy as np, os
M=_os.environ.get("KOKORO_DIR", ROOT + "models/kokoro-en-v0_19") + "/"
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=M+"model.onnx",voices=M+"voices.bin",tokens=M+"tokens.txt",data_dir=M+"espeak-ng-data"),num_threads=2),max_num_sentences=2)
tts=sherpa_onnx.OfflineTts(cfg)
lines=json.load(open(sys.argv[1])); out=sys.argv[2]; sid=int(sys.argv[3]); speed=float(sys.argv[4])
os.makedirs(out,exist_ok=True)
only=sys.argv[5].split(",") if len(sys.argv)>5 else None
for L in lines:
    if only and L["id"] not in only: continue
    a=tts.generate(L["text"],sid=sid,speed=speed)
    x=np.array(a.samples,dtype=np.float32)
    # trim silence
    thr=0.01; idx=np.where(np.abs(x)>thr)[0]
    x=x[max(0,idx[0]-int(0.03*a.sample_rate)):idx[-1]+int(0.08*a.sample_rate)]
    sf.write(f"{out}/{L['id']}.wav",x,a.sample_rate)
    print(L["id"],round(len(x)/a.sample_rate,2),flush=True)
