# 区間ごとに「つないでも不自然にならない」ループ点を探し、確認用の WAV も書き出す
import numpy as np, sys, json, wave, subprocess
SR=22050;N=2048;H=512;fps=SR/H
x=np.fromfile('work/mono.f32',dtype=np.float32)
nf=(len(x)-N)//H
fr=np.lib.stride_tricks.sliding_window_view(x,N)[::H][:nf]*np.hanning(N)
S=np.abs(np.fft.rfft(fr,axis=1))
# 対数間隔 48 帯域にまとめる
edges=np.geomspace(40,9000,49);freq=np.fft.rfftfreq(N,1/SR)
B=np.stack([S[:,(freq>=a)&(freq<b)].sum(1) for a,b in zip(edges[:-1],edges[1:])],1)
L=np.log1p(B*20)
W=int(2.0*fps)   # 2 秒ぶんの並びを比べる
def patches(i0,i1):
    idx=np.arange(i0,i1)
    P=np.stack([L[i:i+W].ravel() for i in idx]);P=P-P.mean(1,keepdims=True)
    return idx,P/(np.linalg.norm(P,axis=1,keepdims=True)+1e-9)
def find(a0,a1,b0,b1,minlen):
    ia,PA=patches(int(a0*fps),int(a1*fps));ib,PB=patches(int(b0*fps),min(int(b1*fps),nf-W-1))
    M=PA@PB.T
    for i,a in enumerate(ia):M[i,(ib-a)/fps<minlen]=-1
    i,j=np.unravel_index(np.argmax(M),M.shape)
    return ia[i]/fps,ib[j]/fps,float(M[i,j])
# 名前: (開始を探す範囲, 終了を探す範囲, 最短の長さ)
REG={'title':(2.2,5.0,5.5,7.6,2.0),'theme':(33,48,56,68.5,12),'eye':(76,100,104,131,14),'storm':(131,150,152,168.5,12),'climax':(168,186,190,207.5,14)}
out={}
# 44.1k ステレオも読み、波形レベルで位相を合わせて確認用 WAV を作る
subprocess.run(['ffmpeg','-loglevel','error','-y','-i','src/storm_rider.mp3','-f','f32le','-ac','2','-ar','44100','work/st.f32'],check=True)
st=np.fromfile('work/st.f32',dtype=np.float32).reshape(-1,2);R=44100
for name,(a0,a1,b0,b1,ml) in REG.items():
    a,b,sc=find(a0,a1,b0,b1,ml)
    # 低域の波形で ±20ms の微調整
    ma=st[int(a*R):int(a*R)+4096].mean(1);best=(-9,0)
    for d in range(-900,900,4):
        mb=st[int(b*R)+d:int(b*R)+d+4096].mean(1);c=float(ma@mb/(np.linalg.norm(ma)*np.linalg.norm(mb)+1e-9))
        if c>best[0]:best=(c,d)
    b2=b+best[1]/R
    out[name]={'a':round(a,4),'b':round(b2,4),'len':round(b2-a,2),'score':round(sc,3),'wave':round(best[0],3)}
    # 確認用：ループ 2 周＋つなぎ目だけ（等パワークロスフェード 0.12 秒）
    xf=int(.12*R);ia,ibb=int(a*R),int(b2*R)
    body=st[ia:ibb+xf].copy();t=np.linspace(0,np.pi/2,xf)[:,None]
    def loop2():
        o=np.zeros((2*(ibb-ia)+xf,2),np.float32);seg=body.copy();seg[-xf:]*=np.cos(t);s2=body.copy();s2[:xf]*=np.sin(t);s2[-xf:]*=np.cos(t)
        o[:len(seg)]+=seg;o[ibb-ia:ibb-ia+len(s2)]+=s2;return o
    o=loop2();seam=o[ibb-ia-3*R:ibb-ia+4*R]
    for fn,d in((f'work/loop_{name}.wav',o),(f'work/seam_{name}.wav',seam)):
        w=wave.open(fn,'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(R);w.writeframes((np.clip(d,-1,1)*32767).astype('<i2').tobytes());w.close()
    # つなぎ目の前後 0.5 秒の音量差（dB）
    pre=st[ibb-R//2:ibb];post=st[ia:ia+R//2]
    out[name]['dB_step']=round(float(20*np.log10((np.sqrt((post**2).mean())+1e-9)/(np.sqrt((pre**2).mean())+1e-9))),1)
print(json.dumps(out,indent=1,ensure_ascii=False))
json.dump(out,open('cues.json','w'),indent=1)
