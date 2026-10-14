import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DateTime, ForeignKey, func, select
from sqlalchemy.orm import relationship
from .database import Base

def generate_ref_code():
    return secrets.token_hex(4)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tg_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(64), nullable=True)
    first_name = Column(String(128), nullable=True)
    balance = Column(Integer, default=0, nullable=False)
    referral_code = Column(String(32), unique=True, index=True, default=generate_ref_code, nullable=False)
    referred_by = Column(BigInteger, nullable=True)
    last_reward_claimed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ad_logs = relationship("AdImpressionLog", back_populates="user", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "tg_id": self.tg_id,
            "username": self.username,
            "first_name": self.first_name,
            "balance": self.balance,
            "referral_code": self.referral_code,
            "referred_by": self.referred_by,
            "last_reward_claimed_at": self.last_reward_claimed_at.isoformat() if self.last_reward_claimed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class AdImpressionLog(Base):
    __tablename__ = "ad_impression_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tg_id = Column(BigInteger, index=True, nullable=False)
    reward_points = Column(Integer, default=100, nullable=False)
    provider = Column(String(32), default="adsgram_sdk", nullable=False)
    transaction_id = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=True)
    status = Column(String(32), default="COMPLETED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="ad_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tg_id": self.tg_id,
            "reward_points": self.reward_points,
            "provider": self.provider,
            "transaction_id": self.transaction_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    referrer_id = Column(BigInteger, index=True, nullable=False)
    referee_id = Column(BigInteger, unique=True, index=True, nullable=False)
    bonus_awarded = Column(Integer, default=250, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "referrer_id": self.referrer_id,
            "referee_id": self.referee_id,
            "bonus_awarded": self.bonus_awarded,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(32), default="PROMPTS", nullable=False)
    badge = Column(String(32), nullable=True)
    price_pts = Column(Integer, default=400, nullable=False)
    price_stars = Column(Integer, default=100, nullable=False)
    price_rub = Column(Integer, default=190, nullable=False)
    content_payload = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    purchases = relationship("Purchase", back_populates="product")

    def to_dict(self, include_payload: bool = False):
        data = {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "badge": self.badge,
            "price_pts": self.price_pts,
            "price_stars": self.price_stars,
            "price_rub": self.price_rub,
            "is_active": self.is_active,
        }
        if include_payload:
            data["content_payload"] = self.content_payload
        return data

class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tg_id = Column(BigInteger, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    product_slug = Column(String(64), nullable=False)
    payment_method = Column(String(32), default="PTS", nullable=False) # PTS, STARS, SBP, CRYPTO
    amount_paid = Column(Integer, nullable=False)
    currency = Column(String(16), default="PTS", nullable=False)
    status = Column(String(32), default="COMPLETED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="purchases")
    product = relationship("Product", back_populates="purchases")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tg_id": self.tg_id,
            "product_id": self.product_id,
            "product_slug": self.product_slug,
            "payment_method": self.payment_method,
            "amount_paid": self.amount_paid,
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

DEFAULT_PRODUCTS = [
    {
        "slug": "starter-prompts-2026",
        "title": "AI Starter Pack 2026 (.cursorrules + Prompts)",
        "description": "Боевой набор .cursorrules и цепочек промптов под Claude Sonnet 5.5, GPT Astra 6 и Flash 3.8. Снижает галлюцинации и выдает рабочий код с первого запроса.",
        "category": "PROMPTS",
        "badge": "ХИТ • БЕСПЛАТНО ЗА PTS",
        "price_pts": 400,
        "price_stars": 100,
        "price_rub": 190,
        "content_payload": """# AI STARTER PACK 2026

## 1. Golden .cursorrules Template:
```markdown
You are an expert fullstack AI engineer adhering strictly to modern 2026 conventions:
- Strict TypeScript / Python 3.12+ async standards.
- Keep dependencies lean. Never introduce deprecated APIs.
- Write modular, clean code with defensive error boundaries and zero hallucinations.
```

## 2. Meta-Prompt for Code Generation:
"Действуй как Principal Architect. Спроектируй решение в 3 шага: 1) Анализ граничных случаев, 2) Минимальный интерфейс типов, 3) Полная реализация без плейсхолдеров и заглушек."
"""
    },
    {
        "slug": "auto-shorts-engine",
        "title": "Shorts / Reels Automation Engine",
        "description": "Готовый движок генерации вирусных коротких видео: интеграция Human TTS (ElevenLabs + Edge-TTS), кинетические субтитры Remotion, Veo-клипы и воронка удержания.",
        "category": "CODE",
        "badge": "ДЛЯ КРЕАТОРОВ",
        "price_pts": 1500,
        "price_stars": 500,
        "price_rub": 990,
        "content_payload": """# REPOSITORY ACCESS: AUTO SHORTS ENGINE 2026

Доступ к приватному репозиторию движка:
- GitHub: https://github.com/ai-shorts-farm/shorts-engine-private
- Документация: https://docs.aidev.local/shorts-engine
- Ключ активации лицензии: SHORT-FARM-2026-X992B

Инструкция:
1. Клонируй репозиторий: `git clone https://github.com/ai-shorts-farm/shorts-engine-private`
2. Скопируй `.env.example` в `.env`
3. Запусти `npm install` и `npm run dev` для запуска студии Remotion."""
    },
    {
        "slug": "vip-dev-club",
        "title": "VIP AI Dev Club (Доступ на 1 месяц)",
        "description": "Закрытое комьюнити AI-разработчиков и криейторов: еженедельные разборы новых моделей, закрытые стримы, приватные пресеты и прямой контакт с авторами.",
        "category": "VIP",
        "badge": "ПРИВАТНЫЙ КЛУБ",
        "price_pts": 3000,
        "price_stars": 750,
        "price_rub": 1490,
        "content_payload": """# ДОБРО ПОЖАЛОВАТЬ В VIP AI DEV CLUB

Твоя персональная ссылка-приглашение в закрытый канал и чат:
- https://t.me/+AiDev_VIP_PrivateClub_Invite_2026

Инструкция:
1. Перейди по ссылке выше.
2. Бот автоматически одобрит заявку.
3. Закрепи канал в Telegram, чтобы не пропускать закрытые стримы по вторникам."""
    }
]

async def seed_products(session):
    for p_data in DEFAULT_PRODUCTS:
        stmt = select(Product).where(Product.slug == p_data["slug"])
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if not existing:
            prod = Product(**p_data)
            session.add(prod)
    await session.commit()
