# メドレーの構造をざっくり調べる：音量・明るさ・区切り・テンポ
import numpy as np, sys
SR=22050
x=np.fromfile(sys.argv[1],dtype=np.float32)
N=2048;H=512
win=np.hanning(N)
nf=(len(x)-N)//H
frames=np.lib.stride_tricks.sliding_window_view(x,N)[::H][:nf]*win
S=np.abs(np.fft.rfft(frames,axis=1))
freq=np.fft.rfftfreq(N,1/SR)
rms=np.sqrt((frames**2).mean(1))
cent=(S*freq).sum(1)/(S.sum(1)+1e-9)
low=S[:,freq<200].sum(1)/(S.sum(1)+1e-9)
# スペクトル変化量（オンセット）
L=np.log1p(S*50)
flux=np.maximum(L[1:]-L[:-1],0).sum(1);flux=np.r_[0,flux]
fps=SR/H
def sm(a,sec):
    k=max(1,int(sec*fps));return np.convolve(a,np.ones(k)/k,mode='same')
# 2 秒ごとの表
print('t(s)  dB    cent  low   onset')
step=int(2*fps)
for i in range(0,nf-step,step):
    seg=slice(i,i+step)
    print(f'{i/fps:5.0f} {20*np.log10(rms[seg].mean()+1e-9):6.1f} {cent[seg].mean():6.0f} {low[seg].mean():.2f} {flux[seg].mean():6.1f} '+'#'*int(max(0,(20*np.log10(rms[seg].mean()+1e-9)+45))))
# 区切り候補：前後 4 秒の平均スペクトルの違いが大きい所
k=int(4*fps);Ln=L/(np.linalg.norm(L,axis=1,keepdims=True)+1e-9)
cs=np.cumsum(Ln,axis=0)
nov=np.zeros(nf)
for i in range(k,nf-k):
    a=(cs[i]-cs[i-k])/k;b=(cs[i+k]-cs[i])/k
    nov[i]=1-(a@b)/(np.linalg.norm(a)*np.linalg.norm(b)+1e-9)
nov=sm(nov,1)
pk=[i for i in range(k,nf-k) if nov[i]==nov[max(0,i-int(5*fps)):i+int(5*fps)].max() and nov[i]>np.percentile(nov,75)]
print('\n区切り候補(s):',[round(i/fps,1) for i in pk])
# 区間ごとのテンポ
def tempo(a,b):
    o=flux[int(a*fps):int(b*fps)];o=o-sm(o,.5)[:len(o)];o=np.maximum(o,0)
    if len(o)<fps*6:return None
    ac=np.correlate(o,o,'full')[len(o)-1:]
    lo,hi=int(fps*60/200),int(fps*60/55)
    lag=lo+np.argmax(ac[lo:hi]);return 60*fps/lag,ac[lag]/ac[0]
b=[0]+[i/fps for i in pk]+[nf/fps]
print('\n区間  長さ  平均dB  テンポ(確からしさ)')
for a,c in zip(b[:-1],b[1:]):
    t=tempo(a,c);seg=slice(int(a*fps),int(c*fps))
    print(f'{a:6.1f}-{c:6.1f} {c-a:5.1f}s {20*np.log10(rms[seg].mean()+1e-9):6.1f}dB ',('%.1f bpm (%.2f)'%t) if t else '-')
