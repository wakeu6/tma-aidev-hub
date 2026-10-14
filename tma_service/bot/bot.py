import os
import sys
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.types import MenuButtonWebApp, WebAppInfo
from .handlers import router

from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

TG_BOT_TOKEN = os.environ.get("TG_BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "http://localhost:8000")
TG_PROXY = os.environ.get("TG_PROXY", "")

async def run_bot():
    if not TG_BOT_TOKEN or TG_BOT_TOKEN == "mock_bot_token" or "your_bot_token" in TG_BOT_TOKEN:
        print("[Telegram Bot] Внимание: TG_BOT_TOKEN не задан в .env. Бот в режиме ожидания токена.")
        while True:
            await asyncio.sleep(3600)
        return

    session = None
    if TG_PROXY:
        session = AiohttpSession(proxy=TG_PROXY)

    bot = Bot(
        token=TG_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        session=session,
    )
    dp = Dispatcher()
    dp.include_router(router)

    print("[Telegram Bot] Подключение к Telegram API...")

    while True:
        try:
            me = await bot.get_me()
            print(f"[Telegram Bot] [OK] Бот @{me.username} успешно авторизован!")

            # Настройка меню-кнопки WebApp в Telegram
            if WEBAPP_URL and WEBAPP_URL.startswith("https://"):
                try:
                    await bot.set_chat_menu_button(
                        menu_button=MenuButtonWebApp(
                            text="🚀 Открыть AI App",
                            web_app=WebAppInfo(url=WEBAPP_URL),
                        )
                    )
                    print(f"[Telegram Bot] [OK] Меню-кнопка бота привязана к {WEBAPP_URL}")
                except Exception as mb_err:
                    print(f"[Telegram Bot] Предупреждение: не удалось установить меню-кнопку: {mb_err}")

            print(f"[Telegram Bot] Слушаем входящие сообщения в Telegram...")
            await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
            break
        except Exception as e:
            print(f"[Telegram Bot] Ошибка соединения с Telegram API: {e}", file=sys.stderr)
            print("[Telegram Bot] Ожидание связи (10 сек)... Если Telegram блокируется провайдером, включите VPN.", file=sys.stderr)
            await asyncio.sleep(10)

if __name__ == "__main__":
    try:
        asyncio.run(run_bot())
    except (KeyboardInterrupt, SystemExit):
        print("[Telegram Bot] Остановка бота.")
