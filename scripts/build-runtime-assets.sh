#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/assets/runtime"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install it with: brew install webp" >&2
  exit 1
fi

mkdir -p "$RUNTIME/card-art" "$RUNTIME/sprites" "$RUNTIME/backgrounds"

encode_webp() {
  local source="$1"
  local target="$2"
  local width="$3"
  local quality="$4"
  local temp="$target.tmp.webp"
  cwebp -quiet -mt -m 4 -q "$quality" -resize "$width" 0 "$source" -o "$temp"
  mv "$temp" "$target"
}

while IFS= read -r relative; do
  name="$(basename "${relative%.*}")"
  encode_webp "$ROOT/$relative" "$RUNTIME/card-art/$name.webp" 320 82
done < <(rg -o 'assets/card-art/[^" ]+\.jpg' "$ROOT/index.html" | sort -u)

while IFS= read -r source; do
  name="$(basename "${source%.*}")"
  encode_webp "$source" "$RUNTIME/sprites/$name.webp" 512 84
done < <(find "$ROOT/assets/sprites" -type f -name '*.png' | sort)

while IFS= read -r source; do
  name="$(basename "${source%.*}")"
  encode_webp "$source" "$RUNTIME/backgrounds/$name.webp" 1600 80
done < <(find "$ROOT/assets/backgrounds" -type f -name '*.jpg' | sort)

echo "Runtime assets built in $RUNTIME"
