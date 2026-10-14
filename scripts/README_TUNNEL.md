# 🌐 Руководство: Проброс туннеля через Cloudflare Tunnel для тестирования TMA

Для тестирования Telegram Mini App на реальном смартфоне внутри официального клиента Telegram необходим публичный защищенный **HTTPS**-адрес, доступный из глобальной сети.

Бесплатный и надежный инструмент для этого — **Cloudflare Tunnel (cloudflared)** (не требует регистрации и белого IP).

---

## 1. Установка cloudflared

### macOS (Homebrew):
```bash
brew install cloudflared
```

### Windows (winget / scoop):
```powershell
winget install Cloudflare.cloudflared
```

### Linux (Ubuntu/Debian):
```bash
sudo apt-get install cloudflared
```

---

## 2. Запуск локального туннеля

1. Запустите бэкенд и бота через единый скрипт:
   - **macOS / Linux**: `./scripts/dev_tma.sh`
   - **Windows**: `.\scripts\dev_tma.ps1`
   
   Сервер запустится на порту `8000`.

2. Во втором окне терминала запустите проброс туннеля:
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```

3. В выводе консоли найдите выданный публичный HTTPS-адрес вида:
   ```text
   +-----------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some    |
   |  time to be reachable):                                               |
   |  https://unique-subdomain.trycloudflare.com                           |
   +-----------------------------------------------------------------------+
   ```

---

## 3. Привязка к Telegram Mini App

1. Скопируйте полученный адрес: `https://unique-subdomain.trycloudflare.com`.
2. Откройте файл `.env` в корне проекта и обновите переменную `WEBAPP_URL`:
   ```env
   WEBAPP_URL="https://unique-subdomain.trycloudflare.com"
   ```
3. *(Когда зарегистрируете бота в @BotFather)*:
   - Перейдите в [@BotFather](https://t.me/BotFather) в Telegram.
   - Выберите команду `/mybots` -> выберите вашего бота -> **Bot Settings** -> **Menu Button** -> **Configure menu button**.
   - Отправьте ссылку на ваш туннель: `https://unique-subdomain.trycloudflare.com`.
   - Теперь кнопка запуска Mini App появится прямо в строке ввода сообщений бота!

---

## 4. Альтернатива: ngrok

Если вы предпочитаете ngrok:
```bash
ngrok http 8000
```
Скопируйте выданный `https://xxxx.ngrok-free.app` в `.env` в переменную `WEBAPP_URL`.

---

## 5. Тестирование из браузера (Mock Mode)

Если вы разрабатываете и тестируете интерфейс без смартфона и Telegram:
- Просто откройте в Chrome/Safari: `http://localhost:8000`
- При `DEBUG_MOCK=True` автоматически подключится Dev-панель:
  - Эмулятор просмотра рекламы Adsgram (5 сек)
  - Тестирование начисления баллов (+100 PTS)
  - Проверка серверного кулдауна (30 сек)
  - Переключение между 3 тестовыми пользователями для проверки реферальной системы
