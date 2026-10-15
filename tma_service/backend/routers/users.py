import os
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from ..database import get_db
from ..models import User, Referral
from ..auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

BRAND_BOT_HANDLE = os.environ.get("BRAND_BOT_HANDLE") or "aidev_shorts_bot"

@router.get("/me")
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Подсчет количества приглашенных рефералов
    stmt = select(func.count(Referral.id)).where(Referral.referrer_id == user.tg_id)
    ref_count_res = await db.execute(stmt)
    referrals_count = ref_count_res.scalar() or 0

    clean_bot_handle = BRAND_BOT_HANDLE.replace("@", "").strip()
    if not clean_bot_handle or clean_bot_handle.lower() == "aibot":
        clean_bot_handle = "aidev_shorts_bot"

    referral_link = f"https://t.me/{clean_bot_handle}?start=ref_{user.referral_code}"
    tma_referral_link = f"https://t.me/{clean_bot_handle}/app?startapp=ref_{user.referral_code}"

    data = user.to_dict()
    data["referrals_count"] = referrals_count
    data["referral_link"] = referral_link
    data["tma_referral_link"] = tma_referral_link
    data["earned_from_referrals"] = referrals_count * 250
    return data

@router.get("/referrals")
async def get_my_referrals_list(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает список приглашенных пользователей и историю начислений.
    """
    stmt = select(Referral).where(Referral.referrer_id == user.tg_id).order_by(desc(Referral.created_at))
    res = await db.execute(stmt)
    referrals = res.scalars().all()

    items = []
    for r in referrals:
        # Поиск данных реферала
        u_stmt = select(User).where(User.tg_id == r.referee_id)
        u_res = await db.execute(u_stmt)
        ref_user = u_res.scalar_one_or_none()
        name = ref_user.first_name or f"User #{r.referee_id % 10000}" if ref_user else f"User #{r.referee_id % 10000}"
        items.append({
            "id": r.id,
            "name": name,
            "bonus_awarded": r.bonus_awarded,
            "date": r.created_at.strftime("%d.%m.%Y") if r.created_at else "Недавно",
        })

    return {
        "count": len(items),
        "total_earned": len(items) * 250,
        "items": items,
    }

@router.get("/leaderboard")
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).order_by(desc(User.balance)).limit(10)
    result = await db.execute(stmt)
    users = result.scalars().all()

    leaderboard = []
    for rank, u in enumerate(users, start=1):
        masked_username = f"@{u.username}" if u.username else f"User #{u.tg_id % 10000}"
        leaderboard.append({
            "rank": rank,
            "name": u.first_name or masked_username,
            "username": masked_username,
            "balance": u.balance,
        })
    return leaderboard
