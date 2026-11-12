#!/usr/bin/env bash
# Screenshot a page at phone size and print console errors.
#   tools/shot.sh <url> [out.png] [--landscape] [--full] [--scroll] [--wait=ms]
# Example: tools/shot.sh http://localhost:8080/ ~/.cache/shots/home.png --full
# Needs Chrome for Testing's headless shell in ~/.cache/chrome-hs (see tools/shot.mjs header) and Node 22.
exec node "$(dirname "$0")/shot.mjs" "$@"
