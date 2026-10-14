import os
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from ..database import get_db
from ..models import User, Referral
from ..auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

BRAND_BOT_HANDLE = os.environ.get("BRAND_BOT_HANDLE", "@AIBot")

@router.get("/me")
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Подсчет количества приглашенных рефералов
    stmt = select(func.count(Referral.id)).where(Referral.referrer_id == user.tg_id)
    ref_count_res = await db.execute(stmt)
    referrals_count = ref_count_res.scalar() or 0

    clean_bot_handle = BRAND_BOT_HANDLE.replace("@", "")
    referral_link = f"https://t.me/{clean_bot_handle}?start=ref_{user.referral_code}"

    data = user.to_dict()
    data["referrals_count"] = referrals_count
    data["referral_link"] = referral_link
    data["earned_from_referrals"] = referrals_count * 250
    return data

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
