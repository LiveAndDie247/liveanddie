#!/bin/bash
# Bakes the LIVE.AND.DIE watermark into the art images (ImageMagick 7), so it survives saving and
# screenshots. Safe to re-run: finished files carry a "LAD-WATERMARK" tag and are skipped.
#
#   tools/watermark.sh                 watermark every art image (originals backed up first)
#   tools/watermark.sh img/new.jpg …   just these files
#   tools/watermark.sh --sample DIR f… write watermarked copies to DIR (repo untouched)
#   tools/watermark.sh --list          show which files count as art
#
# Art = images in img/ (jpg/jpeg/png/webp/gif) except site decoration: the dim background stills
# (img/bg/), stars.png, og.png (share card), t_* tool icons. Everything in gif/ is decoration.
# The untouched original of each file is copied to ~/liveanddie-originals/<same path> before the
# first change, and never overwritten.
#
# Look: "LIVE.AND.DIE" with "liveanddie.xyz" under it, bold italic serif, red with a hard black
# outline, tiled in offset rows rotated −30° across the whole piece at 35% opacity, sized from the image width.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$(pwd)
ORIG="$HOME/liveanddie-originals"
TAG="LAD-WATERMARK"
FONT="Times-BoldItalic"
OPACITY=35

art_files() {
  find img -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) \
    ! -name 'stars.png' ! -name 'og.png' ! -name 't_*' | sort
}

is_marked() { [ "$(magick identify -format '%c' "$1[0]" 2>/dev/null)" = "$TAG" ]; }

# watermark <in> <out>
watermark() {
  local in="$1" out="$2" w h big small stroke sstroke diag cell row field
  read -r w h < <(magick identify -format '%w %h\n' "$in[0]")
  # sized from the width: the title is ~1/11 of the piece wide per letter-height, so it reads on a
  # 360px thumbnail (≈32px type) and stays proportional at full size
  big=$(( w / 11 )); [ "$big" -lt 26 ] && big=26
  small=$(( big * 45 / 100 )); [ "$small" -lt 12 ] && small=12
  stroke=$(( big / 16 )); [ "$stroke" -lt 2 ] && stroke=2
  sstroke=$(( stroke * 6 / 10 )); [ "$sstroke" -lt 1 ] && sstroke=1
  diag=$(magick xc: -format "%[fx:ceil(hypot($w,$h))+$big*4]" info:)
  cell=$(mktemp --suffix=.png); row=$(mktemp --suffix=.png); field=$(mktemp --suffix=.png)
  # one cell: two centred lines of outlined red text, trimmed, with breathing room around it
  magick -background none -font "$FONT" -fill '#ff0000' -stroke black \
    \( -pointsize "$big" -strokewidth "$stroke" label:'LIVE.AND.DIE' \) \
    \( -pointsize "$small" -strokewidth "$sstroke" label:'liveanddie.xyz' \) \
    -gravity center -append -trim +repage \
    -bordercolor none -border "$(( big * 9 / 10 ))x$(( big * 6 / 10 ))" "$cell"
  # two rows, the second shifted half a cell, so the pattern is a brick wall with no clean gaps
  magick "$cell" \( "$cell" -roll "+$(( $(magick identify -format '%w' "$cell") / 2 ))+0" \) -append "$row"
  # tile a field bigger than the diagonal, rotate it, crop the middle to the piece's size
  magick -size "${diag}x${diag}" tile:"$row" -background none -rotate -30 \
    -gravity center -crop "${w}x${h}+0+0" +repage \
    -channel A -evaluate multiply "0.$OPACITY" +channel "$field"
  magick "$in" "$field" -gravity center -compose over -composite \
    -set comment "$TAG" -quality 90 "$out"
  rm -f "$cell" "$row" "$field"
}

mode=run
if [ "${1:-}" = "--list" ]; then art_files; exit 0; fi
if [ "${1:-}" = "--sample" ]; then mode=sample; outdir="$2"; shift 2; mkdir -p "$outdir"; fi
files=("$@")
[ ${#files[@]} -eq 0 ] && mapfile -t files < <(art_files)

done=0 skipped=0
for f in "${files[@]}"; do
  f="${f#./}"
  if [ "$mode" = sample ]; then watermark "$f" "$outdir/$(basename "$f")"; echo "sample: $outdir/$(basename "$f")"; continue; fi
  if is_marked "$f"; then skipped=$((skipped + 1)); continue; fi
  if [ ! -e "$ORIG/$f" ]; then mkdir -p "$ORIG/$(dirname "$f")"; cp -p "$f" "$ORIG/$f"; fi
  tmp=$(mktemp --suffix=".${f##*.}")
  watermark "$f" "$tmp"
  mv "$tmp" "$f"; chmod 644 "$f"
  done=$((done + 1)); echo "watermarked: $f"
done
[ "$mode" = run ] && echo "done: $done watermarked, $skipped already had it (originals in $ORIG)"
exit 0
