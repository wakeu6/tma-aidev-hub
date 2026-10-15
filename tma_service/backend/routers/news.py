from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..news_service import get_latest_news

router = APIRouter(prefix="/api/news", tags=["News"])

@router.get("")
@router.get("/")
async def list_news(db: AsyncSession = Depends(get_db)):
    """
    Возвращает актуальную ленту новостей из мира AI, технологий и Shorts.
    """
    posts = await get_latest_news(db, limit=10)
    return {
        "news": [p.to_dict() for p in posts],
    }
