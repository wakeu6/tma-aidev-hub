from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..database import get_db
from ..models import User, AdImpressionLog
from ..auth import get_current_user

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])

COOLDOWN_SECONDS = 30
REWARD_PER_AD = 100

@router.get("/status")
async def get_reward_status(user: User = Depends(get_current_user)):
    """
    Возвращает оставшееся время кулдауна до следующего просмотра рекламы.
    """
    now = datetime.now(timezone.utc)
    remaining_cooldown = 0

    if user.last_reward_claimed_at:
        # Приведение к UTC
        last_claim = user.last_reward_claimed_at
        if last_claim.tzinfo is None:
            last_claim = last_claim.replace(tzinfo=timezone.utc)

        elapsed = (now - last_claim).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            remaining_cooldown = int(COOLDOWN_SECONDS - elapsed)

    return {
        "can_claim": remaining_cooldown == 0,
        "cooldown_remaining": remaining_cooldown,
        "cooldown_total": COOLDOWN_SECONDS,
        "reward_amount": REWARD_PER_AD,
        "current_balance": user.balance,
    }

@router.post("/claim")
async def claim_ad_reward(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Атомарное начисление баллов за просмотр рекламы Adsgram.
    Защищено серверным кулдауном 30 секунд от накрутки кликерами.
    """
    now = datetime.now(timezone.utc)

    # 1. Проверка серверного кулдауна
    if user.last_reward_claimed_at:
        last_claim = user.last_reward_claimed_at
        if last_claim.tzinfo is None:
            last_claim = last_claim.replace(tzinfo=timezone.utc)

        elapsed = (now - last_claim).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            retry_after = int(COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Кулдаун активен. Подождите еще {retry_after} сек перед следующим просмотром.",
                headers={"Retry-After": str(retry_after)},
            )

    client_ip = request.client.host if request.client else "127.0.0.1"

    # 2. Атомарное обновление баланса пользователя и запись в журнал
    user.balance += REWARD_PER_AD
    user.last_reward_claimed_at = now

    log_entry = AdImpressionLog(
        user_id=user.id,
        tg_id=user.tg_id,
        reward_points=REWARD_PER_AD,
        ip_address=client_ip,
        status="COMPLETED",
        created_at=now,
    )
    db.add(log_entry)

    await db.commit()
    await db.refresh(user)

    return {
        "success": True,
        "awarded_points": REWARD_PER_AD,
        "new_balance": user.balance,
        "cooldown_seconds": COOLDOWN_SECONDS,
        "claimed_at": now.isoformat(),
    }

@router.api_route("/adsgram-webhook", methods=["GET", "POST"])
@router.api_route("/webhook", methods=["GET", "POST"])
async def adsgram_reward_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Adsgram Server-to-Server Reward URL Webhook.
    Поддерживает валидацию подключения блока в Adsgram (тестовые запросы/пинги),
    а также боевые уведомления о завершении просмотра рекламы пользователем.
    Всегда возвращает HTTP 200, чтобы валидация в Adsgram проходила успешно.
    """
    # 1. Сбор параметров из Query параметров и/или JSON/Form body
    query_params = dict(request.query_params)
    body_data = {}
    try:
        if request.headers.get("content-type", "").startswith("application/json"):
            body_data = await request.json()
        elif "form" in request.headers.get("content-type", ""):
            form = await request.form()
            body_data = dict(form)
    except Exception:
        pass

    params = {**query_params, **body_data}
    print(f"[Adsgram Webhook] Получен запрос от Adsgram: {params}")

    params_lower = {k.lower(): v for k, v in params.items()}
    raw_user_id = (
        params_lower.get("userid")
        or params_lower.get("user_id")
        or params_lower.get("tg_id")
        or params_lower.get("sub_id")
    )
    raw_reward = params_lower.get("reward") or params_lower.get("amount") or str(REWARD_PER_AD)
    transaction_id = params_lower.get("transaction_id") or params_lower.get("track_id") or params_lower.get("id") or None
    is_test = params_lower.get("test") in ("true", "1", True) or params_lower.get("check") in ("true", "1", True)

    client_ip = request.client.host if request.client else "unknown"

    # Если это проверка доступности URL от панели Adsgram (ping/test/[userid] placeholder)
    raw_str = str(raw_user_id).strip().lower()
    if not raw_user_id or is_test or raw_str in ("test", "123456", "0", "[userid]", "{userid}", "%5buserid%5d"):
        print(f"[Adsgram Webhook] Тестовый пинг Adsgram ({raw_user_id}) успешно подтвержден (200 OK).")
        return {
            "ok": True,
            "status": "ping_acknowledged",
            "message": "Adsgram Reward URL is online and reachable",
        }

    try:
        tg_id = int(raw_user_id)
        reward_points = int(raw_reward) if str(raw_reward).isdigit() else REWARD_PER_AD
    except (ValueError, TypeError):
        print(f"[Adsgram Webhook] Нечисловой userid ({raw_user_id}), возвращаем 200 OK для валидации панели.")
        return {"ok": True, "status": "ping_acknowledged", "user_raw": str(raw_user_id)}

    now = datetime.now(timezone.utc)

    # Проверка на повтор транзакции (идемпотентность)
    if transaction_id:
        stmt_check = select(AdImpressionLog).where(AdImpressionLog.transaction_id == str(transaction_id))
        res_check = await db.execute(stmt_check)
        if res_check.scalar_one_or_none():
            print(f"[Adsgram Webhook] Транзакция {transaction_id} уже была начислена.")
            return {"ok": True, "status": "already_processed"}

    # Поиск или автоматическое создание пользователя
    user_stmt = select(User).where(User.tg_id == tg_id)
    res = await db.execute(user_stmt)
    user = res.scalar_one_or_none()

    if not user:
        user = User(
            tg_id=tg_id,
            balance=reward_points,
            last_reward_claimed_at=now,
        )
        db.add(user)
        await db.flush()
    else:
        user.balance += reward_points
        user.last_reward_claimed_at = now

    log_entry = AdImpressionLog(
        user_id=user.id,
        tg_id=user.tg_id,
        reward_points=reward_points,
        provider="adsgram_webhook",
        transaction_id=str(transaction_id) if transaction_id else None,
        ip_address=client_ip,
        status="COMPLETED",
        created_at=now,
    )
    db.add(log_entry)

    await db.commit()
    await db.refresh(user)

    print(f"[Adsgram Webhook] [OK] Начислено {reward_points} PTS пользователю {tg_id}. Новый баланс: {user.balance}")

    return {
        "ok": True,
        "rewarded": reward_points,
        "tg_id": tg_id,
        "new_balance": user.balance,
        "status": "success",
    }

