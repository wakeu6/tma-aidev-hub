import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv(override=True)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import init_db
from .routers import users, rewards, shop, bot_webhook

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация базы данных SQLite при старте
    print("[FastAPI TMA] Инициализация базы данных SQLite с WAL-режимом...")
    await init_db()
    print("[FastAPI TMA] База данных готова к работе.")
    yield
    print("[FastAPI TMA] Остановка сервиса.")

app = FastAPI(
    title="Telegram Mini App Backend",
    version="1.0.0",
    description="Высокопроизводительный бэкенд TMA для монетизации воронки Shorts",
    lifespan=lifespan,
)

# Настройка CORS для работы Mini App под доменами Telegram и локальными туннелями
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение API роутеров
app.include_router(users.router)
app.include_router(rewards.router)
app.include_router(shop.router)
app.include_router(bot_webhook.router)

@app.get("/health")
async def healthcheck():
    return {
        "status": "OK",
        "service": "Telegram Mini App Backend",
        "debug_mock": os.environ.get("DEBUG_MOCK", "True"),
    }

# Раздача статики фронтенда Mini App
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html")
