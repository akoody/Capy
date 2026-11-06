#!/usr/bin/env bash
# Запуск на сервере из корня проекта (рядом с frontend/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Исходник VoiceAssistantFAB"
test -f frontend/src/components/VoiceAssistantFAB.tsx && echo OK || { echo FAIL; exit 1; }

echo "=== 2. В собранном JS есть /assistant/voice"
if compgen -G "$ROOT/frontend/dist/assets/"*.js > /dev/null; then
  if grep -l 'assistant/voice' "$ROOT/frontend/dist/assets/"*.js >/dev/null 2>&1; then
    echo OK
  else
    echo "FAIL: в dist нет строки assistant/voice — пересобери: cd frontend && npm run build"
    exit 1
  fi
else
  echo "FAIL: нет frontend/dist/assets/*.js — выполни: cd frontend && npm run build"
  exit 1
fi

echo "=== 3. Абсолютный путь к dist (сверь с root в nginx)"
readlink -f "$ROOT/frontend/dist"

echo "=== Готово. В приложении: Настройки — внизу строка build: … должна совпасть со временем последней сборки."
