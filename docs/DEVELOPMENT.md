# 開発の手引き

## ビルド

```bash
node build.mjs
```

`src/` の 5 つのファイルをつなげて `index.html` を作ります（ついでに、埋め込み用の `artifact.html` も出します）。
依存するパッケージはありません。three.js r128 は実行時に配信サービスから読み込みます。

```bash
node serve.mjs        # http://127.0.0.1:8795/
```

## 検査用の道具

どれも、ローカルサーバーを起動した状態で、ヘッドレスのブラウザからゲームを動かして調べます。最初に 1 回だけ次を実行してください。

```bash
npm install
```

| コマンド | 何をするか |
|---|---|
| `node test/all.mjs [quick]` | 主な検査（通しプレイ・入念な検査・でたらめ操作・目標の印・スマートフォン表示・機銃・カットの割り込み・武装モード・バレルロール・浮いている部品・自動の画質調整）をまとめて流し、合否を一覧にします。`quick` は長時間の検査を省きます |
| `node test/play.mjs d0` | 自動操縦で最初から最後まで通しで遊び、結果を出します（`d0`＝訓練、`d1`＝実戦、`d2`＝極限。`god` を付けると無敵） |
| `node test/interf.mjs [形の番号…]` | 機体の部品の干渉検査。排気・吸気の通り道、車輪、風防などに他の部品が入っていないか、浮いた部品・埋もれた部品がないか |
| `node test/zfight.mjs` | 同じ平面で重なっている面（ちらつきの原因）を、基地・港・格納庫から探します |
| `node test/survey.mjs a\|b\|c` | 48 の場面を撮って一覧にします（描画の崩れを目で探す用） |
| `node test/one.mjs <名前> '<JS>'` | 1 場面を大きく撮ります。`fly(n,alt)` と `cam(x,y,z,yaw,pitch,fov)` が使えます |
| `node test/insp.mjs <形> <塗装> a\|b\|c\|d\|s [strip]` | 機体を滑走路に置いて 6 方向から撮ります（`s strip` は装甲を全部剥がした状態） |
| `node test/hangar.mjs` | 格納庫の中を 6 方向から撮ります |
| `node test/cloudab.mjs [km]` | 雲の描画の設定を変えた前後を並べて撮ります |
| `node test/mobile.mjs` | スマートフォンの画面（横向き 844×390 と縦向き）で 7 場面を撮ります |
| `node test/cost.mjs` | 1 コマの描画にかかる時間を場面別に測ります |
| `node test/bgmflow.mjs [?synth]` | 任務を通しで進め、どの場面でどの区間が鳴り始めたかを記録します（同じ曲の鳴り直しなどを見つける用） |
| `node test/bgm.mjs` | 音楽の再生状態と出力の大きさを、画面遷移ごとに調べます |

結果の画像は `test/out/` に出ます。

`window.__SR` に、検査用の入口（`startRun`、`step`、`tick`、`P`、`G` など）を出してあります。

## 作業の進め方（おすすめ）

1. `src/` を書き換える
2. `node build.mjs`
3. 見た目を変えたら `test/one.mjs` か `test/survey.mjs` で撮って確かめる
4. 機体を変えたら `test/interf.mjs`、建物や舗装を変えたら `test/zfight.mjs`
5. 最後に `node test/play.mjs d0` で通しプレイが完走することを確かめる

## 手を入れやすい所

| やりたいこと | 場所 |
|---|---|
| 機体の形を足す | `src/world.js` の `SHAPES`（翼断面の表を 1 行足す） |
| 塗装を足す | `src/world.js` の `SCHEMES` |
| 難易度の数値 | `src/game.js` の `DIFFS` |
| 無線の台詞 | `src/game.js` の `say(...)` と各カットの `subs` |
| BGM の区間（内蔵の既定値） | `src/audio.js` の `CUES`。`bgm/cues.json` があればそちらが優先 |
| 台風の大きさと形 | `src/core.js` の `stormCover` と `stormAt`（両方を同じに保つ） |
| 地上の車両 | `src/world.js` の `buildVehicle` |
| 港 | `src/world.js` の `buildPort` |

## 予告編

`trailer/` に、ゲームを 1/60 秒ずつ進めて 1 コマずつ撮り、映像にまとめる仕組みがあります。
手順は [trailer/README.md](../trailer/README.md) を見てください（[ffmpeg](https://ffmpeg.org/) が必要です）。

## 覚えておくと助かること

- 雲の式は、シェーダー側と JavaScript 側の 2 か所にあります。片方だけ直さないこと。
- 重なる舗装は「高さを少し変える」より「重ねない」ほうが確実です。奥行きをずらす設定（polygonOffset）は、浅い角度で地面の下に潜ったり、上の面を覆ったりします。
- 曲面に物を貼るときは、近似式ではなく、実際の面に光線を当てて位置と向きを取ります。
- 動く部品には `userData.dyn = true` を付けます。付けないと、起動時の結合でほかの部品と 1 つにまとめられて動かなくなります。
- 描画時間の測定は、ほかのタブでゲームを開いたままだと 2 倍近く振れます。
