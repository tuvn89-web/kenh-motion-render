#!/usr/bin/env bash
# Chép code lõi từ repo riêng tư (nhánh render-may) sang thư mục repo công khai, bỏ nội dung tập.
# Dùng: dong_bo.sh <thư mục kenh-motion> <thư mục kenh-motion-render> <rieng-tu.txt>
set -euo pipefail
SRC=$1; DST=$2; LIST=$3
find "$DST" -mindepth 1 -maxdepth 1 ! -name .git ! -name .github -exec rm -rf {} +
git -C "$SRC" ls-files -z | while IFS= read -r -d '' f; do
  skip=0
  while IFS= read -r p; do
    [[ -z "$p" || "$p" == \#* ]] && continue
    if [[ "$f" == "$p" || "$f" == "$p"/* ]] || [[ "$f" == $p ]]; then skip=1; break; fi
  done < "$LIST"
  [[ $skip == 1 ]] && continue
  mkdir -p "$DST/$(dirname "$f")"; cp "$SRC/$f" "$DST/$f"
done
cp "$LIST" "$DST/cloud/rieng-tu.txt"
