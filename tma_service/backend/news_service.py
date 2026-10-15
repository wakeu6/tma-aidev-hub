"""
AI Dev Hub - Automated Tech & AI News Engine
---------------------------------------------
Генерирует и доставляет свежие тренды из мира нейросетей, YouTube Shorts,
кодинга и Telegram-экосистемы.
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from .models import NewsPost

DEFAULT_NEWS_POSTS = [
    {
        "title": "🚀 Релиз Claude 3.7 Sonnet: Прорыв в генерации чистого кода",
        "summary": "Anthropic представили гибридную архитектуру мышления. Модель способна решать сложнейшие архитектурные задачи без галлюцинаций и писать полноценные микросервисы за один запрос. В нашем маркете уже доступен обновленный .cursorrules под эту модель!",
        "source_tag": "🔥 AI Прорыв",
        "url": "https://t.me/aidev_shorts_bot",
    },
    {
        "title": "🎬 Новые алгоритмы YouTube Shorts: x5 охватов за удержание >80%",
        "summary": "YouTube перестроил ранжирование вертикальных видео. Ролики с динамичным саунд-дизайном и кинетическими субтитрами получают в 5 раз больше показов в ленте рекомендаций. Используйте готовые хуки из нашего каталога для взрывного старта.",
        "source_tag": "📈 Shorts Тренды",
        "url": "https://t.me/aidev_shorts_bot",
    },
    {
        "title": "⚡ Cursor IDE + Background Agents: Автономная разработка",
        "summary": "В свежем апдейте Cursor появилась возможность запускать фоновых агентов, которые на лету проверяют типы, пишут юнит-тесты и оптимизируют запросы к базе данных. Эпоха ручного написания бойлерплейта официально завершена.",
        "source_tag": "🛠 Инструменты",
        "url": "https://t.me/aidev_shorts_bot",
    },
    {
        "title": "💎 Telegram Mini Apps бьют рекорды монетизации",
        "summary": "Аудитория Telegram WebApp превысила 500 млн активных пользователей в месяц. Форматы вознаграждаемой рекламы (Rewarded Ads) показывают средний CPM выше 2.5$, что делает Mini Apps самым прибыльным каналом монетизации трафика.",
        "source_tag": "💰 WebApp Экосистема",
        "url": "https://t.me/aidev_shorts_bot",
    },
    {
        "title": "🤖 Связка Edge-TTS + Remotion: Фабрика контента без лица",
        "summary": "Создатели контента переходят на полностью автономные воронки. Скрипт на Python генерирует сценарий, синтезирует голос и собирает готовый MP4 за 40 секунд. Готовые исходники пайплайна можно забрать в нашем маркетплейсе всего за 100 ₽ или баллы.",
        "source_tag": "⚡ Автоматизация",
        "url": "https://t.me/aidev_shorts_bot",
    },
]

async def seed_news(db: AsyncSession):
    """Инициализирует базовые актуальные новости при старте сервера."""
    for n in DEFAULT_NEWS_POSTS:
        stmt = select(NewsPost).where(NewsPost.title == n["title"])
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            post = NewsPost(**n)
            db.add(post)
    await db.commit()

async def get_latest_news(db: AsyncSession, limit: int = 10):
    stmt = select(NewsPost).order_by(desc(NewsPost.created_at)).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()
