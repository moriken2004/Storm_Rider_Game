# 自分の音源を使うとき

このフォルダに音源は入っていません。ゲームは標準で、内蔵のシンセサイザーが音楽を演奏します。

ローカルで動かす場合に限り、`bgm/src/storm_rider.mp3` を置くと、ゲームがそれを読み込み、場面ごとに決めた区間を繰り返して鳴らします。
区間の秒数は `src/audio.js` の `CUES` にあります。

## 繰り返しの区間を探す

Python 3 と numpy、それに ffmpeg が必要です。

```bash
mkdir -p work
ffmpeg -i src/storm_rider.mp3 -ac 1 -ar 22050 -f f32le work/mono.f32
python3 analyze.py work/mono.f32     # 2 秒ごとの音量・明るさ・区切りの候補・テンポ
python3 loops.py                     # つないでも不自然にならない繰り返し点を探し、cues.json と確認用の WAV を出す
```

`cues.json` は、作者が手元の音源に対して求めた値の例です。別の曲では意味を持ちません。

繰り返しの長さが拍の整数倍になっているかを、必ず確かめてください。拍の途中で頭に戻ると、つなぎ目がはっきり分かります。

## 注意

`bgm/src/` と `bgm/work/` は `.gitignore` で除外しています。他人が権利を持つ楽曲を、公開のリポジトリに入れないでください。
