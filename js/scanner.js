// Supermarket Cashier Continuous Scanner Engine with Hardware Autofocus, Zoom & Dual Detection
class CashierScanner {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.currentCameraId = null;
    this.availableCameras = [];
    this.videoTrack = null;
    this.hasTorch = false;
    this.torchOn = false;
    this.hasZoom = false;
    this.currentZoom = 1;
    this.minZoom = 1;
    this.maxZoom = 3;

    // Native BarcodeDetector engine (Android Chrome hardware-accelerated)
    this.nativeDetector = null;
    this.nativeDetectLoopId = null;

    // Cashier Session Ticket (Nastro Cassa)
    this.ticketItems = [];
    this.targetMode = 'pantry_load'; // 'pantry_load', 'pantry_consume', 'shopping_list'

    // Cooldown tracking for sequential cashier scanning
    this.lastScannedCode = null;
    this.lastScannedTime = 0;
    this.SAME_CODE_COOLDOWN_MS = 1400;

    this.initNativeDetector();
  }

  async initNativeDetector() {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        console.log('[Scanner] Native BarcodeDetector supportato:', supported);
        this.nativeDetector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });
      } catch (e) {
        console.log('[Scanner] Native BarcodeDetector non disponibile:', e);
      }
    }
  }

  setMode(mode) {
    this.targetMode = mode;
    this.updateModeUI();
  }

  updateModeUI() {
    const badge = document.getElementById('cashier-mode-badge');
    const desc = document.getElementById('cashier-mode-desc');
    const submitBtn = document.getElementById('cashier-confirm-btn');

    if (!submitBtn) return;

    if (this.targetMode === 'pantry_load') {
      if (badge) badge.textContent = '📦 Carico Dispensa';
      if (desc) desc.textContent = 'Scansiona a nastro i prodotti comprati per caricarli nella dispensa.';
      submitBtn.innerHTML = 'Salva in Dispensa';
      submitBtn.className = 'btn primary';
    } else if (this.targetMode === 'pantry_consume') {
      if (badge) badge.textContent = '🍽️ Consumo / Scarico';
      if (desc) desc.textContent = 'Scansiona i prodotti mentre li usi per scalare la quantità dalla dispensa.';
      submitBtn.innerHTML = 'Conferma Consumo';
      submitBtn.className = 'btn dark';
    } else if (this.targetMode === 'shopping_list') {
      if (badge) badge.textContent = '🛒 Alla Lista Spesa';
      if (desc) desc.textContent = 'Scansiona le confezioni finite per aggiungerle direttamente alla lista della spesa.';
      submitBtn.innerHTML = 'Invia alla Spesa';
      submitBtn.className = 'btn primary';
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
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
      }

      // Advanced constraints for sharp barcode autofocus on mobile
      const cameraConstraints = {
        facingMode: { ideal: 'environment' },
        width: { min: 1280, ideal: 1920 },
        height: { min: 720, ideal: 1080 }
      };

      const config = {
        fps: 25,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Wide rectangular box optimized for horizontal 1D barcodes and QR codes
          return {
            width: Math.floor(viewfinderWidth * 0.90),
            height: Math.floor(viewfinderHeight * 0.55)
          };
        },
        aspectRatio: 1.333
      };

      await this.html5QrCode.start(
        cameraConstraints,
        config,
        (decodedText, decodedResult) => this.onScanSuccess(decodedText, decodedResult),
        (errorMessage) => {/* silent frame misses */}
      );

      this.isScanning = true;
      const statusText = document.getElementById('scanner-status-text');
      if (statusText) statusText.textContent = 'Scanner attivo: inquadra il codice a barre';

      // Setup Camera Hardware Capabilities (Autofocus, Zoom, Torch)
      this.setupHardwareTrack();

      // Start parallel native BarcodeDetector loop for maximum speed
      this.startNativeDetectLoop();

    } catch (err) {
      console.error('Camera start error:', err);
      const statusText = document.getElementById('scanner-status-text');
      if (statusText) statusText.textContent = 'Fotocamera non disponibile. Usa il simulatore o inserimento manuale.';
      this.isScanning = false;
    }
  }

  setupHardwareTrack() {
    setTimeout(async () => {
      const video = document.querySelector('#qr-reader video');
      if (!video || !video.srcObject) return;

      const track = video.srcObject.getVideoTracks()[0];
      if (!track) return;
      this.videoTrack = track;

      const capabilities = track.getCapabilities ? track.getCapabilities() : {};

      // 1. Force continuous autofocus on Android Chrome
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          console.log('[Camera] Autofocus continuo attivato');
        } catch (e) {
          console.warn('[Camera] Autofocus constraint non supportato:', e);
        }
      }

      // 2. Hardware Zoom (Key for sharp barcodes!)
      const zoomBtn = document.getElementById('btn-toggle-zoom');
      if (capabilities.zoom) {
        this.hasZoom = true;
        this.minZoom = capabilities.zoom.min || 1;
        this.maxZoom = Math.min(capabilities.zoom.max || 3, 3);
        if (zoomBtn) {
          zoomBtn.style.display = 'grid';
          zoomBtn.textContent = '1x';
        }
      } else {
        if (zoomBtn) zoomBtn.style.display = 'none';
      }

      // 3. Torch
      const torchBtn = document.getElementById('btn-toggle-torch');
      if (capabilities.torch) {
        this.hasTorch = true;
        if (torchBtn) torchBtn.style.display = 'grid';
      } else {
        if (torchBtn) torchBtn.style.display = 'none';
      }

      // 4. Tap to focus on camera
      const cameraBox = document.querySelector('.camera-container');
      if (cameraBox) {
        cameraBox.onclick = (e) => {
          if (e.target.closest('button')) return;
          this.triggerRefocus();
        };
      }
    }, 400);
  }

  async triggerRefocus() {
    if (!this.videoTrack) return;
    try {
      showToast('🎯 Messa a fuoco...', 1000);
      // Re-apply continuous autofocus
      await this.videoTrack.applyConstraints({
        advanced: [{ focusMode: 'continuous' }]
      });
    } catch (e) {
      console.warn('Refocus error:', e);
    }
  }

  async toggleZoom() {
    if (!this.videoTrack || !this.hasZoom) return;
    try {
      this.currentZoom = this.currentZoom === 1 ? Math.min(2, this.maxZoom) : 1;
      await this.videoTrack.applyConstraints({
        advanced: [{ zoom: this.currentZoom }]
      });
      const zoomBtn = document.getElementById('btn-toggle-zoom');
      if (zoomBtn) zoomBtn.textContent = `${this.currentZoom}x`;
      showToast(`🔍 Zoom ${this.currentZoom}x attivato`, 1200);
    } catch (e) {
      console.warn('Zoom error:', e);
    }
  }

  async toggleTorch() {
    if (!this.videoTrack || !this.hasTorch) return;
    try {
      this.torchOn = !this.torchOn;
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: this.torchOn }]
      });
      const torchBtn = document.getElementById('btn-toggle-torch');
      if (torchBtn) {
        torchBtn.style.background = this.torchOn ? 'var(--shu)' : 'rgba(255,255,255,0.85)';
        torchBtn.style.color = this.torchOn ? '#fff' : 'var(--ink)';
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

  // Parallel hardware BarcodeDetector loop for lightning-fast detection
  startNativeDetectLoop() {
    if (!this.nativeDetector) return;

    const detectFrame = async () => {
      if (!this.isScanning) return;

      const video = document.querySelector('#qr-reader video');
      if (video && video.readyState >= 2) {
        try {
          const barcodes = await this.nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              this.onScanSuccess(rawValue, null);
            }
          }
        } catch (e) {}
      }

      this.nativeDetectLoopId = setTimeout(detectFrame, 90);
    };

    detectFrame();
  }

  async stopCamera() {
    if (this.nativeDetectLoopId) {
      clearTimeout(this.nativeDetectLoopId);
      this.nativeDetectLoopId = null;
    }
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      this.isScanning = false;
    }
    this.videoTrack = null;
  }

  // CORE SCAN LOGIC
  async onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    const barcode = decodedText.trim();

    // Check debounce for the exact same barcode
    if (this.lastScannedCode === barcode && (now - this.lastScannedTime) < this.SAME_CODE_COOLDOWN_MS) {
      return;
    }

    const isDuplicate = this.ticketItems.some(item => item.barcode === barcode);
    this.lastScannedCode = barcode;
    this.lastScannedTime = now;

    // Visual laser flash
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
    // 1. If already on ticket -> increment quantity!
    const existingIndex = this.ticketItems.findIndex(i => i.barcode === barcode);
    if (existingIndex !== -1) {
      this.ticketItems[existingIndex].quantity += 1;
      this.renderTicket();
      this.highlightItem(existingIndex);
      return;
    }

    // 2. Fetch product info
    const info = await window.productAPI.lookup(barcode);

    // If product is unknown, prompt quick naming modal once
    if (info.source === 'unknown') {
      this.promptUnknownProduct(barcode);
      return;
    }

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

    this.ticketItems.unshift(newItem);
    this.renderTicket();
    this.highlightItem(0);
  }

  promptUnknownProduct(barcode) {
    const name = prompt(`Nuovo codice a barre rilevato: ${barcode}\n\nCome si chiama questo prodotto? (es. Biscotti, Passata, Yogurt...)`);
    if (name && name.trim()) {
      const cleanName = name.trim();
      const category = window.productAPI.mapCategory([], cleanName);
      const productObj = {
        barcode,
        name: cleanName,
        brand: '',
        category,
        quantityStr: '1 pz',
        defaultPrice: 1.50
      };

      // Cache permanently in IndexedDB
      window.dispensaDB.put('barcodeCache', productObj).catch(()=>{});

      this.ticketItems.unshift({
        barcode,
        name: cleanName,
        brand: '',
        category,
        quantity: 1,
        unit: 'pz',
        price: 1.50,
        nutriscore: '',
        addedAt: new Date()
      });
      this.renderTicket();
      this.highlightItem(0);
    }
  }

  highlightItem(index) {
    setTimeout(() => {
      const items = document.querySelectorAll('.ticket-row, .receipt-row');
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
      if (emptyNotice) emptyNotice.style.display = 'block';
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
        <div class="receipt-row" data-idx="${idx}">
          <div style="min-width: 0;">
            <div class="receipt-name">
              ${escapeHtml(item.name)}
              ${nutriscoreBadge}
            </div>
            <div class="receipt-sub">
              ${item.brand ? `<span>${escapeHtml(item.brand)}</span> • ` : ''}
              <span>${item.category}</span>
              <span style="font-family: monospace;">(${item.barcode})</span>
            </div>
          </div>
          <div class="qty-stepper">
            <button class="btn-step" onclick="window.cashierScanner.updateItemQuantity(${idx}, -1)" title="Diminuisci">−</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="btn-step" onclick="window.cashierScanner.updateItemQuantity(${idx}, 1)" title="Aumenta">+</button>
          </div>
          <div class="receipt-price">
            <div>${subtotal} €</div>
            <div class="muted small">${item.price.toFixed(2)} €/pz</div>
          </div>
          <button class="round" style="width: 28px; height: 28px; font-size: 0.8rem;" onclick="window.cashierScanner.removeItem(${idx})" title="Elimina">✕</button>
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
    const defaultExpiry = new Date(today);
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6);
    const expiryStr = defaultExpiry.toISOString().split('T')[0];

    const currentPantry = await window.dispensaDB.getAll('pantry');
    let totalSpent = 0;
    let totalItems = 0;

    for (const scanned of this.ticketItems) {
      totalSpent += (scanned.price * scanned.quantity);
      totalItems += scanned.quantity;

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

        if (match.quantity <= match.minQuantity) {
          needBuyAlerts.push(match);
        }
      }
    }

    window.pantryManager.loadPantry();

    if (needBuyAlerts.length > 0) {
      const names = needBuyAlerts.map(i => i.name).join(', ');
      showToast(`🍽️ Consumati ${consumedCount} articoli. [${names}] sono in esaurimento!`, 4000);
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
