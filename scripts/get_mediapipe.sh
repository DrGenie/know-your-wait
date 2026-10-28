#!/usr/bin/env bash
# Optional: serve the camera's face reader from your own site instead of jsDelivr and Google.
# Run from the repository root. Needs npm and curl. Adds about 22 MB to vendor/mediapipe/.
set -euo pipefail
VER=0.10.14
OUT=vendor/mediapipe
mkdir -p "$OUT/wasm"
TMP=$(mktemp -d)
(cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VER" >/dev/null && tar xzf mediapipe-tasks-vision-$VER.tgz)
cp "$TMP/package/vision_bundle.mjs" "$OUT/"
cp "$TMP"/package/wasm/* "$OUT/wasm/"
curl -fL -o "$OUT/face_landmarker.task" \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
rm -rf "$TMP"
echo "Done. The tool will now load the face reader from $OUT/."
