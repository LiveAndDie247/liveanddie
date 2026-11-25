#!/bin/bash
# Run shell commands through the deep link and report console errors / failed requests / overflow.
#   tools/sweep.sh "help" "beat" "open ARC-0802"     (set WAIT=ms, default 1900; GL=1 for --gl)
cd "$(dirname "$0")/.."
FAIL=0
for c in "$@"; do
  h=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$c")
  r=$(timeout 70 node tools/shot.mjs "http://localhost:8000/#$h" /root/.cache/shots/sweep.png --wait=${WAIT:-1900} ${GL:+--gl} 2>&1 | grep -iE 'PROBLEM|uncaught|overflowX":[1-9]|HTTP [45]|failed|console\.error' | tr '\n' ' ')
  if [ -n "$r" ]; then echo "FAIL [$c] -> ${r:0:300}"; FAIL=$((FAIL+1)); fi
done
echo "sweep: $FAIL failures of $# commands"
