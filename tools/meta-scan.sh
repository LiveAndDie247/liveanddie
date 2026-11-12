#!/bin/bash
# Lists any media file in the site that carries metadata beyond technical container/encoder tags
# (location, dates, titles, artist, comments, camera EXIF, GPS). Strips it with --fix (stream copy, no re-encode).
#   tools/meta-scan.sh [--fix]
cd "$(dirname "$0")/.."
SAFE='^(language|handler_name|vendor_id|encoder|major_brand|minor_version|compatible_brands)$'
bad=0
while IFS= read -r f; do
  keys=$(ffprobe -v error -show_entries format_tags:stream_tags -of flat "$f" | sed -n 's/.*\.tags\.\([a-zA-Z_]*\)=.*/\1/p' | sort -u | grep -Ev "$SAFE" | tr '\n' ' ')
  [ -z "$keys" ] && continue
  bad=$((bad+1)); echo "$f: $keys"
  if [ "${1:-}" = --fix ]; then t=$(mktemp --suffix=".${f##*.}"); ffmpeg -nostdin -loglevel error -y -i "$f" -map 0 -c copy -map_metadata -1 -map_chapters -1 -fflags +bitexact -movflags +faststart "$t" && mv "$t" "$f" && chmod 644 "$f"; fi
done < <(find img archive -type f \( -name '*.mp4' -o -name '*.m4a' -o -name '*.mov' -o -name '*.webm' \))
while IFS= read -r f; do
  e=$(magick identify -format '%[EXIF:*]%[IPTC:*]%[XMP:*]' "$f[0]" 2>/dev/null | tr -d '\n')
  [ -z "$e" ] && continue
  bad=$((bad+1)); echo "$f: EXIF/IPTC/XMP present"
  [ "${1:-}" = --fix ] && magick "$f" -strip "$f"
done < <(find . -path ./.git -prune -o -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print)
echo "files with personal/extra metadata: $bad"
