#!/usr/bin/env bash
# Run on the VPS after uploading sources (frontend/dist is gitignored — must build here).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm install (backend)"
npm install

echo "==> npm install + build (frontend → frontend/dist)"
cd frontend
npm install
npm run build
cd ..

echo "==> nest build (backend → dist/)"
npm run build

echo "==> Done. Restart your process (e.g. pm2 restart capy-api)."
echo "    Nginx root should point to: $ROOT/frontend/dist"
