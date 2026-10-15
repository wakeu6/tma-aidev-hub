import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from ..database import get_db
from ..models import User, Referral
from ...bot.messages import WELCOME_MESSAGE, HELP_MESSAGE

router = APIRouter(prefix="/api/bot", tags=["Telegram Bot Webhook"])

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Высокопроизводительный вебхук для Telegram Bot API.
    Обрабатывает входящие команды (/start, /help, /news, /profile, реферальные ссылки, callback кнопки)
    и отвечает мгновенно в теле HTTP-ответа (Webhook Reply Method).
    Работает со 100% аптаймом без необходимости исходящего long polling.
    """
    try:
        data = await request.json()
    except Exception:
        return {"ok": True}

    callback_query = data.get("callback_query")
    message = data.get("message")

    if callback_query:
        chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
        from_user = callback_query.get("from", {})
        data_action = callback_query.get("data", "")
        if data_action == "cmd_news":
            text = "/news"
        elif data_action == "cmd_profile":
            text = "/profile"
        else:
            text = "/start"
    elif message:
        chat_id = message.get("chat", {}).get("id")
        from_user = message.get("from", {})
        text = (message.get("text") or "").strip()
    else:
        return {"ok": True}

    if not chat_id or not from_user:
        return {"ok": True}

    tg_id = from_user.get("id")
    username = from_user.get("username")
    first_name = from_user.get("first_name", "")

    from dotenv import dotenv_values
    from pathlib import Path
    env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    config = dotenv_values(env_path) if env_path.exists() else {}
    webapp_url = config.get("WEBAPP_URL") or os.environ.get("WEBAPP_URL") or "https://tma-aidev-hub.onrender.com"
    if "lhr.life" in webapp_url or "localhost" in webapp_url or "loca.lt" in webapp_url:
        webapp_url = "https://tma-aidev-hub.onrender.com"

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "⚡ Открыть AI Dev Shop (100 ₽ / PTS)",
                    "web_app": {"url": webapp_url}
                }
            ],
            [
                {
                    "text": "📰 AI Новости",
                    "callback_data": "cmd_news"
                },
                {
                    "text": "👤 Мой профиль",
                    "callback_data": "cmd_profile"
                }
            ]
        ]
    }

    # Обработка команды /start
    if text.startswith("/start"):
        args = text[7:].strip()
        referrer_bonus = False

        # Поиск или создание пользователя в базе данных
        stmt = select(User).where(User.tg_id == tg_id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            referred_by = None
            if args.startswith("ref_"):
                ref_code = args[4:].strip()
                ref_stmt = select(User).where(User.referral_code == ref_code)
                ref_res = await db.execute(ref_stmt)
                referrer = ref_res.scalar_one_or_none()

                if referrer and referrer.tg_id != tg_id:
                    referred_by = referrer.tg_id
                    referrer.balance += 250
                    new_ref = Referral(referrer_id=referrer.tg_id, referee_id=tg_id, bonus_awarded=250)
                    db.add(new_ref)
                    referrer_bonus = True

            init_balance = 200 if referrer_bonus else 100
            user = User(
                tg_id=tg_id,
                username=username,
                first_name=first_name,
                balance=init_balance,
                referred_by=referred_by,
            )
            db.add(user)
            await db.commit()
        else:
            if user.username != username:
                user.username = username
                await db.commit()

        welcome_text = WELCOME_MESSAGE
        if referrer_bonus:
            welcome_text = "🎉 <b>Вам начислен приветственный бонус +100 PTS по реферальной ссылке!</b>\n\n" + welcome_text

        return {
            "method": "sendMessage",
            "chat_id": chat_id,
            "text": welcome_text,
            "parse_mode": "HTML",
            "reply_markup": reply_markup,
        }

    # Обработка команды /news или /digest
    if text.startswith("/news") or text.startswith("/digest"):
        from ..models import NewsPost
        stmt_news = select(NewsPost).order_by(desc(NewsPost.created_at)).limit(3)
        res_news = await db.execute(stmt_news)
        posts = res_news.scalars().all()

        news_text = "📰 <b>Свежий AI Дайджест и Тренды Shorts:</b>\n\n"
        for p in posts:
            news_text += f"<b>{p.title}</b>\n{p.summary}\n\n"
        news_text += "👉 <i>Все исходники и шаблоны доступны в нашем маркете!</i>"

        return {
            "method": "sendMessage",
            "chat_id": chat_id,
            "text": news_text,
            "parse_mode": "HTML",
            "reply_markup": reply_markup,
        }

    # Обработка команды /profile
    if text.startswith("/profile"):
        stmt = select(User).where(User.tg_id == tg_id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        balance = user.balance if user else 100
        ref_code = user.referral_code if user else "ref"

        ref_stmt = select(func.count(Referral.id)).where(Referral.referrer_id == tg_id)
        ref_res = await db.execute(ref_stmt)
        ref_count = ref_res.scalar() or 0

        profile_text = f"""
👤 <b>Ваш профиль:</b>

• Имя: <b>{first_name}</b>
• Баланс: <b>{balance} PTS</b>
• Приглашено друзей: <b>{ref_count} чел.</b>
• Заработано на рефералах: <b>{ref_count * 250} PTS</b>

🔗 <b>Ваша реферальная ссылка:</b>
<code>https://t.me/aidev_shorts_bot?start=ref_{ref_code}</code>

<i>Делитесь ссылкой с коллегами: они получат 100 PTS, а вы — 250 PTS за каждого!</i>
"""
        return {
            "method": "sendMessage",
            "chat_id": chat_id,
            "text": profile_text,
            "parse_mode": "HTML",
            "reply_markup": reply_markup,
        }

    # Обработка команды /help
    if text.startswith("/help"):
        return {
            "method": "sendMessage",
            "chat_id": chat_id,
            "text": HELP_MESSAGE,
            "parse_mode": "HTML",
            "reply_markup": reply_markup,
        }

    # Любое другое сообщение — отправляем кнопку открытия WebApp
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": f"Привет, <b>{first_name}</b>!\n\nНажми кнопку ниже, чтобы открыть маркет, фармить поинты и забирать готовые материалы всего за 100 ₽ или бесплатно за PTS:",
        "parse_mode": "HTML",
        "reply_markup": reply_markup,
    }
