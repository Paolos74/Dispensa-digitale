// Supermarket Cashier Continuous Scanner Engine
class CashierScanner {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.currentCameraId = null;
    this.availableCameras = [];
    this.hasTorch = false;
    this.torchOn = false;

    // Cashier Session Ticket (Nastro Cassa)
    this.ticketItems = []; // Array of { barcode, name, brand, category, quantity, unit, price, nutriscore, image }
    this.targetMode = 'pantry_load'; // 'pantry_load' (Carico), 'pantry_consume' (Scarico), 'shopping_list' (Lista Spesa)

    // Cooldown tracking for sequential cashier scanning
    this.lastScannedCode = null;
    this.lastScannedTime = 0;
    this.SAME_CODE_COOLDOWN_MS = 1400; // Delay before incrementing the same item again
  }

  setMode(mode) {
    this.targetMode = mode;
    this.updateModeUI();
  }

  updateModeUI() {
    const badge = document.getElementById('cashier-mode-badge');
    const desc = document.getElementById('cashier-mode-desc');
    const submitBtn = document.getElementById('cashier-confirm-btn');

    if (!badge || !desc || !submitBtn) return;

    if (this.targetMode === 'pantry_load') {
      badge.textContent = '📦 Carico Dispensa';
      badge.className = 'mode-pill mode-load';
      desc.textContent = 'Scansiona a nastro i prodotti comprati per caricarli nella dispensa.';
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg> Salva in Dispensa';
      submitBtn.className = 'btn btn-primary';
    } else if (this.targetMode === 'pantry_consume') {
      badge.textContent = '🍽️ Consumo / Scarico';
      badge.className = 'mode-pill mode-consume';
      desc.textContent = 'Scansiona i prodotti mentre li usi per scalare la quantità dalla dispensa.';
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg> Conferma Consumo';
      submitBtn.className = 'btn btn-warning';
    } else if (this.targetMode === 'shopping_list') {
      badge.textContent = '🛒 Alla Lista Spesa';
      badge.className = 'mode-pill mode-shopping';
      desc.textContent = 'Scansiona le confezioni finite per aggiungerle direttamente alla lista della spesa.';
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Invia alla Lista Spesa';
      submitBtn.className = 'btn btn-accent';
    }
  }

  async startCamera() {
    if (this.isScanning) return;
    const scannerEl = document.getElementById('qr-reader');
    if (!scannerEl) return;

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode('qr-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
          ],
          verbose: false
        });
      }

      this.availableCameras = await Html5Qrcode.getCameras();
      let cameraIdOrConfig = { facingMode: 'environment' };

      if (this.availableCameras && this.availableCameras.length > 0) {
        // Try back camera
        const backCam = this.availableCameras.find(c =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('posteriore')
        );
        cameraIdOrConfig = backCam ? backCam.id : this.availableCameras[0].id;
        this.currentCameraId = cameraIdOrConfig;
      }

      const config = {
        fps: 20, // High frame rate for cashier feeling
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.85),
            height: Math.floor(minEdge * 0.55) // Wide barcode/QR window
          };
        },
        aspectRatio: 1.333
      };

      await this.html5QrCode.start(
        cameraIdOrConfig,
        config,
        (decodedText, decodedResult) => this.onScanSuccess(decodedText, decodedResult),
        (errorMessage) => {/* silent frame misses */}
      );

      this.isScanning = true;
      document.getElementById('scanner-overlay').classList.add('active');
      document.getElementById('scanner-status-text').textContent = 'Scanner attivo: passa i prodotti';

      // Check torch capability
      try {
        const capabilities = this.html5QrCode.getRunningTrackCapabilities();
        this.hasTorch = Boolean(capabilities && capabilities.torch);
        const torchBtn = document.getElementById('btn-toggle-torch');
        if (torchBtn) {
          torchBtn.style.display = this.hasTorch ? 'inline-flex' : 'none';
        }
      } catch (e) {
        this.hasTorch = false;
      }
    } catch (err) {
      console.error('Camera start error:', err);
      document.getElementById('scanner-status-text').textContent = 'Fotocamera non disponibile. Usa la simulazione o inserimento manuale.';
      this.isScanning = false;
    }
  }

  async stopCamera() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      this.isScanning = false;
      const overlay = document.getElementById('scanner-overlay');
      if (overlay) overlay.classList.remove('active');
    }
  }

  async toggleTorch() {
    if (!this.html5QrCode || !this.hasTorch) return;
    try {
      this.torchOn = !this.torchOn;
      await this.html5QrCode.applyVideoConstraints({
        advanced: [{ torch: this.torchOn }]
      });
      const torchBtn = document.getElementById('btn-toggle-torch');
      if (torchBtn) {
        torchBtn.classList.toggle('active', this.torchOn);
      }
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  }

  async switchCamera() {
    if (!this.availableCameras || this.availableCameras.length < 2) return;
    await this.stopCamera();
    const curIdx = this.availableCameras.findIndex(c => c.id === this.currentCameraId);
    const nextIdx = (curIdx + 1) % this.availableCameras.length;
    this.currentCameraId = this.availableCameras[nextIdx].id;
    await this.startCamera();
  }

  // CORE CASHIER SCAN LOGIC: Continuous sequential processing with supermarket feedback
  async onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    const barcode = decodedText.trim();

    // Check debounce for the exact same barcode
    if (this.lastScannedCode === barcode && (now - this.lastScannedTime) < this.SAME_CODE_COOLDOWN_MS) {
      return; // Skip too-fast duplicate frame
    }

    const isDuplicate = this.ticketItems.some(item => item.barcode === barcode);
    this.lastScannedCode = barcode;
    this.lastScannedTime = now;

    // Visual scan laser flash
    this.flashLaser();

    // Audio & Haptic Feedback
    if (isDuplicate) {
      window.soundEngine.playDoubleBeep();
    } else {
      window.soundEngine.playBeep();
    }

    // Process product
    await this.addItemToTicket(barcode);
  }

  flashLaser() {
    const beam = document.getElementById('scanner-laser-beam');
    if (beam) {
      beam.classList.add('flash');
      setTimeout(() => beam.classList.remove('flash'), 180);
    }
  }

  async addItemToTicket(barcode) {
    // 1. Check if already in current ticket -> increment quantity!
    const existingIndex = this.ticketItems.findIndex(i => i.barcode === barcode);
    if (existingIndex !== -1) {
      this.ticketItems[existingIndex].quantity += 1;
      this.renderTicket();
      this.highlightItem(existingIndex);
      return;
    }

    // 2. Fetch product info from API/Cache/LocalCatalog
    const info = await window.productAPI.lookup(barcode);

    // 3. Fallback price based on category if 0
    let price = info.defaultPrice || 1.50;
    if (info.category === 'Pasta & Cereali' && !info.defaultPrice) price = 1.20;
    if (info.category === 'Freschi & Latticini' && !info.defaultPrice) price = 1.60;
    if (info.category === 'Bevande' && !info.defaultPrice) price = 1.10;

    const newItem = {
      barcode: barcode,
      name: info.name,
      brand: info.brand || '',
      category: info.category || 'Altro',
      quantity: 1,
      unit: 'pz',
      price: price,
      image: info.image || '',
      nutriscore: info.nutriscore || '',
      addedAt: new Date()
    };

    this.ticketItems.unshift(newItem); // Place newest at top of receipt
    this.renderTicket();
    this.highlightItem(0);
  }

  highlightItem(index) {
    setTimeout(() => {
      const items = document.querySelectorAll('.ticket-row');
      if (items && items[index]) {
        items[index].classList.add('just-scanned');
        setTimeout(() => items[index].classList.remove('just-scanned'), 800);
      }
    }, 50);
  }

  updateItemQuantity(index, delta) {
    if (!this.ticketItems[index]) return;
    this.ticketItems[index].quantity += delta;
    if (this.ticketItems[index].quantity <= 0) {
      this.ticketItems.splice(index, 1);
    }
    this.renderTicket();
  }

  removeItem(index) {
    if (!this.ticketItems[index]) return;
    this.ticketItems.splice(index, 1);
    window.soundEngine.playErrorBuzz();
    this.renderTicket();
  }

  clearTicket() {
    this.ticketItems = [];
    this.renderTicket();
  }

  renderTicket() {
    const listEl = document.getElementById('cashier-ticket-list');
    const totalCountEl = document.getElementById('ticket-total-count');
    const totalPriceEl = document.getElementById('ticket-total-price');
    const emptyNotice = document.getElementById('ticket-empty-state');
    const ticketFooter = document.getElementById('ticket-footer');

    if (!listEl) return;

    if (this.ticketItems.length === 0) {
      listEl.innerHTML = '';
      if (emptyNotice) emptyNotice.style.display = 'flex';
      if (ticketFooter) ticketFooter.style.display = 'none';
      if (totalCountEl) totalCountEl.textContent = '0 articoli';
      if (totalPriceEl) totalPriceEl.textContent = '0,00 €';
      return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';
    if (ticketFooter) ticketFooter.style.display = 'flex';

    let totalArticles = 0;
    let totalPrice = 0;

    listEl.innerHTML = this.ticketItems.map((item, idx) => {
      totalArticles += item.quantity;
      totalPrice += item.quantity * item.price;

      const subtotal = (item.quantity * item.price).toFixed(2);
      const nutriscoreBadge = item.nutriscore ? `<span class="nutriscore-badge nutriscore-${item.nutriscore.toLowerCase()}">${item.nutriscore}</span>` : '';

      return `
        <div class="ticket-row" data-idx="${idx}">
          <div class="ticket-col-info">
            <div class="ticket-name">
              ${escapeHtml(item.name)}
              ${nutriscoreBadge}
            </div>
            <div class="ticket-sub">
              ${item.brand ? `<span>${escapeHtml(item.brand)}</span> • ` : ''}
              <span>${item.category}</span>
              <span class="ticket-barcode">(${item.barcode})</span>
            </div>
          </div>
          <div class="ticket-col-qty">
            <button class="btn-qty" onclick="window.cashierScanner.updateItemQuantity(${idx}, -1)" title="Diminuisci">−</button>
            <span class="qty-badge">${item.quantity}</span>
            <button class="btn-qty" onclick="window.cashierScanner.updateItemQuantity(${idx}, 1)" title="Aumenta">+</button>
          </div>
          <div class="ticket-col-price">
            <span class="item-subtotal">${subtotal} €</span>
            <span class="item-unit-price">${item.price.toFixed(2)} €/pz</span>
          </div>
          <div class="ticket-col-action">
            <button class="btn-del" onclick="window.cashierScanner.removeItem(${idx})" title="Elimina dal nastro">✕</button>
          </div>
        </div>
      `;
    }).join('');

    if (totalCountEl) totalCountEl.textContent = `${totalArticles} articol${totalArticles === 1 ? 'o' : 'i'}`;
    if (totalPriceEl) totalPriceEl.textContent = `${totalPrice.toFixed(2)} €`;
  }

  // Commit scanned ticket based on active mode
  async submitTicket() {
    if (this.ticketItems.length === 0) {
      alert('Il nastro della cassa è vuoto. Scansiona prima qualche alimento!');
      return;
    }

    window.soundEngine.playCheckoutChime();

    if (this.targetMode === 'pantry_load') {
      await this.commitPantryLoad();
    } else if (this.targetMode === 'pantry_consume') {
      await this.commitPantryConsume();
    } else if (this.targetMode === 'shopping_list') {
      await this.commitShoppingList();
    }

    this.clearTicket();
  }

  async commitPantryLoad() {
    const today = new Date();
    // Default expiry 6 months from now if not specified
    const defaultExpiry = new Date(today);
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6);
    const expiryStr = defaultExpiry.toISOString().split('T')[0];

    const currentPantry = await window.dispensaDB.getAll('pantry');
    let totalSpent = 0;
    let totalItems = 0;

    for (const scanned of this.ticketItems) {
      totalSpent += (scanned.price * scanned.quantity);
      totalItems += scanned.quantity;

      // Check if item already exists in pantry (by barcode or exact name)
      const existing = currentPantry.find(p =>
        (scanned.barcode && p.barcode === scanned.barcode) ||
        (p.name.toLowerCase() === scanned.name.toLowerCase())
      );

      if (existing) {
        existing.quantity += scanned.quantity;
        existing.updatedAt = new Date().toISOString();
        if (scanned.price) existing.price = scanned.price;
        await window.dispensaDB.put('pantry', existing);
      } else {
        const newItem = {
          id: 'pantry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          barcode: scanned.barcode,
          name: scanned.name,
          brand: scanned.brand || '',
          category: scanned.category || 'Altro',
          location: scanned.category === 'Freschi & Latticini' ? 'Frigo' : (scanned.category === 'Surgelati' ? 'Freezer' : 'Dispensa'),
          quantity: scanned.quantity,
          unit: scanned.unit || 'pz',
          expiryDate: expiryStr,
          minQuantity: 1,
          price: scanned.price,
          image: scanned.image || '',
          nutriscore: scanned.nutriscore || '',
          notes: 'Caricato da cassa supermercato',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await window.dispensaDB.put('pantry', newItem);
      }
    }

    // Automatically record shopping expense!
    await window.dispensaDB.put('expenses', {
      id: 'exp-' + Date.now(),
      date: today.toISOString().split('T')[0],
      storeName: 'Supermercato (Cassa Smart)',
      totalAmount: parseFloat(totalSpent.toFixed(2)),
      itemsCount: totalItems,
      notes: `Caricati ${totalItems} articoli in dispensa tramite scansione rapida`,
      createdAt: today.toISOString()
    });

    window.pantryManager.loadPantry();
    window.shoppingManager.loadShoppingAndExpenses();
    showToast(`✅ ${totalItems} alimenti caricati in dispensa! Spesa di ${totalSpent.toFixed(2)}€ registrata.`);
  }

  async commitPantryConsume() {
    const currentPantry = await window.dispensaDB.getAll('pantry');
    let consumedCount = 0;
    const needBuyAlerts = [];

    for (const scanned of this.ticketItems) {
      const match = currentPantry.find(p =>
        (scanned.barcode && p.barcode === scanned.barcode) ||
        (p.name.toLowerCase() === scanned.name.toLowerCase())
      );

      if (match) {
        match.quantity = Math.max(0, match.quantity - scanned.quantity);
        match.updatedAt = new Date().toISOString();
        await window.dispensaDB.put('pantry', match);
        consumedCount += scanned.quantity;

        // Check if finished or below minQuantity
        if (match.quantity <= match.minQuantity) {
          needBuyAlerts.push(match);
        }
      }
    }

    window.pantryManager.loadPantry();

    if (needBuyAlerts.length > 0) {
      const names = needBuyAlerts.map(i => i.name).join(', ');
      showToast(`🍽️ Consumati ${consumedCount} articoli. Attenzione: [${names}] sono in esaurimento!`, 4000);
    } else {
      showToast(`🍽️ ${consumedCount} articoli consumati e scalati dalla dispensa.`);
    }
  }

  async commitShoppingList() {
    let addedCount = 0;
    for (const scanned of this.ticketItems) {
      await window.dispensaDB.put('shoppingList', {
        id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        barcode: scanned.barcode,
        name: scanned.name,
        brand: scanned.brand || '',
        category: scanned.category || 'Altro',
        quantity: scanned.quantity,
        unit: scanned.unit || 'pz',
        estimatedPrice: scanned.price || 1.50,
        checked: false,
        notes: 'Aggiunto da scanner cassa',
        createdAt: new Date().toISOString()
      });
      addedCount += scanned.quantity;
    }

    window.shoppingManager.loadShoppingAndExpenses();
    showToast(`🛒 ${addedCount} articoli aggiunti alla lista della spesa!`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.cashierScanner = new CashierScanner();
