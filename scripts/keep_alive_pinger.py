#!/usr/bin/env python3
"""
AI Dev Hub - Render 24/7 Keep-Alive Pinger
------------------------------------------
Отправляет HTTP GET/HEAD запросы к облачному сервису Render (tma-aidev-hub.onrender.com)
каждые 7 минут, предотвращая переход бесплатного инстанса в спящий режим (15-минутный spin-down).
"""

import sys
import time
import urllib.request
import urllib.error
import json
from datetime import datetime

TARGET_URLS = [
    "https://tma-aidev-hub.onrender.com/health",
    "https://tma-aidev-hub.onrender.com/ping",
    "https://tma-aidev-hub.onrender.com/api/users/leaderboard",
]

PING_INTERVAL_SECONDS = 420  # 7 минут (гарантированно меньше 15 минут)

def log(msg: str):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

def ping_endpoint(url: str) -> bool:
    start_time = time.time()
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "KeepAlivePinger/2.0 (Render Anti-Sleep Daemon)",
                "Accept": "*/*",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            latency_ms = int((time.time() - start_time) * 1000)
            status_code = response.getcode()
            body = response.read().decode("utf-8", errors="ignore")
            
            # Краткий предпросмотр ответа
            summary = body[:80].replace("\n", " ").strip()
            log(f"[OK] {url} -> HTTP {status_code} ({latency_ms}ms) | {summary}")
            return True
    except urllib.error.HTTPError as e:
        latency_ms = int((time.time() - start_time) * 1000)
        log(f"[WARN] {url} -> HTTP {e.code} ({latency_ms}ms) - {e.reason}")
        return False
    except urllib.error.URLError as e:
        log(f"[FAIL] {url} -> Ошибка сети / таймаут: {e.reason}")
        return False
    except Exception as e:
        log(f"[ERROR] {url} -> Неожиданная ошибка: {e}")
        return False

def main():
    log("==================================================")
    log("  AI Dev Hub • Keep-Alive Pinger запущен")
    log(f"  Интервал опроса: {PING_INTERVAL_SECONDS // 60} минут ({PING_INTERVAL_SECONDS} сек)")
    log(f"  Целевой хост: https://tma-aidev-hub.onrender.com")
    log("==================================================")

    iteration = 1
    while True:
        log(f"\n--- Итерация #{iteration} ---")
        success_count = 0
        
        for url in TARGET_URLS:
            if ping_endpoint(url):
                success_count += 1
            time.sleep(1)  # 1 сек между эндпоинтами

        if success_count > 0:
            log(f"Сервер бодрствует! ({success_count}/{len(TARGET_URLS)} эндпоинтов ответили 200 OK)")
        else:
            log("Внимание: Ни один эндпоинт не ответил. Повтор через 30 секунд...")
            time.sleep(30)
            continue

        iteration += 1
        log(f"Следующий пинг через {PING_INTERVAL_SECONDS // 60} мин. Сервер не уснет...")
        time.sleep(PING_INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Остановка Keep-Alive Pinger по сигналу пользователя.")
        sys.exit(0)
