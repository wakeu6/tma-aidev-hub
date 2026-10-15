// AI Dev Hub - Telegram Mini App Client Engine
(function () {
  'use strict';

  // State
  let currentUser = null;
  let cooldownInterval = null;
  let remainingCooldown = 0;
  let isWatchingAd = false;

  // Mock Dev State
  let currentMockId = '7770001';
  try {
    currentMockId = localStorage.getItem('tma_mock_user_id') || '7770001';
  } catch (_) {}
  let currentMockUsername = 'alex_dev';
  let currentMockName = 'Alex Developer';

  // Telegram WebApp SDK detection
  const tg = window.Telegram?.WebApp;
  const isInsideTelegram = Boolean(tg && tg.initData && tg.initData.length > 0);

  // DOM Elements
  const elUserName = document.getElementById('userName');
  const elUserAvatar = document.getElementById('userAvatar');
  const elStatusText = document.getElementById('statusText');
  const elEnvBadge = document.getElementById('envBadge');
  const elBalanceValue = document.getElementById('balanceValue');
  const elWatchAdBtn = document.getElementById('watchAdBtn');
  const elWatchAdBtnText = document.getElementById('watchAdBtnText');
  const elCooldownTimer = document.getElementById('cooldownTimer');
  const elCooldownSeconds = document.getElementById('cooldownSeconds');
  const elRefLinkInput = document.getElementById('refLinkInput');
  const elCopyRefBtn = document.getElementById('copyRefBtn');
  const elRefCount = document.getElementById('refCount');
  const elRefEarned = document.getElementById('refEarned');
  const elLeaderboardList = document.getElementById('leaderboardList');
  const elToast = document.getElementById('toast');
  const elAdModal = document.getElementById('adModal');
  const elAdProgressFill = document.getElementById('adProgressFill');
  const elAdTimerLeft = document.getElementById('adTimerLeft');
  const elAdCloseBtn = document.getElementById('adCloseBtn');
  const elDevMockPanel = document.getElementById('devMockPanel');
  const elMockUserSelect = document.getElementById('mockUserSelect');
  const elDevResetCooldownBtn = document.getElementById('devResetCooldownBtn');
  const elDevAddBonusBtn = document.getElementById('devAddBonusBtn');
  const elDevMockToggleBtn = document.getElementById('devMockToggleBtn');

  // Haptic feedback helper
  function triggerHaptic(type = 'medium') {
    try {
      if (tg?.HapticFeedback) {
        if (type === 'success' || type === 'error' || type === 'warning') {
          tg.HapticFeedback.notificationOccurred(type);
        } else {
          tg.HapticFeedback.impactOccurred(type);
        }
      }
    } catch (_) {}
  }

  // Toast notification helper
  function showToast(message, duration = 2500) {
    if (!elToast) return;
    elToast.textContent = message;
    elToast.classList.remove('hidden');
    setTimeout(() => {
      elToast.classList.add('hidden');
    }, duration);
  }

  // Common API headers generator
  function getApiHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      if (u.id) headers['X-Telegram-User-Id'] = String(u.id);
      if (u.username) headers['X-Telegram-Username'] = encodeURIComponent(String(u.username));
      if (u.first_name) headers['X-Telegram-First-Name'] = encodeURIComponent(String(u.first_name));
    }

    if (isInsideTelegram && tg.initData) {
      headers['X-Telegram-Init-Data'] = tg.initData;
      headers['Authorization'] = `tma ${tg.initData}`;
    } else {
      // Mock mode fallback headers
      headers['X-Mock-User-Id'] = String(currentMockId);
      headers['X-Mock-Username'] = encodeURIComponent(String(currentMockUsername || ''));
      headers['X-Mock-First-Name'] = encodeURIComponent(String(currentMockName || ''));
    }

    return headers;
  }

  // 1. Initialize Telegram Environment
  function initTelegram() {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        tg.headerColor = '#0A0B0E';
        tg.backgroundColor = '#0A0B0E';
      } catch (_) {}
    }

    if (isInsideTelegram) {
      if (elEnvBadge) elEnvBadge.textContent = 'TELEGRAM';
      if (elStatusText) elStatusText.textContent = 'Подключено';
      
      // Instant render from Telegram WebApp memory before network response
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        const dName = u.first_name || (u.username ? `@${u.username}` : `User #${u.id}`);
        if (elUserName) elUserName.textContent = dName;
        if (elUserAvatar) elUserAvatar.textContent = (dName.replace('@', '')[0] || 'U').toUpperCase();
      }
    } else {
      if (elEnvBadge) {
        elEnvBadge.textContent = 'ONLINE';
        elEnvBadge.style.color = '#00F0FF';
        elEnvBadge.style.borderColor = 'rgba(0, 240, 255, 0.4)';
      }
      if (elStatusText) elStatusText.textContent = 'Гость / Модерация';
      // Панель мока скрыта для чистого внешнего вида
      if (elDevMockPanel) elDevMockPanel.classList.add('hidden');
    }
  }

  // 2. Fetch User Profile
  async function loadUserProfile() {
    try {
      const response = await fetch('/api/users/me', {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки профиля: ${response.status}`);
      }

      currentUser = await response.json();

      // Проверка и синхронизация локального кэша баланса для защиты от сброса при перезапуске сервера
      try {
        const cacheKey = 'striver_balance_' + (currentUser.tg_id || 'guest');
        const cachedBalance = localStorage.getItem(cacheKey);
        if (cachedBalance && Number(cachedBalance) > Number(currentUser.balance)) {
          currentUser.balance = Number(cachedBalance);
        }
      } catch (_) {}

      renderUserProfile(currentUser);
      await checkRewardCooldown();
      await loadLeaderboard();
      await loadReferralsDetail();
    } catch (err) {
      console.error('[TMA] Ошибка профиля:', err.message);
      // Если профиль уже отображается из Telegram WebApp данных, не показываем ложную ошибку
      if (!currentUser && (!tg?.initDataUnsafe?.user)) {
        showToast('Сбой синхронизации с сервером');
      }
    }
  }

  // Render User Data in UI
  function renderUserProfile(user) {
    const displayName = user.first_name || (user.username ? `@${user.username}` : `User #${user.tg_id}`);
    if (elUserName) elUserName.textContent = displayName;
    if (elUserAvatar) {
      elUserAvatar.textContent = (displayName.replace('@', '')[0] || 'U').toUpperCase();
    }

    if (elBalanceValue) {
      elBalanceValue.textContent = Number(user.balance).toLocaleString('ru-RU');
    }

    // Сохраняем актуальный баланс в локальный кэш
    try {
      if (user.tg_id) {
        localStorage.setItem('striver_balance_' + user.tg_id, String(user.balance));
      }
    } catch (_) {}

    if (elRefLinkInput) {
      elRefLinkInput.value = user.referral_link || 'https://t.me/aidev_shorts_bot?start=ref_xxx';
    }

    if (elRefCount) {
      elRefCount.textContent = user.referrals_count || 0;
    }

    if (elRefEarned) {
      elRefEarned.textContent = Number(user.earned_from_referrals || 0).toLocaleString('ru-RU');
    }
  }

  // 3. Check Cooldown Status
  async function checkRewardCooldown() {
    try {
      const res = await fetch('/api/rewards/status', {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cooldown_remaining > 0) {
          startCooldownTimer(data.cooldown_remaining);
        } else {
          stopCooldownTimer();
        }
      }
    } catch (_) {}
  }

  // Cooldown Countdown Handler
  function startCooldownTimer(seconds) {
    remainingCooldown = seconds;
    if (elWatchAdBtn) elWatchAdBtn.disabled = true;
    if (elWatchAdBtnText) elWatchAdBtnText.textContent = 'Кулдаун активен';
    if (elCooldownTimer) elCooldownTimer.classList.remove('hidden');
    if (elCooldownSeconds) elCooldownSeconds.textContent = remainingCooldown;

    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      remainingCooldown--;
      if (elCooldownSeconds) elCooldownSeconds.textContent = remainingCooldown;

      if (remainingCooldown <= 0) {
        stopCooldownTimer();
      }
    }, 1000);
  }

  function stopCooldownTimer() {
    clearInterval(cooldownInterval);
    remainingCooldown = 0;
    if (elWatchAdBtn) elWatchAdBtn.disabled = false;
    if (elWatchAdBtnText) elWatchAdBtnText.textContent = 'Смотреть рекламу';
    if (elCooldownTimer) elCooldownTimer.classList.add('hidden');
  }

  // Adsgram Controller State
  let adsgramController = null;
  function initAdsgramController() {
    const adsgramBlockId = window.ADSGRAM_BLOCK_ID || '54057';
    if (window.Adsgram && adsgramBlockId && adsgramBlockId !== 'mock_block_id') {
      try {
        adsgramController = window.Adsgram.init({ blockId: adsgramBlockId });
        console.log('[Adsgram] SDK успешно подключен для блока:', adsgramBlockId);
      } catch (err) {
        console.warn('[Adsgram] Предупреждение предзагрузки контроллера:', err);
      }
    }
  }

  // 4. Watch Ad & Claim Reward
  async function handleWatchAd() {
    if (isWatchingAd || remainingCooldown > 0) return;
    isWatchingAd = true;
    triggerHaptic('medium');

    const adsgramBlockId = window.ADSGRAM_BLOCK_ID || '54057';

    if (window.Adsgram) {
      try {
        if (!adsgramController) {
          adsgramController = window.Adsgram.init({ blockId: adsgramBlockId });
        }
        console.log('[Adsgram] Запуск показа рекламы Adsgram (Block ID:', adsgramBlockId, ')');
        await adsgramController.show();
        console.log('[Adsgram] Просмотр успешно завершен');
        await claimRewardOnBackend();
      } catch (err) {
        console.warn('[Adsgram] Ролик недоступен или отклонен (модерация/ограничение), запуск теста:', err);
        await runMockAdPlayer();
      }
    } else {
      // Запуск визуального эмулятора показа спонсорского ролика
      await runMockAdPlayer();
    }

    isWatchingAd = false;
  }

  // Mock Ad Player Simulation (5 seconds OLED modal)
  function runMockAdPlayer() {
    return new Promise((resolve) => {
      if (!elAdModal) {
        claimRewardOnBackend().then(resolve);
        return;
      }

      elAdModal.classList.remove('hidden');
      let timeLeft = 5;
      if (elAdTimerLeft) elAdTimerLeft.textContent = timeLeft;
      if (elAdProgressFill) elAdProgressFill.style.width = '0%';
      if (elAdCloseBtn) {
        elAdCloseBtn.disabled = true;
        elAdCloseBtn.textContent = 'Подождите завершения';
      }

      const stepMs = 100;
      const totalSteps = 50;
      let step = 0;

      const progressInterval = setInterval(() => {
        step++;
        const pct = Math.min(100, Math.round((step / totalSteps) * 100));
        if (elAdProgressFill) elAdProgressFill.style.width = `${pct}%`;

        if (step % 10 === 0) {
          timeLeft--;
          if (elAdTimerLeft) elAdTimerLeft.textContent = Math.max(0, timeLeft);
          triggerHaptic('light');
        }

        if (step >= totalSteps) {
          clearInterval(progressInterval);
          if (elAdCloseBtn) {
            elAdCloseBtn.disabled = false;
            elAdCloseBtn.textContent = 'Забрать +100 PTS';
          }
          triggerHaptic('success');

          elAdCloseBtn.onclick = async () => {
            elAdModal.classList.add('hidden');
            await claimRewardOnBackend();
            resolve();
          };
        }
      }, stepMs);
    });
  }

  // Claim Reward Request to Backend
  async function claimRewardOnBackend() {
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: getApiHeaders(),
      });

      if (res.status === 429) {
        const errData = await res.json();
        showToast(errData.detail || 'Кулдаун активен!');
        startCooldownTimer(30);
        return;
      }

      if (!res.ok) {
        throw new Error('Ошибка начисления');
      }

      const result = await res.json();
      triggerHaptic('success');
      showToast(`+${result.awarded_points} PTS начислено! 🎉`);

      // Обновляем баланс в UI
      if (currentUser) {
        currentUser.balance = result.new_balance;
        renderUserProfile(currentUser);
      }

      // Запускаем 30-секундный серверный кулдаун
      startCooldownTimer(result.cooldown_seconds || 30);
      await loadLeaderboard();
    } catch (e) {
      console.error('[TMA Reward] Ошибка:', e);
      showToast('Сбой подтверждения награды');
    }
  }

  // 5. Copy Referral Link
  function copyReferralLink() {
    if (!elRefLinkInput) return;
    elRefLinkInput.select();
    elRefLinkInput.setSelectionRange(0, 99999);
    try {
      navigator.clipboard.writeText(elRefLinkInput.value);
      triggerHaptic('medium');
      showToast('Ссылка скопирована в буфер обмена!');
    } catch (_) {
      showToast('Скопируйте ссылку вручную');
    }
  }

  // 6. Fetch Leaderboard
  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/users/leaderboard');
      if (!res.ok) return;

      const leaders = await res.json();
      if (!elLeaderboardList) return;

      if (!leaders || leaders.length === 0) {
        elLeaderboardList.innerHTML = '<div class="loading-placeholder">Будь первым в рейтинге!</div>';
        return;
      }

      elLeaderboardList.innerHTML = leaders.map((item) => `
        <div class="leader-item">
          <div class="leader-left">
            <span class="leader-rank top-${item.rank}">#${item.rank}</span>
            <span class="leader-name">${item.name}</span>
          </div>
          <span class="leader-pts">${Number(item.balance).toLocaleString('ru-RU')} PTS</span>
        </div>
      `).join('');
    } catch (_) {}
  }

  // 7. Dev Mock Switcher Setup
  function setupDevMockPanel() {
    if (elMockUserSelect) {
      elMockUserSelect.value = currentMockId;
      elMockUserSelect.addEventListener('change', (e) => {
        currentMockId = e.target.value;
        localStorage.setItem('tma_mock_user_id', currentMockId);

        if (currentMockId === '7770001') {
          currentMockUsername = 'alex_dev';
          currentMockName = 'Alex Developer';
        } else if (currentMockId === '7770002') {
          currentMockUsername = 'maria_code';
          currentMockName = 'Maria Coder';
        } else {
          currentMockUsername = 'sergey_ai';
          currentMockName = 'Sergey AI Master';
        }

        stopCooldownTimer();
        loadUserProfile();
        showToast(`Переключено на ${currentMockName}`);
      });
    }

    if (elDevResetCooldownBtn) {
      elDevResetCooldownBtn.addEventListener('click', () => {
        stopCooldownTimer();
        showToast('Кулдаун локально сброшен');
      });
    }

    if (elDevAddBonusBtn) {
      elDevAddBonusBtn.addEventListener('click', () => {
        if (currentUser) {
          currentUser.balance += 500;
          renderUserProfile(currentUser);
          showToast('+500 PTS (Dev Bonus)');
        }
      });
    }

    if (elDevMockToggleBtn) {
      elDevMockToggleBtn.addEventListener('click', () => {
        if (elDevMockPanel) elDevMockPanel.classList.add('hidden');
      });
    }
  }

  // 8. Navigation Tabs Logic
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  function switchTab(targetTab) {
    triggerHaptic('light');
    navTabs.forEach(t => {
      if (t.dataset.tab === targetTab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    tabContents.forEach(c => {
      if (c.id === `tab-${targetTab}`) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    if (targetTab === 'market') {
      loadMarketProducts();
    } else if (targetTab === 'inventory') {
      loadPurchases();
    } else if (targetTab === 'news') {
      loadNews();
    } else if (targetTab === 'earn') {
      loadReferralsDetail();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 9. Marketplace Logic
  const elProductsGrid = document.getElementById('productsGrid');
  const elPurchasesList = document.getElementById('purchasesList');
  const elContentModal = document.getElementById('contentModal');
  const elContentModalTitle = document.getElementById('contentModalTitle');
  const elContentModalPayload = document.getElementById('contentModalPayload');
  const elCopyPayloadBtn = document.getElementById('copyPayloadBtn');
  const elCloseContentModalBtn = document.getElementById('closeContentModalBtn');

  let currentModalText = '';

  function openContentModal(title, payload) {
    if (!elContentModal) return;
    triggerHaptic('success');
    currentModalText = payload;
    if (elContentModalTitle) elContentModalTitle.textContent = title;
    if (elContentModalPayload) elContentModalPayload.textContent = payload;
    elContentModal.classList.remove('hidden');
  }

  if (elCloseContentModalBtn) {
    elCloseContentModalBtn.addEventListener('click', () => {
      triggerHaptic('light');
      elContentModal.classList.add('hidden');
    });
  }

  if (elCopyPayloadBtn) {
    elCopyPayloadBtn.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(currentModalText);
        triggerHaptic('medium');
        showToast('Текст скопирован в буфер обмена!');
      } catch (_) {
        showToast('Выделите и скопируйте текст вручную');
      }
    });
  }

  async function loadMarketProducts() {
    if (!elProductsGrid) return;
    try {
      const res = await fetch('/api/shop/products', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Ошибка загрузки товаров');
      const data = await res.json();
      const products = data.products || [];

      if (products.length === 0) {
        elProductsGrid.innerHTML = '<div class="loading-placeholder">Товары скоро появятся!</div>';
        return;
      }

      const userBalance = currentUser ? currentUser.balance : 0;

      elProductsGrid.innerHTML = products.map(p => {
        const canAffordPts = userBalance >= p.price_pts;
        const ptsBtnText = p.is_purchased
          ? '✓ Куплено • Открыть материал'
          : canAffordPts
            ? `Купить за ${p.price_pts} PTS`
            : `Не хватает ${p.price_pts - userBalance} PTS (Фармить)`;

        const badgeClass = p.is_purchased ? 'product-badge purchased' : 'product-badge';
        const badgeText = p.is_purchased ? 'КУПЛЕНО' : (p.badge || 'PRO');

        return `
          <div class="product-card" id="card-${p.slug}">
            <div class="product-top">
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <h3 class="product-title">${p.title}</h3>
            <p class="product-desc">${p.description}</p>
            <div class="product-actions">
              <button class="btn btn-buy-pts ${p.is_purchased ? 'btn-opened' : ''}" 
                      onclick="window.__tma_buy_pts('${p.slug}', ${p.is_purchased}, ${canAffordPts})">
                ${ptsBtnText}
              </button>
              ${!p.is_purchased ? `
                <div class="btn-buy-secondary-row">
                  <button class="btn btn-buy-stars" onclick="window.__tma_buy_stars('${p.slug}')">
                    ⭐ ${p.price_stars} Stars
                  </button>
                  <button class="btn btn-buy-sbp" onclick="window.__tma_buy_sbp('${p.slug}')">
                    💳 ${p.price_rub} ₽ (СБП)
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('[Shop]', e);
      elProductsGrid.innerHTML = '<div class="loading-placeholder">Сбой загрузки товаров</div>';
    }
  }

  // Global handlers for inline onclicks
  window.__tma_buy_pts = async function(slug, isPurchased, canAfford) {
    if (isPurchased) {
      // Открыть уже купленный товар
      await viewPurchasedItem(slug);
      return;
    }

    if (!canAfford) {
      triggerHaptic('warning');
      showToast('Недостаточно PTS. Перейдите во вкладку "Фарминг"');
      switchTab('earn');
      return;
    }

    triggerHaptic('medium');
    try {
      const res = await fetch('/api/shop/buy-pts', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ product_slug: slug })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || 'Ошибка покупки');
        return;
      }

      if (currentUser) {
        currentUser.balance = data.new_balance;
        renderUserProfile(currentUser);
      }

      showToast(data.message || 'Покупка успешна! 🎉');
      openContentModal('Материал разблокирован', data.content);
      loadMarketProducts();
    } catch (err) {
      showToast('Сбой оформления заказа');
    }
  };

  window.__tma_buy_stars = async function(slug) {
    triggerHaptic('medium');
    try {
      const res = await fetch('/api/shop/create-stars-invoice', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ product_slug: slug })
      });
      const data = await res.json();
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(data.invoice_link);
      } else {
        window.open(data.invoice_link, '_blank');
      }
      showToast('Открываем оплату Telegram Stars ⭐');
    } catch (_) {
      showToast('Ошибка вызова Telegram Stars');
    }
  };

  window.__tma_buy_sbp = async function(slug) {
    triggerHaptic('medium');
    try {
      const res = await fetch('/api/shop/create-sbp-payment', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ product_slug: slug })
      });
      const data = await res.json();
      showToast(`СБП: ${data.amount_rub} ₽. Переходим к оплате...`);
      if (tg?.openLink) {
        tg.openLink(data.sbp_link);
      } else {
        window.open(data.sbp_link, '_blank');
      }
    } catch (_) {
      showToast('Ошибка вызова СБП');
    }
  };

  async function viewPurchasedItem(slug) {
    try {
      const res = await fetch('/api/shop/purchases', { headers: getApiHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const item = (data.purchases || []).find(p => p.product_slug === slug);
      if (item) {
        openContentModal(item.product_title, item.content);
      }
    } catch (_) {}
  }

  async function loadPurchases() {
    if (!elPurchasesList) return;
    try {
      const res = await fetch('/api/shop/purchases', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Ошибка загрузки покупок');
      const data = await res.json();
      const purchases = data.purchases || [];

      if (purchases.length === 0) {
        elPurchasesList.innerHTML = `
          <div class="loading-placeholder">
            У вас пока нет покупок.<br>Зарабатывайте PTS во вкладке "Фарминг" и открывайте полезные материалы!
          </div>
        `;
        return;
      }

      elPurchasesList.innerHTML = purchases.map(p => `
        <div class="purchase-card">
          <div class="purchase-top">
            <span class="purchase-title">${p.product_title}</span>
            <span class="product-badge purchased">${p.payment_method}</span>
          </div>
          <button class="btn btn-secondary" onclick="window.__tma_view_content('${p.product_slug}')">
            📂 Просмотреть / Скопировать материал
          </button>
        </div>
      `).join('');
    } catch (_) {
      elPurchasesList.innerHTML = '<div class="loading-placeholder">Сбой загрузки покупок</div>';
    }
  }

  window.__tma_view_content = viewPurchasedItem;

  // 10. AI News & Digest Logic
  const elNewsGrid = document.getElementById('newsGrid');
  const elReferralsDetailList = document.getElementById('referralsDetailList');

  async function loadNews() {
    if (!elNewsGrid) return;
    try {
      const res = await fetch('/api/news', { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Ошибка загрузки новостей');
      const data = await res.json();
      const newsItems = data.news || [];

      if (newsItems.length === 0) {
        elNewsGrid.innerHTML = '<div class="loading-placeholder">Лента новостей обновляется...</div>';
        return;
      }

      elNewsGrid.innerHTML = newsItems.map(item => `
        <div class="news-card">
          <span class="news-tag">${item.source_tag || 'AI TRENDS'}</span>
          <h3 class="news-title">${item.title}</h3>
          <p class="news-desc">${item.summary}</p>
          <div class="news-footer">
            <span>⚡ Striver AI Digest</span>
            <span>${item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : 'Сегодня'}</span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('[News]', e);
      elNewsGrid.innerHTML = '<div class="loading-placeholder">Сбой загрузки новостей</div>';
    }
  }

  async function loadReferralsDetail() {
    if (!elReferralsDetailList) return;
    try {
      const res = await fetch('/api/users/referrals', { headers: getApiHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        elReferralsDetailList.innerHTML = `
          <div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 6px;">
            У вас пока нет приглашенных друзей. Поделитесь ссылкой выше!
          </div>
        `;
        return;
      }

      elReferralsDetailList.innerHTML = items.map(item => `
        <div class="ref-detail-item">
          <span class="ref-detail-name">👤 ${item.name} (${item.date || 'Недавно'})</span>
          <span class="ref-detail-reward">+${item.bonus_awarded || 250} PTS</span>
        </div>
      `).join('');
    } catch (_) {}
  }

  // Event Listeners
  if (elWatchAdBtn) {
    elWatchAdBtn.addEventListener('click', handleWatchAd);
  }

  if (elCopyRefBtn) {
    elCopyRefBtn.addEventListener('click', copyReferralLink);
  }

  // Start Application
  initTelegram();
  initAdsgramController();
  setupDevMockPanel();
  loadUserProfile();
  loadMarketProducts();
  loadNews();

})();


