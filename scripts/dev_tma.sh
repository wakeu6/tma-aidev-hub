#!/usr/bin/env bash
# ==============================================================================
# AI Dev Hub: Запуск FastAPI бэкенда и aiogram бота с Hot-Reload (macOS / Linux)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "========================================================"
echo "⚡ Запуск Telegram Mini App & Bot в Mock/Dev режиме"
echo "========================================================"

# Активация виртуального окружения
if [ -d "$ROOT_DIR/.venv" ]; then
    echo "✓ Активация виртуального окружения .venv..."
    source "$ROOT_DIR/.venv/bin/activate"
elif [ -d "$ROOT_DIR/venv" ]; then
    source "$ROOT_DIR/venv/bin/activate"
fi

# Проверка наличия .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "⚠ Файл .env не найден, копирование из .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

# Функция очистки дочерних процессов при выходе
cleanup() {
    echo ""
    echo "🛑 Остановка процессов dev-сервера..."
    kill "$BACKEND_PID" "$BOT_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$BOT_PID" 2>/dev/null || true
    echo "✓ Все сервисы остановлены."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Запуск FastAPI бэкенда с hot-reload
echo "🚀 [1/2] Запуск FastAPI на http://localhost:8000..."
python -m uvicorn tma_service.backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Небольшая пауза для инициализации базы данных
sleep 1.5

# 3. Запуск aiogram 3 бота
echo "🤖 [2/2] Запуск Telegram-бота..."
python -m tma_service.bot.bot &
BOT_PID=$!

echo ""
echo "========================================================"
echo "✨ Сервисы успешно запущены!"
echo "• Веб-интерфейс TMA (браузер): http://localhost:8000"
echo "• API документация Swagger:     http://localhost:8000/docs"
echo "• Нажмите Ctrl+C для остановки"
echo "========================================================"

# Ожидание завершения процессов
wait "$BACKEND_PID" "$BOT_PID"
