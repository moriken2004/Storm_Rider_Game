#!/bin/zsh
# STORM RIDER をローカルで起動（メドレー音源つき）
cd "$(dirname "$0")"
PY=/opt/homebrew/bin/python3; [ -x $PY ] || PY=python3
if ! lsof -ti:8795 >/dev/null; then $PY -m http.server 8795 --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1; fi
open http://127.0.0.1:8795/index.html
wait
