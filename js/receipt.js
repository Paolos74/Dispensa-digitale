// Supermarket Receipt Parser & Bulk Importer Module
class ReceiptManager {
  constructor() {
    this.parsedItems = [];
    this.receiptStore = 'Supermercato';
    this.receiptDate = new Date().toISOString().split('T')[0];
    this.receiptTotal = 0;
    this.isProcessingOCR = false;
  }

  openReceiptModal() {
    this.parsedItems = [];
    document.getElementById('receipt-textarea').value = '';
    document.getElementById('receipt-store-input').value = 'Supermercato';
    document.getElementById('receipt-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('receipt-ocr-status').style.display = 'none';
    document.getElementById('receipt-results-container').style.display = 'none';

    const sheet = document.getElementById('modal-receipt-import');
    if (sheet) sheet.removeAttribute('hidden');
  }

  closeReceiptModal() {
    const sheet = document.getElementById('modal-receipt-import');
    if (sheet) sheet.setAttribute('hidden', '');
  }

  // Load sample receipt to let user test immediately
  loadSampleReceipt() {
    const sample = `ESSELUNGA S.P.A.
SPAGHETTI BARILLA N.5 500G        1,15
PASSATA MUTTI 700G                1,49
LATTE PARZIALMENTE SCREMATO 1L    1,35
NUTELLA FERRERO 450G              3,89
TONNO RIO MARE OLIO OLIVA 3X80G   4,19
PISELLI NOVELLI FINDUS SURGELATI  2,49
CAFFE LAVAZZA QUALITA ROSSA 250G  3,20
BISCOTTI MULINO BIANCO 700G       2,89
YOGURT GRECO BIANCO 0% 170G       1,59
BANANE BIO CHICHITA KG 1.2        1,98
SUBTOTALE                        24,23
TOTALE COMPLESSIVO EURO          24,23
PAGAMENTO BANCOMAT               24,23
ARRIVEDERCI E GRAZIE`;

    document.getElementById('receipt-textarea').value = sample;
    this.parseTextInput();
  }

  // OCR Processing using Tesseract.js
  async processReceiptImage(file) {
    if (!file) return;

    const statusEl = document.getElementById('receipt-ocr-status');
    const statusText = document.getElementById('receipt-ocr-status-text');
    const progressBar = document.getElementById('receipt-ocr-progress');

    if (statusEl) statusEl.style.display = 'block';
    if (statusText) statusText.textContent = 'Analisi scontrino in corso con OCR (potrebbe richiedere qualche secondo)...';
    if (progressBar) progressBar.style.width = '20%';

    try {
      if (typeof Tesseract === 'undefined') {
        throw new Error('Motore OCR non caricato. Usa la modalità testo o incolla.');
      }

      const worker = await Tesseract.createWorker('ita', 1, {
        logger: m => {
          if (m.status === 'recognizing text' && progressBar) {
            const p = Math.floor(m.progress * 100);
            progressBar.style.width = `${Math.max(20, p)}%`;
            if (statusText) statusText.textContent = `Lettura testo scontrino: ${p}%...`;
          }
        }
      });

      const ret = await worker.recognize(file);
      await worker.terminate();

      if (statusEl) statusEl.style.display = 'none';

      const rawText = ret.data.text || '';
      document.getElementById('receipt-textarea').value = rawText;
      this.parseTextInput();
      showToast('📄 Testo estratto con successo dallo scontrino!');
    } catch (err) {
      console.warn('OCR error:', err);
      if (statusEl) statusEl.style.display = 'none';
      alert('Non è stato possibile leggere chiaramente la foto dello scontrino. Puoi incollare o digitare le righe nel riquadro di testo!');
    }
  }

  // Smart Italian Supermarket Receipt Parser
  parseTextInput() {
    const raw = document.getElementById('receipt-textarea').value;
    if (!raw.trim()) {
      alert('Inserisci o incolla il testo dello scontrino prima di analizzare.');
      return;
    }

    const lines = raw.split('\n');
    const items = [];
    let detectedStore = '';
    let detectedDate = '';
    let detectedTotal = 0;

    // Filter out typical receipt non-food keywords
    const blacklistWords = [
      'subtotale', 'sub-totale', 'totale', 'total', 'euro', 'eur', 'resto',
      'bancomat', 'carta', 'credit', 'debito', 'pos', 'contanti', 'cash',
      'iva', 'aliquota', 'sconto', 'punti', 'fidaty', 'fidelity', 'tessera',
      'transazione', 'scontrino', 'fiscale', 'documento', 'commerciale',
      'arriverderci', 'arrivederci', 'grazie', 'cassiere', 'cassa', 'operatore',
      'data', 'ora', 'terminale', 'partita iva', 'p.iva', 'cf', 'codice fiscale',
      'matricola', 'rt', 'mf', 'esercente', 'via', 'viale', 'corso', 'piazza',
      'tel', 'telefono', 'pec', 'www', 'http', 'aut.'
    ];

    const storeKeywords = {
      'esselunga': 'Esselunga',
      'coop': 'Coop',
      'conad': 'Conad',
      'lidl': 'Lidl',
      'carrefour': 'Carrefour',
      'eurospin': 'Eurospin',
      'pam': 'Pam',
      'penny': 'Penny Market',
      'bennet': 'Bennet',
      'despar': 'Despar',
      'interspar': 'Interspar',
      'iper': 'Iper',
      'tigros': 'Tigros',
      'unes': 'Unes',
      'aldi': 'Aldi',
      'ekom': 'Ekom',
      'in\'s': 'In\'s Mercato',
      'crai': 'Crai',
      'decò': 'Decò',
      'dipiù': 'Dipiù'
    };

    // Find Store Name
    for (const line of lines.slice(0, 10)) {
      const lower = line.toLowerCase();
      for (const [key, name] of Object.entries(storeKeywords)) {
        if (lower.includes(key)) {
          detectedStore = name;
          break;
        }
      }
      if (detectedStore) break;
    }

    // Date regex (e.g. 20/10/2026 or 20-10-26)
    const dateRegex = /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/;
    for (const line of lines) {
      const m = line.match(dateRegex);
      if (m) {
        let yr = m[3];
        if (yr.length === 2) yr = '20' + yr;
        const mo = m[2].padStart(2, '0');
        const da = m[1].padStart(2, '0');
        detectedDate = `${yr}-${mo}-${da}`;
        break;
      }
    }

    // Process item lines
    // Matches prices like "1,49", "1.49", "12,90", optionally followed by VAT code (A, B, C, 22, 10, 4)
    const priceRegex = /(\d+[,.]\d{2})\s*(?:[A-Z0-9%*]|\bEUR\b)?\s*$/i;

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) continue;

      const lower = trimmed.toLowerCase();

      // Check if line contains blacklisted header/footer words
      const isBlacklisted = blacklistWords.some(w => lower.startsWith(w) || lower.includes(' ' + w + ' ') || lower.endsWith(' ' + w));
      if (isBlacklisted) {
        // Look for total in blacklisted lines
        if (lower.includes('totale') || lower.includes('euro')) {
          const pm = trimmed.match(/(\d+[,.]\d{2})/);
          if (pm) {
            detectedTotal = parseFloat(pm[1].replace(',', '.'));
          }
        }
        continue;
      }

      // Try extracting price at the end
      const priceMatch = trimmed.match(priceRegex);
      let price = 0;
      let name = trimmed;

      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
        name = trimmed.substring(0, priceMatch.index).trim();
      }

      // Clean name from trailing weight, quantities or multipliers (e.g., "1 PZ X", "KG 0.5")
      name = name.replace(/^[\d\s*xX-]+/, '')
                 .replace(/\s+\d+[,.]\d+\s*(?:kg|g|pz|l|ml)?$/i, '')
                 .replace(/[*#|]+/g, '')
                 .trim();

      if (name.length < 2) continue;
      // Skip if name is purely numbers
      if (/^\d+$/.test(name)) continue;

      // Smart classification
      const category = this.guessCategory(name);
      const location = category === 'Freschi & Latticini' ? 'Frigo' : (category === 'Surgelati' ? 'Freezer' : 'Dispensa');

      items.push({
        id: 'parsed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: this.formatItemName(name),
        category,
        location,
        quantity: 1,
        unit: 'pz',
        price: price > 0 ? price : 1.50,
        selected: true
      });
    }

    this.parsedItems = items;
    if (detectedStore) this.receiptStore = detectedStore;
    if (detectedDate) this.receiptDate = detectedDate;

    this.renderParsedResults();
  }

  guessCategory(name) {
    const s = name.toLowerCase();
    if (s.includes('pasta') || s.includes('spagh') || s.includes('penn') || s.includes('fusill') || s.includes('riso') || s.includes('farin') || s.includes('cereali') || s.includes('cous') || s.includes('orzo') || s.includes('polenta')) {
      return 'Pasta & Cereali';
    }
    if (s.includes('latt') || s.includes('yogurt') || s.includes('formagg') || s.includes('mozzar') || s.includes('parmig') || s.includes('burro') || s.includes('ricotta') || s.includes('gorgon') || s.includes('prosciutt') || s.includes('salame') || s.includes('uov') || s.includes('bresaola') || s.includes('pollo') || s.includes('carne') || s.includes('fresch')) {
      return 'Freschi & Latticini';
    }
    if (s.includes('surg') || s.includes('frozen') || s.includes('gelat') || s.includes('findus') || s.includes('pisell') || s.includes('spinaci') || s.includes('merluzz') || s.includes('bastonc')) {
      return 'Surgelati';
    }
    if (s.includes('pomod') || s.includes('passat') || s.includes('polp') || s.includes('sugh') || s.includes('tonn') || s.includes('pesce') || s.includes('scatol') || s.includes('fagiol') || s.includes('ceci') || s.includes('lentic') || s.includes('mais') || s.includes('olive') || s.includes('sottoli')) {
      return 'Conserve & Sughi';
    }
    if (s.includes('biscott') || s.includes('snack') || s.includes('cioccol') || s.includes('nutell') || s.includes('croissant') || s.includes('merend') || s.includes('torta') || s.includes('dolc') || s.includes('patatin') || s.includes('cracker') || s.includes('fette')) {
      return 'Snack & Dolci';
    }
    if (s.includes('caff') || s.includes('acqua') || s.includes('the') || s.includes('te') || s.includes('vino') || s.includes('birr') || s.includes('bevand') || s.includes('succ') || s.includes('cola') || s.includes('aranciata')) {
      return 'Bevande';
    }
    if (s.includes('olio') || s.includes('acet') || s.includes('sal') || s.includes('pepe') || s.includes('spezi') || s.includes('maion') || s.includes('ketchup') || s.includes('condim')) {
      return 'Condimenti & Spezie';
    }
    if (s.includes('deters') || s.includes('lavatr') || s.includes('piatt') || s.includes('sapon') || s.includes('bagnosch') || s.includes('shampoo') || s.includes('cart') || s.includes('candegg') || s.includes('dentifr') || s.includes('puliz') || s.includes('igiene')) {
      return 'Igiene & Casa';
    }
    return 'Altro';
  }

  formatItemName(raw) {
    if (!raw) return 'Prodotto';
    // Capitalize words nicely
    return raw.toLowerCase()
              .split(' ')
              .filter(w => w.length > 0)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
  }

  renderParsedResults() {
    const container = document.getElementById('receipt-results-container');
    const tableBody = document.getElementById('receipt-items-tbody');
    const storeInput = document.getElementById('receipt-store-input');
    const dateInput = document.getElementById('receipt-date-input');
    const countBadge = document.getElementById('receipt-items-count');
    const totalBadge = document.getElementById('receipt-total-amount');

    if (!container || !tableBody) return;

    if (this.parsedItems.length === 0) {
      alert('Nessun articolo rilevato. Assicurati che il testo contenga righe con nomi e prezzi (es: "Pasta Barilla 1.15").');
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    if (storeInput) storeInput.value = this.receiptStore || 'Supermercato';
    if (dateInput) dateInput.value = this.receiptDate || new Date().toISOString().split('T')[0];

    this.updateResultsTotals();

    tableBody.innerHTML = this.parsedItems.map((item, idx) => `
      <tr class="receipt-parse-row ${!item.selected ? 'row-disabled' : ''}">
        <td style="text-align: center;">
          <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="window.receiptManager.toggleItemSelected(${idx}, this.checked)" style="width: 20px; height: 20px; accent-color: var(--shu);">
        </td>
        <td>
          <input type="text" value="${escapeHtml(item.name)}" oninput="window.receiptManager.updateItemName(${idx}, this.value)" style="min-height: 38px; padding: 6px 10px; font-weight: 600; font-size: 0.88rem;">
        </td>
        <td>
          <select onchange="window.receiptManager.updateItemCategory(${idx}, this.value)" style="min-height: 38px; padding: 6px 28px 6px 8px; font-size: 0.82rem;">
            <option value="Pasta & Cereali" ${item.category === 'Pasta & Cereali' ? 'selected' : ''}>Pasta & Cereali</option>
            <option value="Conserve & Sughi" ${item.category === 'Conserve & Sughi' ? 'selected' : ''}>Conserve</option>
            <option value="Freschi & Latticini" ${item.category === 'Freschi & Latticini' ? 'selected' : ''}>Freschi</option>
            <option value="Surgelati" ${item.category === 'Surgelati' ? 'selected' : ''}>Surgelati</option>
            <option value="Snack & Dolci" ${item.category === 'Snack & Dolci' ? 'selected' : ''}>Snack</option>
            <option value="Bevande" ${item.category === 'Bevande' ? 'selected' : ''}>Bevande</option>
            <option value="Condimenti & Spezie" ${item.category === 'Condimenti & Spezie' ? 'selected' : ''}>Condimenti</option>
            <option value="Igiene & Casa" ${item.category === 'Igiene & Casa' ? 'selected' : ''}>Igiene/Casa</option>
            <option value="Altro" ${item.category === 'Altro' ? 'selected' : ''}>Altro</option>
          </select>
        </td>
        <td>
          <select onchange="window.receiptManager.updateItemLocation(${idx}, this.value)" style="min-height: 38px; padding: 6px 28px 6px 8px; font-size: 0.82rem;">
            <option value="Dispensa" ${item.location === 'Dispensa' ? 'selected' : ''}>Dispensa</option>
            <option value="Frigo" ${item.location === 'Frigo' ? 'selected' : ''}>Frigo</option>
            <option value="Freezer" ${item.location === 'Freezer' ? 'selected' : ''}>Freezer</option>
            <option value="Cantina" ${item.location === 'Cantina' ? 'selected' : ''}>Cantina</option>
            <option value="Ripostiglio" ${item.location === 'Ripostiglio' ? 'selected' : ''}>Ripostiglio</option>
          </select>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="btn-step" onclick="window.receiptManager.updateItemQty(${idx}, -1)">−</button>
            <span style="min-width: 20px; text-align: center; font-weight: 700;">${item.quantity}</span>
            <button class="btn-step" onclick="window.receiptManager.updateItemQty(${idx}, 1)">+</button>
          </div>
        </td>
        <td>
          <input type="number" step="0.01" value="${item.price.toFixed(2)}" oninput="window.receiptManager.updateItemPrice(${idx}, this.value)" style="width: 75px; min-height: 38px; padding: 6px 8px; text-align: right; font-weight: 700; font-size: 0.88rem;">
        </td>
        <td style="text-align: center;">
          <button class="round" style="width: 28px; height: 28px; font-size: 0.75rem;" onclick="window.receiptManager.removeItem(${idx})" title="Elimina riga">✕</button>
        </td>
      </tr>
    `).join('');

    // Smooth scroll down to results
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  toggleItemSelected(idx, checked) {
    if (this.parsedItems[idx]) {
      this.parsedItems[idx].selected = checked;
      this.updateResultsTotals();
    }
  }

  updateItemName(idx, val) {
    if (this.parsedItems[idx]) this.parsedItems[idx].name = val;
  }

  updateItemCategory(idx, val) {
    if (this.parsedItems[idx]) {
      this.parsedItems[idx].category = val;
      if (val === 'Freschi & Latticini') this.parsedItems[idx].location = 'Frigo';
      else if (val === 'Surgelati') this.parsedItems[idx].location = 'Freezer';
      this.renderParsedResults();
    }
  }

  updateItemLocation(idx, val) {
    if (this.parsedItems[idx]) this.parsedItems[idx].location = val;
  }

  updateItemQty(idx, delta) {
    if (this.parsedItems[idx]) {
      this.parsedItems[idx].quantity = Math.max(1, this.parsedItems[idx].quantity + delta);
      this.renderParsedResults();
    }
  }

  updateItemPrice(idx, val) {
    const p = parseFloat(val);
    if (this.parsedItems[idx] && !isNaN(p)) {
      this.parsedItems[idx].price = p;
      this.updateResultsTotals();
    }
  }

  removeItem(idx) {
    this.parsedItems.splice(idx, 1);
    this.renderParsedResults();
  }

  updateResultsTotals() {
    const selected = this.parsedItems.filter(i => i.selected);
    const totalCount = selected.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = selected.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const countEl = document.getElementById('receipt-items-count');
    const totalEl = document.getElementById('receipt-total-amount');

    if (countEl) countEl.textContent = `${selected.length} articoli selezionati (${totalCount} pz)`;
    if (totalEl) totalEl.textContent = `${totalPrice.toFixed(2)} €`;
  }

  // Final Bulk Import to Pantry + Expense Tracking
  async commitReceiptToPantry() {
    const selected = this.parsedItems.filter(i => i.selected);
    if (selected.length === 0) {
      alert('Seleziona almeno un articolo da importare!');
      return;
    }

    const store = document.getElementById('receipt-store-input').value.trim() || 'Supermercato';
    const date = document.getElementById('receipt-date-input').value || new Date().toISOString().split('T')[0];

    const today = new Date();
    const defaultExpiry = new Date(today);
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6);
    const expiryStr = defaultExpiry.toISOString().split('T')[0];

    const pantryItems = await window.dispensaDB.getAll('pantry');
    let totalSpent = 0;
    let totalQuantity = 0;

    for (const item of selected) {
      totalSpent += (item.price * item.quantity);
      totalQuantity += item.quantity;

      // Check if existing item in pantry
      const match = pantryItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (match) {
        match.quantity += item.quantity;
        match.updatedAt = new Date().toISOString();
        if (item.price) match.price = item.price;
        await window.dispensaDB.put('pantry', match);
      } else {
        await window.dispensaDB.put('pantry', {
          id: 'pantry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          barcode: '',
          name: item.name,
          brand: '',
          category: item.category,
          location: item.location,
          quantity: item.quantity,
          unit: item.unit || 'pz',
          expiryDate: expiryStr,
          minQuantity: 1,
          price: item.price,
          image: '',
          nutriscore: '',
          notes: `Importato da scontrino ${store}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Save expense in budget tracker
    await window.dispensaDB.put('expenses', {
      id: 'exp-' + Date.now(),
      date,
      storeName: store,
      totalAmount: parseFloat(totalSpent.toFixed(2)),
      itemsCount: totalQuantity,
      notes: `Importati ${selected.length} articoli da scontrino`,
      createdAt: new Date().toISOString()
    });

    window.soundEngine.playCheckoutChime();
    this.closeReceiptModal();

    await window.pantryManager.loadPantry();
    await window.shoppingManager.loadShoppingAndExpenses();

    showToast(`🎉 ${selected.length} alimenti caricati in dispensa dallo scontrino! Spesa di ${totalSpent.toFixed(2)}€ registrata.`, 5000);
  }
}

window.receiptManager = new ReceiptManager();
