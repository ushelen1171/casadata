#!/bin/bash
# serve.sh — поднять локальный HTTP-сервер и открыть сайт в браузере.
# Использование:
#   ./serve.sh         — поднять сервер (если не запущен) и открыть в браузере
#   ./serve.sh stop    — остановить
#   ./serve.sh status  — проверить состояние
#   ./serve.sh -h      — справка

set -eu

PORT=8765
URL="http://localhost:$PORT/"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="/tmp/casa-serve.log"

cmd="${1:-start}"

case "$cmd" in
  -h|--help|help)
    sed -n '2,8p' "$0" | sed 's/^# //; s/^#//'
    exit 0
    ;;

  status)
    pid=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "✓ Сервер работает на $URL (PID $pid)"
    else
      echo "✗ Сервер не запущен"
    fi
    exit 0
    ;;

  stop)
    pid=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      echo "✓ Остановлен (PID $pid)"
    else
      echo "Нечего останавливать — порт $PORT свободен"
    fi
    exit 0
    ;;

  start|"")
    cd "$DIR"
    pid=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "✓ Сервер уже работает (PID $pid)"
    else
      echo "→ Поднимаю сервер на $URL"
      python3 -m http.server "$PORT" > "$LOG" 2>&1 &
      sleep 0.5
      pid=$(lsof -ti:"$PORT" 2>/dev/null || true)
      if [ -z "$pid" ]; then
        echo "✗ Не удалось запустить. Лог: $LOG"
        exit 1
      fi
      echo "✓ Запущен (PID $pid). Лог: $LOG"
    fi
    open "$URL"
    echo "→ Открыто в браузере: $URL"
    echo ""
    echo "Остановить: ./serve.sh stop"
    ;;

  *)
    echo "Неизвестная команда: $cmd"
    echo "Используй: ./serve.sh [start|stop|status|help]"
    exit 1
    ;;
esac
