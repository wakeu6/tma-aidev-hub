import os
from aiogram import Router, F
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from sqlalchemy import select
from ..backend.database import AsyncSessionLocal
from ..backend.models import User, Referral
from .messages import (
    WELCOME_MESSAGE,
    WELCOME_REFERRAL_BONUS,
    HELP_MESSAGE,
    NEW_REFERRAL_NOTIFICATION,
)

router = Router()

WEBAPP_URL = os.environ.get("WEBAPP_URL", "http://localhost:8000")

def get_webapp_keyboard() -> InlineKeyboardMarkup:
    """Генерирует инлайн-клавиатуру для запуска Mini App."""
    webapp_url = os.environ.get("WEBAPP_URL", "http://localhost:8000")
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть Mini App & Фармить",
                    web_app=WebAppInfo(url=webapp_url),
                )
            ],
            [
                InlineKeyboardButton(
                    text="📢 Наш Канал с кодом",
                    url="https://t.me/telegram",
                )
            ],
        ]
    )

@router.message(CommandStart())
async def handle_start(message: Message, command: CommandObject):
    tg_user = message.from_user
    args = command.args or ""
    referrer_bonus_applied = False

    async with AsyncSessionLocal() as db:
        # Поиск существующего пользователя
        stmt = select(User).where(User.tg_id == tg_user.id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            # Новый пользователь
            referred_by_id = None

            # Проверка реферального кода (start=ref_xxxx)
            if args.startswith("ref_"):
                ref_code = args[4:].strip()
                ref_stmt = select(User).where(User.referral_code == ref_code)
                ref_res = await db.execute(ref_stmt)
                referrer = ref_res.scalar_one_or_none()

                if referrer and referrer.tg_id != tg_user.id:
                    referred_by_id = referrer.tg_id
                    referrer.balance += 250 # Бонус пригласившему

                    # Создаем запись реферала
                    new_ref = Referral(
                        referrer_id=referrer.tg_id,
                        referee_id=tg_user.id,
                        bonus_awarded=250,
                    )
                    db.add(new_ref)
                    referrer_bonus_applied = True

                    # Отправляем уведомление пригласившему
                    try:
                        await message.bot.send_message(
                            chat_id=referrer.tg_id,
                            text=NEW_REFERRAL_NOTIFICATION.format(
                                username=f"@{tg_user.username}" if tg_user.username else tg_user.first_name
                            ),
                            parse_mode="HTML",
                        )
                    except Exception:
                        pass

            # Создание нового пользователя
            initial_balance = 200 if referrer_bonus_applied else 100
            user = User(
                tg_id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                balance=initial_balance,
                referred_by=referred_by_id,
            )
            db.add(user)
            await db.commit()
        else:
            # Обновление юзернейма при повторном визите
            if user.username != tg_user.username:
                user.username = tg_user.username
                await db.commit()

    text = WELCOME_MESSAGE
    if referrer_bonus_applied:
        text = WELCOME_REFERRAL_BONUS + "\n" + text

    await message.answer(
        text=text,
        reply_markup=get_webapp_keyboard(),
        parse_mode="HTML",
    )

@router.message(Command("help"))
async def handle_help(message: Message):
    await message.answer(
        text=HELP_MESSAGE,
        reply_markup=get_webapp_keyboard(),
        parse_mode="HTML",
    )
