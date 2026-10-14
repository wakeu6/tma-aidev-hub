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
TG_BOT_TOKEN = os.environ.get("TG_BOT_TOKEN", "mock_bot_token")

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

        # Проверка срока действия (24 часа)
        if "auth_date" in parsed_data:
            auth_date = int(parsed_data["auth_date"])
            if time.time() - auth_date > 86400: # устарело
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
    except Exception as e:
        print(f"[Auth] Ошибка верификации initData: {e}")
        return None

    return None

async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_telegram_init_data: Optional[str] = Header(None, alias="X-Telegram-Init-Data"),
    x_mock_user_id: Optional[str] = Header(None, alias="X-Mock-User-Id"),
    x_mock_username: Optional[str] = Header(None, alias="X-Mock-Username"),
    x_mock_first_name: Optional[str] = Header(None, alias="X-Mock-First-Name"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI зависимость аутентификации пользователя.
    Поддерживает продакшн HMAC валидацию и удобный локальный Mock-режим.
    """
    # Извлечение initData из заголовков
    init_data = x_telegram_init_data
    if not init_data and authorization and authorization.startswith("tma "):
        init_data = authorization[4:].strip()

    user_info = None

    # 1. Попытка валидной проверки Telegram initData
    if init_data and TG_BOT_TOKEN and TG_BOT_TOKEN != "mock_bot_token":
        user_info = validate_telegram_init_data(init_data, TG_BOT_TOKEN)

    # 2. Если валидация не прошла или запущено в Mock-режиме локально
    if not user_info and DEBUG_MOCK:
        mock_tg_id = int(x_mock_user_id) if x_mock_user_id and x_mock_user_id.isdigit() else 7770001
        mock_username = x_mock_username or "mock_developer"
        mock_first_name = x_mock_first_name or "Dev Tester"
        user_info = {
            "id": mock_tg_id,
            "username": mock_username,
            "first_name": mock_first_name,
        }

    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Неавторизован: недействительные данные Telegram initData или отсутствует сессия",
        )

    tg_id = user_info.get("id")
    if not tg_id:
        raise HTTPException(status_code=400, detail="Отсутствует идентификатор пользователя (id)")

    # Получение или создание пользователя в базе данных SQLite
    stmt = select(User).where(User.tg_id == tg_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            tg_id=tg_id,
            username=user_info.get("username"),
            first_name=user_info.get("first_name", "User"),
            balance=100, # Приветственный бонус
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
