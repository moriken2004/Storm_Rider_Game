# 予告編の作り方

ゲームを 1/60 秒ずつ進めて 1 コマずつ撮り、ffmpeg で映像にまとめます。完成した映像と音源は、このリポジトリには入っていません。

必要なもの：Node.js、`npm install`（puppeteer）、ffmpeg。ローカルサーバー（`node serve.mjs`）を起動しておきます。

```bash
node trailer/capture.mjs preview          # 低解像度の下見 → trailer/out/preview_*.png
node trailer/capture.mjs preview <名前>   # 1 ショットだけ下見
node trailer/capture.mjs final            # 本番：60 コマ/秒・1.5 倍の画素 → trailer/frames/
node trailer/capture.mjs final <名前>     # 1 ショットだけ撮り直す
```

音を用意して、映像にまとめます。

```bash
node trailer/audio.mjs    # 合成した音楽（60 秒版）→ trailer/out/mix.wav
node trailer/sfx.mjs      # 効果音だけ（95 秒版）→ trailer/out/sfx.wav
ffmpeg -y -framerate 60 -i trailer/frames/%05d.jpg -i <音声ファイル> \
  -vf "tmix=frames=2:weights='1 1',fps=30,scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart -shortest trailer.mp4
```

## ファイル

| ファイル | 役割 |
|---|---|
| `shots.js` | 台本。ショットごとの開始秒、準備、カメラ、字幕 |
| `shots_v2.js` | 1 つ前の版の台本 |
| `capture.mjs` | 撮影。字幕・黒帯・暗転を重ね、乱数を固定して 1 コマずつ保存 |
| `audio.mjs` | 合成した音楽と効果音（初版の 60 秒構成用） |
| `sfx.mjs` | 効果音だけ（雷、雨、エンジン、衝撃波） |
| `probe.mjs` | 本編のカットシーンを 1 秒おきに撮って一覧にする下調べ用 |

## 台本の書きかた

`shots.js` の各ショットは次の形です。

- `at` — 開始秒。次のショットの `at` までがそのショットの長さ
- `setup()` — 場面の準備（局面を始める、機体を置く、カメラを決める）
- `frame(t, k)` — 毎コマ呼ばれます（`t` は経過秒、`k` は 0〜1）
- `cap` / `label` / `bars` / `hud` / `fadeIn` / `fadeOut` — 字幕、見出し、上下の黒帯、HUD の表示、暗転

現在の台本の切り替え位置は、作者が手元で使った音源の強い音（10.14／14.76／57.2／89.74 秒）に合わせてあります。
別の音を使うときは、`at` の値をその曲に合わせて直してください。

## こつ

- 60 コマ/秒で撮って 2 コマずつ混ぜると、動きのぼけが付きます。
- 暗い壁雲の中では、機体の寄りはほとんど写りません。寄りの画は明るい場所で撮ります。
- 低解像度の下見ではタイトルの板が画面からはみ出しますが、本番の解像度では収まります。
