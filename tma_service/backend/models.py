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

class NewsPost(Base):
    __tablename__ = "news_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    summary = Column(Text, nullable=False)
    source_tag = Column(String(64), default="AI Trends", nullable=False)
    url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "source_tag": self.source_tag,
            "url": self.url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

DEFAULT_PRODUCTS = [
    {
        "slug": "viral-shorts-hooks-2026",
        "title": "🔥 Топ-50 вирусных хуков для Shorts & Reels",
        "description": "Проверенные формулы хуков с удержанием 80%+ в первые 3 секунды. Категории: Нейросети, Финансы, Крипта, IT и Лайфхаки.",
        "category": "CONTENT",
        "badge": "ХИТ • 100 ₽",
        "price_pts": 250,
        "price_stars": 50,
        "price_rub": 100,
        "content_payload": """# ТОП-50 ВИРУСНЫХ ХУКОВ ДЛЯ YOUTUBE SHORTS & REELS 2026

## 🎯 Психология удержания:
Первые 2.5 секунды определяют 90% успеха Shorts. Алгоритм YouTube отдает приоритет роликам со Viewed vs Swiped Away > 75%.

---

### 🧠 Категория 1: Нейросети и AI Инструменты (Хуки-откровения)
1. "Удали ChatGPT. Вот нейросеть, которая делает то же самое в 10 раз быстрее и бесплатно..."
2. "99% программистов скрывают этот плагин, потому что он пишет код за них..."
3. "Google только что выкатил обновление, которое уничтожит 5 профессий к концу месяца..."
4. "Перестань монтировать видео руками! Вот как сделать 30 Shorts за 5 минут..."
5. "Секретный сайт, о котором тебе запретят говорить маркетологи..."
6. "Эта бесплатная нейросеть заменит тебе целую команду дизайнеров и монтажеров..."
7. "Как превратить 1 текстовую статью в 10 вирусных видео без своего лица..."
8. "Я протестировал 50 AI-сервисов за неделю — вот единственные 3, которые стоят твоего времени..."
9. "Если ты до сих пор делаешь презентации руками — сочувствую твоему времени..."
10. "Эту функцию в Claude 3.7 знают единицы, но она экономит 4 часа каждый день..."

---

### 💰 Категория 2: Финансы, Крипта & Заработок (Хуки выгоды и FOMO)
11. "Вот почему 90% людей никогда не станут богатыми, даже если зарабатывают много..."
12. "3 финансовых правила, которые спасут твои деньги в 2026 году..."
13. "Как один неизвестный криптокошелек сделал 100 000$ за 3 дня (разбор схемы)..."
14. "Банки ненавидят этот легальный способ получать кэшбэк на всё..."
15. "Если у тебя есть хотя бы 500 рублей, начни инвестировать в этот инструмент прямо сейчас..."
16. "Главная финансовая ошибка, которую совершает каждый в 20 лет..."
17. "Почему твоя зарплата обесценивается быстрее, чем растет инфляция..."
18. "Как построить пассивный доход на Telegram-ботах с нуля..."
19. "Секретная метрика, по которой крупные инвесторы покупают крипту до пампа..."
20. "3 привычки, из-за которых деньги утекают сквозь пальцы..."

---

### ⚡ Категория 3: IT, Кодинг & Карьера
21. "Как за 3 месяца войти в IT без курсов за 100 тысяч рублей..."
22. "Смертельная ошибка в резюме разработчика, из-за которой тебе никогда не перезвонят..."
23. "Если ты учишь Python в 2026 году, начни именно с этой библиотеки..."
24. "3 вопроса на собеседовании в BigTech, на которых сыпятся 8 из 10 Senior-разработчиков..."
25. "Вот как настроить Cursor так, чтобы писать фичи за 15 минут..."
26. "Почему Junior-разработчикам больше не платят за написание шаблонного кода..."
27. "Секретный чит-лист команд Linux, который должен сохранить каждый..."
28. "Как мы автоматизировали 80% рутины в стартапе с помощью одного скрипта..."
29. "Никогда не используй эти 3 конструкции в Python — они замедляют код в 10 раз..."
30. "Архитектурный паттерн, который спас наш сервис от падения на 100 000 RPS..."

---

### 🔥 Универсальная структура сценария 15-30-60 секунд:
- **0:00 - 0:03 [Хук + Динамичный зум]:** Озвучивание проблемы или шок-факта.
- **0:03 - 0:08 [Усиление боли]:** "Большинство делает X и теряет время/деньги..."
- **0:08 - 0:22 [Суть / Инструмент]:** Четкая демонстрация решения шаг за шагом.
- **0:22 - 0:30 [Call-To-Action]:** "Все промпты и ссылки закрепил в Telegram-боте в шапке профиля!"
"""
    },
    {
        "slug": "cursorrules-prompts-pack",
        "title": "⚡ Пак .cursorrules & Промптов для Claude 3.7 & GPT-4o",
        "description": "Боевые правила Cursor IDE и системные промпты: генерация готового кода с 1-го запроса, строгие типы, 0 галлюцинаций.",
        "category": "PROMPTS",
        "badge": "DEV PACK • 100 ₽",
        "price_pts": 300,
        "price_stars": 50,
        "price_rub": 100,
        "content_payload": """# БОЕВОЙ ПАК .CURSORRULES & META-ПРОМПТОВ ДЛЯ CLAUDE 3.7 & GPT-4O

## 📁 1. Готовый файл `.cursorrules` (Положи в корень любого проекта):

```markdown
# Role: Principal AI & Fullstack Engineer (2026 Standards)
You are an uncompromising senior software architect producing production-grade, hardened code.

## Critical Operating Principles:
1. NO PLACEHOLDERS: Never output `// TODO`, `/* implement here */`, or truncated snippets. Always provide full, drop-in replacement files.
2. DEFENSIVE ARCHITECTURE: Wrap all I/O, network calls, and async operations in comprehensive error boundaries with explicit fallback logic.
3. STRICT TYPING & ASYNC: 
   - TypeScript: Strict null checks, immutable types where possible, no `any`.
   - Python: Strict Python 3.12+ async/await, Pydantic v2, SQLAlchemy 2.0 with type hints.
4. ZERO HALLUCINATIONS: If a library API is unknown or deprecated, ask for clarification or use upstream verified standard libraries.
5. RESILIENCE: Handle rate limits, reconnects, cold-starts, and network disconnects gracefully.
```

---

## 🚀 2. Meta-Промпт для проектирования архитектуры с нуля:
Скопируй в Cursor / Claude:
```
Действуй как Chief Software Architect. Мне нужно спроектировать [ОПИСАНИЕ СЕРВИСА].
Не пиши сразу код. Сначала выполни 3 шага:
1. Анализ узких мест и edge-cases (память, сеть, concurrency).
2. Спецификация структур данных и контрактов API.
3. Пошаговый план внедрения от критического ядра к интерфейсу.
После моего подтверждения выдай полный production-ready код первого модуля.
```

---

## 🛠 3. Промпт для глубокого рефакторинга и исправления багов:
```
Проанализируй предоставленный код как старший техлид на code review:
1. Найди скрытые утечки памяти, гонки данных (race conditions) и необработанные исключения.
2. Оптимизируй алгоритмическую сложность (Big-O) и снизь количество аллокаций.
3. Предоставь исправленный файл целиком с пояснениями ключевых изменений.
```
"""
    },
    {
        "slug": "shorts-automation-code",
        "title": "🎬 Исходный код автогенератора Shorts (Python + Remotion)",
        "description": "Полный рабочий пайплайн: синтез речи Edge-TTS, сведение звука ffmpeg, кинетические титры и рендеринг 1080x1920 60fps.",
        "category": "CODE",
        "badge": "SOURCE CODE • 100 ₽",
        "price_pts": 400,
        "price_stars": 50,
        "price_rub": 100,
        "content_payload": """# ИСХОДНЫЙ КОД ДВИЖКА АВТОМАТИЗАЦИИ YOUTUBE SHORTS (2026)

## 📌 Архитектура пайплайна:
1. `generate_tts.py`: Превращает текст сценария в живую русскую речь через Edge-TTS (нейросеть `ru-RU-DmitryNeural`).
2. `mix_audio.py`: Сводит голос с фоновым динамичным битом и сайдчейном (ducking).
3. `remotion`: Рендерит видео 1080x1920 60fps с кинетическими субтитрами.

---

### Скрипт 1: Генератор речи `generate_tts.py`:
```python
import asyncio
import edge_tts

VOICE = "ru-RU-DmitryNeural"
RATE = "+10%"
PITCH = "+0Hz"

async def synthesize(text: str, output_path: str):
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(output_path)
    print(f"[OK] Аудиодорожка сохранена в {output_path}")

if __name__ == "__main__":
    text = "99% программистов скрывают этот секрет. Досмотри до конца, чтобы не потерять работу!"
    asyncio.run(synthesize(text, "public/audio.mp3"))
```

---

### Скрипт 2: Сведение звука через FFmpeg (Duck Audio):
```bash
ffmpeg -y -i public/audio.mp3 -i assets/bgm_beat.mp3 \\
  -filter_complex "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first" \\
  -c:a libmp3lame -q:a 2 out/final_audio.mp3
```

---

### Скрипт 3: Рендеринг в Remotion CLI:
```bash
npx remotion render src/index.ts ShortVideo out/video.mp4 --props='{"topic": "AI Trends"}'
```
"""
    },
    {
        "slug": "telegram-shop-bot-template",
        "title": "🤖 Шаблон Telegram Mini App + Бота (Aiogram 3 & FastAPI)",
        "description": "Готовый каркас магазина цифровых товаров: каталог, корзина, оплата PTS/Stars/СБП, реферальная система и БД SQLite.",
        "category": "CODE",
        "badge": "ГОТОВЫЙ БИЗНЕС • 100 ₽",
        "price_pts": 350,
        "price_stars": 50,
        "price_rub": 100,
        "content_payload": """# ГОТОВЫЙ КАРКАС TELEGRAM MINI APP + БОТА (AIOGRAM 3 & FASTAPI)

## 📦 Быстрый старт:
1. Установи зависимости: `pip install fastapi uvicorn aiogram sqlalchemy aiosqlite python-dotenv`
2. Создай бота в `@BotFather`, получи токен.
3. Запусти сервер: `python -m uvicorn main:app --reload`

---

### Структура проекта:
```text
├── backend/
│   ├── main.py          # FastAPI сервер + раздача WebApp
│   ├── models.py        # Таблицы Users, Products, Purchases
│   └── database.py      # SQLite Async Engine + WAL
├── bot/
│   └── bot.py           # Aiogram 3 хэндлеры + WebApp кнопка
└── frontend/
    ├── index.html       # OLED темная тема
    └── app.js           # Telegram WebApp SDK интеграция
```

---

### Хэндлер кнопки WebApp (`bot.py`):
```python
from aiogram import Bot, Dispatcher
from aiogram.types import Message, MenuButtonWebApp, WebAppInfo
from aiogram.filters import CommandStart

async def main():
    bot = Bot(token="ВАШ_ТОКЕН")
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def start_cmd(message: Message):
        await message.answer(
            f"Привет, {message.from_user.first_name}! Жми кнопку ниже, чтобы открыть маркет:",
        )

    # Установка постоянной кнопки меню
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="⚡ Открыть Маркет",
            web_app=WebAppInfo(url="https://ваш-домен.onrender.com")
        )
    )
    await dp.start_polling(bot)
```
"""
    },
    {
        "slug": "faceless-shorts-niches-100",
        "title": "📊 База 100+ прибыльных ниш для Shorts без лица",
        "description": "Каталог высокодоходных ниш (RPM > $4): темы, хештеги, вирусные форматы, схемы удержания и воронки в Telegram.",
        "category": "ANALYTICS",
        "badge": "СТАРТ В SHORTS • 100 ₽",
        "price_pts": 200,
        "price_stars": 50,
        "price_rub": 100,
        "content_payload": """# БАЗА 100+ ПРИБЫЛЬНЫХ НИШ ДЛЯ YOUTUBE SHORTS БЕЗ ЛИЦА (FACELESS)

## 💎 Топ-5 самых высокооплачиваемых направлений (RPM $3.50 - $7.00):

### 1. AI & Автоматизация для бизнеса
- **Темы:** "Как заменить отдел продаж 1 ботом", "Секретные связки Zapier + Make + Claude", "Нейросети для бухгалтера".
- **Формат визуала:** Запись экрана интерфейса, макеты в Figma, генерации Midjourney.
- **Монетизация:** Продажа шаблонов промптов (100–500 руб), подписка на Telegram-канал.

### 2. Личные финансы и инвестиции
- **Темы:** "Куда вложить 10 000 рублей в 2026", "Как составить финансовую подушку", "Сравнение вкладов и облигаций".
- **Формат визуала:** Динамичные графики TradingView, 3D анимация монет, типографика.
- **Монетизация:** Реферальные ссылки банков, партнерские брокерские программы.

### 3. Криптовалюта, Web3 и Airdrop'ы
- **Темы:** "Гайд по тестнетам без вложений", "Как читать ончейн-транзакции китов", "Топ-5 токенов экосистемы TON".
- **Формат визуала:** Скринкасты кошельков, визуализация блокчейна, неоновые плашки.
- **Монетизация:** Рефералки криптобирж (Bybit, OKX), закрытые комьюнити.

### 4. IT, Кодинг и No-Code инструменты
- **Темы:** "Создаем клон Tinder на FlutterFlow за 20 минут", "Топ-5 расширений VS Code", "Чистый код на Python".
- **Формат визуала:** Терминал с динамичной печатью кода, VS Code dark theme, Remotion анимации.
- **Монетизация:** Продажа исходников, курсов, вакансии.

### 5. Темная психология и парадоксы мышления
- **Темы:** "Парадокс корабля Тесея", "Почему умные люди часто сомневаются в себе", "Эффект Даннинга-Крюгера".
- **Формат визуала:** Чёрно-белые исторические арты, генерации Runway Gen-3, саунд-дизайн с глубоким басом.
- **Монетизация:** Продажа книг, рекламные интеграции, Telegram-воронки.

---

### 📈 Золотое правило воронки:
Ролик на YouTube должен давать 80% пользы, а недостающие 20% (ссылку, шаблон, скрипт) переводить в Telegram-бота:
*"Все исходники и шаблоны из видео я выложил в нашего Telegram-бота — ссылка в шапке канала!"*
"""
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
        else:
            # Обновление существующих продуктов актуальными ценами и контентом
            existing.title = p_data["title"]
            existing.description = p_data["description"]
            existing.badge = p_data["badge"]
            existing.price_pts = p_data["price_pts"]
            existing.price_stars = p_data["price_stars"]
            existing.price_rub = p_data["price_rub"]
            existing.content_payload = p_data["content_payload"]
            existing.is_active = True
    await session.commit()
