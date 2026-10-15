import os
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl, unquote
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .models import User

DEBUG_MOCK = os.environ.get("DEBUG_MOCK", "True").lower() in ("true", "1", "yes")
DEFAULT_BOT_TOKEN = "8336319196:AAH3Hm_WRQOP3b1uhl-O4aV0blbvZCDCk0s"
TG_BOT_TOKEN = os.environ.get("TG_BOT_TOKEN") or DEFAULT_BOT_TOKEN

def validate_telegram_init_data(init_data: str, bot_token: str) -> Optional[Dict[str, Any]]:
    """
    Криптографическая верификация HMAC-SHA256 Telegram Mini App initData.
    Возвращает словарь данных пользователя при успехе, иначе None.
    """
    if not init_data:
        return None

    try:
        parsed_data = dict(parse_qsl(init_data, keep_blank_values=True))
        if "hash" not in parsed_data:
            return None

        received_hash = parsed_data.pop("hash")

        # Проверка срока действия (до 7 суток для сохранения долгоживущих сессий WebApp)
        if "auth_date" in parsed_data:
            auth_date = int(parsed_data["auth_date"])
            if time.time() - auth_date > 86400 * 7:
                print("[Auth] Предупреждение: initData устарела (> 7 дней)")
                return None

        # Формирование data_check_string
        data_check_arr = [f"{k}={v}" for k, v in sorted(parsed_data.items())]
        data_check_string = "\n".join(data_check_arr)

        # secret_key = HMAC_SHA256("WebAppData", bot_token)
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

        if hmac.compare_digest(computed_hash, received_hash):
            user_raw = parsed_data.get("user")
            if user_raw:
                return json.loads(unquote(user_raw))
            return parsed_data
        else:
            print("[Auth] Несовпадение HMAC хэша initData")
    except Exception as e:
        print(f"[Auth] Ошибка верификации initData: {e}")
        return None

    return None

async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_telegram_init_data: Optional[str] = Header(None, alias="X-Telegram-Init-Data"),
    x_telegram_user_id: Optional[str] = Header(None, alias="X-Telegram-User-Id"),
    x_telegram_username: Optional[str] = Header(None, alias="X-Telegram-Username"),
    x_telegram_first_name: Optional[str] = Header(None, alias="X-Telegram-First-Name"),
    x_mock_user_id: Optional[str] = Header(None, alias="X-Mock-User-Id"),
    x_mock_username: Optional[str] = Header(None, alias="X-Mock-Username"),
    x_mock_first_name: Optional[str] = Header(None, alias="X-Mock-First-Name"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI зависимость аутентификации пользователя.
    1. Авторизует реальных пользователей Telegram через HMAC SHA256 подпись initData.
    2. При наличии Telegram WebApp User-Id заголовков синхронизирует профиль Telegram.
    3. При внешних запросах (модерация Adsgram, браузер, тест) предоставляет
       бесшовный гостевой аккаунт Adsgram Reviewer с балансом для проверки маркетплейса.
    Никогда не блокирует интерфейс ошибкой 401.
    """
    # Санитизация заголовков (гарантия строкового типа)
    auth_str = authorization if isinstance(authorization, str) else None
    init_data_str = x_telegram_init_data if isinstance(x_telegram_init_data, str) else None
    tg_user_id_str = x_telegram_user_id if isinstance(x_telegram_user_id, str) else None
    tg_username_str = x_telegram_username if isinstance(x_telegram_username, str) else None
    tg_first_name_str = x_telegram_first_name if isinstance(x_telegram_first_name, str) else None
    mock_id_str = x_mock_user_id if isinstance(x_mock_user_id, str) else None
    mock_username_str = x_mock_username if isinstance(x_mock_username, str) else None
    mock_first_name_str = x_mock_first_name if isinstance(x_mock_first_name, str) else None

    # Извлечение initData из заголовков
    init_data = init_data_str
    if not init_data and auth_str and auth_str.startswith("tma "):
        init_data = auth_str[4:].strip()

    user_info = None

    # 1. Попытка валидной криптографической проверки Telegram initData
    if init_data and TG_BOT_TOKEN:
        user_info = validate_telegram_init_data(init_data, TG_BOT_TOKEN)

    # 2. Если initData не вернула данные, но Telegram WebApp передал заголовки пользователя
    if not user_info and tg_user_id_str and tg_user_id_str.isdigit():
        clean_first_name = unquote(tg_first_name_str) if tg_first_name_str else "Telegram User"
        clean_username = unquote(tg_username_str) if tg_username_str else None
        user_info = {
            "id": int(tg_user_id_str),
            "username": clean_username,
            "first_name": clean_first_name,
        }

    # 3. Если запрос из Dev Mock панели или внешнего браузера
    if not user_info:
        if mock_id_str and mock_id_str.isdigit():
            mock_tg_id = int(mock_id_str)
            clean_mock_username = unquote(mock_username_str) if mock_username_str else "mock_developer"
            clean_mock_first_name = unquote(mock_first_name_str) if mock_first_name_str else "Dev Tester"
            user_info = {
                "id": mock_tg_id,
                "username": clean_mock_username,
                "first_name": clean_mock_first_name,
            }
        else:
            # Дефолтный профиль для модераторов Adsgram и внешних веб-посетителей
            user_info = {
                "id": 100000001,
                "username": "adsgram_reviewer",
                "first_name": "Adsgram Reviewer",
            }

    tg_id = user_info.get("id") or 100000001

    # Получение или создание пользователя в базе данных SQLite
    stmt = select(User).where(User.tg_id == tg_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Для модератора даем 500 PTS чтобы сразу протестировать покупку в маркетплейсе
        initial_balance = 500 if tg_id == 100000001 else 100
        user = User(
            tg_id=tg_id,
            username=user_info.get("username"),
            first_name=user_info.get("first_name", "User"),
            balance=initial_balance,
        )
        try:
            db.add(user)
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()
            stmt_retry = select(User).where(User.tg_id == tg_id)
            res_retry = await db.execute(stmt_retry)
            user = res_retry.scalar_one_or_none()
    elif tg_id == 100000001 and user.balance < 400:
        user.balance = 500
        await db.commit()
        await db.refresh(user)

    return user
