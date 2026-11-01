import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))).replace('\\', '/') + '/'
import numpy as np
from PIL import Image, ImageFilter
rng=np.random.default_rng(7)
P=ROOT + "public/"
def noise(w,h,scales=(4,8,16,32,64),weights=None,seed=0):
    r=np.random.default_rng(seed); acc=np.zeros((h,w)); tw=0
    weights=weights or [1/(i+1)**0.9 for i in range(len(scales))]
    for s,wt in zip(scales,weights):
        g=r.random((max(2,h*s//w+2),s+2))
        im=Image.fromarray((g*255).astype(np.uint8)).resize((w,h),Image.BICUBIC)
        acc+=np.asarray(im,dtype=float)/255*wt; tw+=wt
    acc/=tw; acc=(acc-acc.min())/(acc.max()-acc.min()); return acc
# fog sprites
for k in range(4):
    w,h=1800,700
    n=noise(w,h,(3,6,12,24,48),seed=10+k)
    yy,xx=np.mgrid[0:h,0:w]; m=np.clip(1-(((xx-w/2)/(w*0.48))**2+((yy-h/2)/(h*0.42))**2),0,1)**1.2
    a=np.clip((n-0.35)*1.9,0,1)*m
    a=np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)),dtype=float)/255
    rgb=np.zeros((h,w,4),dtype=np.uint8); rgb[...,0]=232; rgb[...,1]=238; rgb[...,2]=236; rgb[...,3]=(a*255).astype(np.uint8)
    Image.fromarray(rgb,'RGBA').save(P+f"fog{k}.png",optimize=True)
# grain (neutral grey, used with overlay blend)
w,h=1920,1080
g=noise(w,h,(60,120,240),seed=3)*0.5+rng.random((h,w))*0.5
fib=noise(w,h,(8,16,32),seed=5)
g=0.5+(g-0.5)*0.55+(fib-0.5)*0.25
Image.fromarray((np.clip(g,0,1)*255).astype(np.uint8),'L').save(P+"grain.png",optimize=True)
# parchment
base=np.array([226,212,180],dtype=float)
n1=noise(w,h,(3,6,12,24),seed=21); n2=noise(w,h,(40,80,160),seed=22)
yy,xx=np.mgrid[0:h,0:w]; edge=np.clip(((xx-w/2)/(w/2))**2*0.6+((yy-h/2)/(h/2))**2*0.6,0,1)**1.6
shade=1-0.10*(n1-0.5)-0.05*(n2-0.5)-0.22*edge
img=np.clip(base[None,None,:]*shade[...,None],0,255).astype(np.uint8)
Image.fromarray(img,'RGB').save(P+"parchment.jpg",quality=92)
# vignette
v=np.clip(((xx-w/2)/(w*0.62))**2+((yy-h/2)/(h*0.62))**2,0,1)**1.8
va=np.zeros((h,w,4),dtype=np.uint8); va[...,0]=10; va[...,1]=8; va[...,2]=12; va[...,3]=(v*200).astype(np.uint8)
Image.fromarray(va,'RGBA').save(P+"vignette.png",optimize=True)
print("ok")
