#!/bin/sh
# Writes the reduced copies (<name>-half.webp, <name>-quarter.webp) of the large single photographs that lower graphics
# tiers load instead (see dist/texture-lod.js). Run it after regenerating any of them; needs cwebp and webpinfo.
set -e
cd "$(dirname "$0")/../dist"
for photo in roof-aerial-2025 roof-aerial-wide-2025 ground-overview ground-overview-outer; do
 size=$(webpinfo "$photo.webp" 2>/dev/null | awk '/Width:/{w=$2}/Height:/{h=$2}END{print w" "h}')
 set -- $size
 for level in half:2 quarter:4; do
  name=${level%:*} d=${level#*:}
  cwebp -quiet -q 82 -m 6 -resize $(( ($1+d-1)/d )) $(( ($2+d-1)/d )) "$photo.webp" -o "$photo-$name.webp"
  echo "$photo-$name.webp $(( ($1+d-1)/d ))x$(( ($2+d-1)/d )) $(( $(wc -c <"$photo-$name.webp") / 1024 )) KiB"
 done
done
