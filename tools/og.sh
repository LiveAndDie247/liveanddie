#!/bin/bash
# Builds the 1200x630 share card img/og.png in the house style: black, star field, 3px double red
# border, bold italic serif title with a hard black outline and blue offset shadow. No personal info.
cd "$(dirname "$0")/.."
F=Times-BoldItalic
magick -size 1200x630 xc:black \
  \( -size 1200x630 xc:none -fill white -draw "$(awk 'BEGIN{srand(7);for(i=0;i<170;i++){x=int(rand()*1200);y=int(rand()*630);s=(rand()<.15)?2:1;printf "rectangle %d,%d %d,%d ",x,y,x+s,y+s}}')" \) -composite \
  -fill none -stroke '#ff0000' -strokewidth 3 -draw 'rectangle 14,14 1185,615' -draw 'rectangle 24,24 1175,605' \
  -stroke '#3a3aff' -strokewidth 1 -draw 'rectangle 34,34 1165,595' \
  -font $F -gravity center -pointsize 132 \
  -fill '#3a3aff' -stroke '#3a3aff' -strokewidth 2 -annotate +8-32 'LIVE.AND.DIE' \
  -fill '#ff0000' -stroke black -strokewidth 7 -annotate +0-40 'LIVE.AND.DIE' \
  -stroke none -annotate +0-40 'LIVE.AND.DIE' \
  -font $F -pointsize 46 -fill '#ff0000' -stroke black -strokewidth 3 -annotate +0+62 'P R O D U C T I O N S' -stroke none -annotate +0+62 'P R O D U C T I O N S' \
  -font Courier-Bold -pointsize 26 -fill '#7272ff' -annotate +0+150 'MUSIC · VIDEO · VISUAL ART · COMMISSIONS FROM $25' \
  -pointsize 24 -fill '#e04848' -annotate +0+212 'liveanddie.xyz' \
  -strip -define png:compression-level=9 img/og.png
