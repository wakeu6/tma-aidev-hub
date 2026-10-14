import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Product, Purchase
from ..auth import get_current_user

router = APIRouter(prefix="/api/shop", tags=["Marketplace"])

class BuyRequest(BaseModel):
    product_slug: str

@router.get("/products")
async def list_products(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает каталог цифровых продуктов для Mini App.
    Помечает товары, которые пользователь уже приобрел.
    """
    stmt = select(Product).where(Product.is_active == True)
    res = await db.execute(stmt)
    products = res.scalars().all()

    # Проверка покупок текущего пользователя
    purchases_stmt = select(Purchase.product_slug).where(Purchase.user_id == user.id)
    p_res = await db.execute(purchases_stmt)
    purchased_slugs = set(p_res.scalars().all())

    result = []
    for p in products:
        p_dict = p.to_dict(include_payload=False)
        p_dict["is_purchased"] = p.slug in purchased_slugs
        result.append(p_dict)

    return {
        "products": result,
        "user_balance": user.balance,
    }

@router.post("/buy-pts")
async def buy_with_points(
    req: BuyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Покупка цифрового продукта за заработанные поинты (PTS).
    """
    stmt = select(Product).where(Product.slug == req.product_slug, Product.is_active == True)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    # Проверка, не куплен ли уже товар
    check_stmt = select(Purchase).where(Purchase.user_id == user.id, Purchase.product_id == product.id)
    check_res = await db.execute(check_stmt)
    if check_res.scalar_one_or_none():
        return {
            "success": True,
            "message": "Товар уже приобретен ранее",
            "new_balance": user.balance,
            "content": product.content_payload,
        }

    # Проверка баланса
    if user.balance < product.price_pts:
        diff = product.price_pts - user.balance
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно PTS. У вас {user.balance} PTS, требуется {product.price_pts} PTS (не хватает {diff} PTS). Посмотрите рекламу для начисления поинтов!",
        )

    # Атомарное списание и создание записи покупки
    user.balance -= product.price_pts

    purchase = Purchase(
        user_id=user.id,
        tg_id=user.tg_id,
        product_id=product.id,
        product_slug=product.slug,
        payment_method="PTS",
        amount_paid=product.price_pts,
        currency="PTS",
        status="COMPLETED",
        created_at=datetime.now(timezone.utc),
    )
    db.add(purchase)

    await db.commit()
    await db.refresh(user)

    return {
        "success": True,
        "message": f"Вы успешно приобрели '{product.title}' за {product.price_pts} PTS!",
        "new_balance": user.balance,
        "content": product.content_payload,
    }

@router.get("/purchases")
async def get_my_purchases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает список купленных товаров и их контент.
    """
    stmt = (
        select(Purchase, Product)
        .join(Product, Purchase.product_id == Product.id)
        .where(Purchase.user_id == user.id)
        .order_by(Purchase.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    purchases = []
    for purchase, product in rows:
        purchases.append({
            "purchase_id": purchase.id,
            "product_title": product.title,
            "product_slug": product.slug,
            "payment_method": purchase.payment_method,
            "amount_paid": purchase.amount_paid,
            "currency": purchase.currency,
            "created_at": purchase.created_at.isoformat() if purchase.created_at else None,
            "content": product.content_payload,
        })

    return {"purchases": purchases}

@router.post("/create-stars-invoice")
async def create_stars_invoice(
    req: BuyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Генерирует инвойс Telegram Stars (XTR) для мгновенной оплаты через Telegram.
    """
    stmt = select(Product).where(Product.slug == req.product_slug, Product.is_active == True)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    return {
        "success": True,
        "product_slug": product.slug,
        "stars_amount": product.price_stars,
        "title": product.title,
        "invoice_link": f"https://t.me/aidev_shorts_bot?start=buy_{product.slug}",
        "message": f"Для оплаты {product.price_stars} Stars перейдите по ссылке или используйте нативную кнопку оплаты.",
    }

@router.post("/create-sbp-payment")
async def create_sbp_payment(
    req: BuyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Создает платежную ссылку СБП (Система Быстрых Платежей) для пользователей из РФ.
    """
    stmt = select(Product).where(Product.slug == req.product_slug, Product.is_active == True)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    return {
        "success": True,
        "product_slug": product.slug,
        "amount_rub": product.price_rub,
        "title": product.title,
        "sbp_link": f"https://qr.nspk.ru/mock_pay_{product.slug}_{user.tg_id}",
        "message": f"Оплата {product.price_rub} ₽ через СБП (любой банк без комиссии).",
    }
