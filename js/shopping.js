// Shopping List & Grocery Expense Tracking Module - jp27-trip style
class ShoppingManager {
  constructor() {
    this.shoppingItems = [];
    this.expenses = [];
  }

  async loadShoppingAndExpenses() {
    this.shoppingItems = await window.dispensaDB.getAll('shoppingList');
    this.expenses = await window.dispensaDB.getAll('expenses');
    this.renderShoppingList();
    this.renderExpenses();
    this.checkPantrySuggestions();
  }

  // SHOPPING LIST
  renderShoppingList() {
    const listEl = document.getElementById('shopping-items-list');
    const emptyEl = document.getElementById('shopping-empty-state');
    const summaryCountEl = document.getElementById('shop-total-count');
    const summaryPriceEl = document.getElementById('shop-total-price');

    if (!listEl) return;

    if (this.shoppingItems.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      if (summaryCountEl) summaryCountEl.textContent = '0 articoli';
      if (summaryPriceEl) summaryPriceEl.textContent = 'Previsto: 0,00 €';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    let totalArticles = 0;
    let totalPrice = 0;
    let checkedCount = 0;

    listEl.innerHTML = this.shoppingItems.map(item => {
      totalArticles += item.quantity;
      if (!item.checked) {
        totalPrice += (item.estimatedPrice || 0) * item.quantity;
      } else {
        checkedCount++;
      }

      return `
        <div class="shop-item-card ${item.checked ? 'is-checked' : ''}" id="shop-item-${item.id}">
          <div class="ios-check ${item.checked ? 'checked' : ''}" onclick="window.shoppingManager.toggleCheck('${item.id}')" title="Spunta articolo">
            ${item.checked ? '✓' : ''}
          </div>

          <div style="flex: 1; min-width: 0;">
            <div class="shop-title ${item.checked ? 'strikethrough' : ''}">
              ${escapeHtml(item.name)}
            </div>
            <div class="muted small">
              ${item.brand ? `<span>${escapeHtml(item.brand)}</span> • ` : ''}
              <span>${item.category || 'Altro'}</span>
              ${item.estimatedPrice ? ` • <span>${(item.estimatedPrice * item.quantity).toFixed(2)} €</span>` : ''}
            </div>
          </div>

          <div class="qty-stepper">
            <button class="btn-step" onclick="window.shoppingManager.updateQty('${item.id}', -1)">−</button>
            <span class="qty-val">${item.quantity} <small>${item.unit || 'pz'}</small></span>
            <button class="btn-step" onclick="window.shoppingManager.updateQty('${item.id}', 1)">+</button>
          </div>

          <button class="round" style="width: 30px; height: 30px; font-size: 0.8rem;" onclick="window.shoppingManager.deleteItem('${item.id}')" title="Rimuovi">
            ✕
          </button>
        </div>
      `;
    }).join('');

    if (summaryCountEl) summaryCountEl.textContent = `${totalArticles} articoli (${checkedCount} spuntati)`;
    if (summaryPriceEl) summaryPriceEl.textContent = `Previsto: ${totalPrice.toFixed(2)} €`;

    const checkoutBtn = document.getElementById('btn-checkout-shopping');
    if (checkoutBtn) {
      checkoutBtn.disabled = this.shoppingItems.length === 0;
    }
  }

  async toggleCheck(id) {
    const item = this.shoppingItems.find(i => i.id === id);
    if (!item) return;
    item.checked = !item.checked;
    await window.dispensaDB.put('shoppingList', item);
    window.soundEngine.playBeep();
    this.renderShoppingList();
  }

  async updateQty(id, delta) {
    const item = this.shoppingItems.find(i => i.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      await this.deleteItem(id);
      return;
    }
    await window.dispensaDB.put('shoppingList', item);
    this.renderShoppingList();
  }

  async deleteItem(id) {
    await window.dispensaDB.delete('shoppingList', id);
    this.shoppingItems = this.shoppingItems.filter(i => i.id !== id);
    this.renderShoppingList();
  }

  async clearCompleted() {
    const completed = this.shoppingItems.filter(i => i.checked);
    for (const item of completed) {
      await window.dispensaDB.delete('shoppingList', item.id);
    }
    this.shoppingItems = this.shoppingItems.filter(i => !i.checked);
    this.renderShoppingList();
    showToast(`🧹 Rimossi ${completed.length} articoli completati.`);
  }

  async quickAddItem() {
    const input = document.getElementById('quick-add-input');
    const catSelect = document.getElementById('quick-add-category');
    if (!input) return;

    const name = input.value.trim();
    if (!name) return;

    const newItem = {
      id: 'shop-' + Date.now(),
      barcode: '',
      name: name,
      brand: '',
      category: catSelect ? catSelect.value : 'Altro',
      quantity: 1,
      unit: 'pz',
      estimatedPrice: 1.50,
      checked: false,
      notes: '',
      createdAt: new Date().toISOString()
    };

    await window.dispensaDB.put('shoppingList', newItem);
    this.shoppingItems.push(newItem);
    input.value = '';
    window.soundEngine.playBeep();
    this.renderShoppingList();
    showToast(`🛒 "${name}" aggiunto alla spesa!`);
  }

  async checkPantrySuggestions() {
    const pantryItems = await window.dispensaDB.getAll('pantry');
    const suggestionsEl = document.getElementById('pantry-low-suggestions');
    if (!suggestionsEl) return;

    const lowItems = pantryItems.filter(p => {
      const isLow = p.quantity <= (p.minQuantity || 1);
      const alreadyInList = this.shoppingItems.some(s => s.name.toLowerCase() === p.name.toLowerCase());
      return isLow && !alreadyInList;
    });

    if (lowItems.length === 0) {
      suggestionsEl.style.display = 'none';
      return;
    }

    suggestionsEl.style.display = 'block';
    const pillsContainer = document.getElementById('suggestions-pills');
    if (pillsContainer) {
      pillsContainer.innerHTML = lowItems.slice(0, 6).map(item => `
        <button class="chip" onclick="window.shoppingManager.addSuggested('${item.id}')">
          + ${escapeHtml(item.name)} <small class="muted">(${item.quantity} rimasti)</small>
        </button>
      `).join('');
    }
  }

  async addSuggested(pantryId) {
    const pantryItems = await window.dispensaDB.getAll('pantry');
    const item = pantryItems.find(p => p.id === pantryId);
    if (!item) return;

    await window.dispensaDB.put('shoppingList', {
      id: 'shop-' + Date.now(),
      barcode: item.barcode || '',
      name: item.name,
      brand: item.brand || '',
      category: item.category || 'Altro',
      quantity: 1,
      unit: item.unit || 'pz',
      estimatedPrice: item.price || 1.50,
      checked: false,
      notes: 'Suggerito dalla dispensa',
      createdAt: new Date().toISOString()
    });

    window.soundEngine.playBeep();
    await this.loadShoppingAndExpenses();
    showToast(`🛒 "${item.name}" aggiunto alla spesa!`);
  }

  openCheckoutModal() {
    const itemsToMove = this.shoppingItems.filter(i => i.checked);
    const targetItems = itemsToMove.length > 0 ? itemsToMove : this.shoppingItems;

    if (targetItems.length === 0) {
      alert('La lista della spesa è vuota!');
      return;
    }

    let calculatedTotal = 0;
    targetItems.forEach(i => {
      calculatedTotal += (i.estimatedPrice || 1.50) * i.quantity;
    });

    document.getElementById('checkout-store-name').value = 'Supermercato';
    document.getElementById('checkout-total-amount').value = calculatedTotal.toFixed(2);
    document.getElementById('checkout-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('checkout-items-summary').textContent = `${targetItems.length} articoli verranno aggiunti alla dispensa`;

    const modal = document.getElementById('modal-checkout-spesa');
    if (modal) modal.removeAttribute('hidden');
  }

  closeCheckoutModal() {
    const modal = document.getElementById('modal-checkout-spesa');
    if (modal) modal.setAttribute('hidden', '');
  }

  async confirmCheckout() {
    const storeName = document.getElementById('checkout-store-name').value.trim() || 'Supermercato';
    const totalAmount = parseFloat(document.getElementById('checkout-total-amount').value) || 0;
    const date = document.getElementById('checkout-date').value || new Date().toISOString().split('T')[0];

    const itemsToMove = this.shoppingItems.filter(i => i.checked);
    const targetItems = itemsToMove.length > 0 ? itemsToMove : this.shoppingItems;

    const pantryItems = await window.dispensaDB.getAll('pantry');
    const today = new Date();
    const defaultExpiry = new Date(today);
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6);
    const expiryStr = defaultExpiry.toISOString().split('T')[0];

    for (const item of targetItems) {
      const match = pantryItems.find(p =>
        (item.barcode && p.barcode === item.barcode) ||
        (p.name.toLowerCase() === item.name.toLowerCase())
      );

      if (match) {
        match.quantity += item.quantity;
        match.updatedAt = new Date().toISOString();
        await window.dispensaDB.put('pantry', match);
      } else {
        await window.dispensaDB.put('pantry', {
          id: 'pantry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          barcode: item.barcode || '',
          name: item.name,
          brand: item.brand || '',
          category: item.category || 'Altro',
          location: item.category === 'Freschi & Latticini' ? 'Frigo' : (item.category === 'Surgelati' ? 'Freezer' : 'Dispensa'),
          quantity: item.quantity,
          unit: item.unit || 'pz',
          expiryDate: expiryStr,
          minQuantity: 1,
          price: item.estimatedPrice || 0,
          image: '',
          nutriscore: '',
          notes: `Acquistato da ${storeName}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await window.dispensaDB.delete('shoppingList', item.id);
    }

    await window.dispensaDB.put('expenses', {
      id: 'exp-' + Date.now(),
      date: date,
      storeName: storeName,
      totalAmount: totalAmount,
      itemsCount: targetItems.reduce((acc, curr) => acc + curr.quantity, 0),
      notes: `Spesa registrata da lista (${targetItems.length} prodotti)`,
      createdAt: new Date().toISOString()
    });

    window.soundEngine.playCheckoutChime();
    this.closeCheckoutModal();

    await this.loadShoppingAndExpenses();
    window.pantryManager.loadPantry();

    showToast(`🎉 Spesa completata! Prodotti trasferiti in dispensa e ${totalAmount.toFixed(2)}€ registrati nelle spese.`);
  }

  // EXPENSE TRACKING
  renderExpenses() {
    const listEl = document.getElementById('expenses-history-list');
    const emptyEl = document.getElementById('expenses-empty-state');
    const monthlyTotalEl = document.getElementById('expense-month-total');
    const tripCountEl = document.getElementById('expense-trip-count');
    const avgExpenseEl = document.getElementById('expense-avg-amount');

    if (!listEl) return;

    const sorted = [...this.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let monthTotal = 0;
    let monthTrips = 0;

    sorted.forEach(exp => {
      if (exp.date && exp.date.startsWith(currentYearMonth)) {
        monthTotal += (exp.totalAmount || 0);
        monthTrips++;
      }
    });

    const avg = monthTrips > 0 ? (monthTotal / monthTrips) : 0;

    if (monthlyTotalEl) monthlyTotalEl.textContent = `${monthTotal.toFixed(2)} €`;
    if (tripCountEl) tripCountEl.textContent = `${monthTrips} spese`;
    if (avgExpenseEl) avgExpenseEl.textContent = `${avg.toFixed(2)} €`;

    if (sorted.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = sorted.map(exp => {
      const d = exp.date ? new Date(exp.date).toLocaleDateString('it-IT') : '-';
      return `
        <div class="expense-slip-card">
          <div style="font-size: 1.6rem;">🧾</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(exp.storeName || 'Supermercato')}</div>
            <div class="muted small">
              <span>📅 ${d}</span>
              ${exp.itemsCount ? ` • <span>📦 ${exp.itemsCount} art.</span>` : ''}
              ${exp.notes ? ` • <span>${escapeHtml(exp.notes)}</span>` : ''}
            </div>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
            <span class="expense-slip-amount">${(exp.totalAmount || 0).toFixed(2)} €</span>
            <button class="round" style="width: 30px; height: 30px; font-size: 0.8rem;" onclick="window.shoppingManager.deleteExpense('${exp.id}')" title="Elimina scontrino">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async deleteExpense(id) {
    if (confirm('Eliminare questa spesa registrata?')) {
      await window.dispensaDB.delete('expenses', id);
      this.expenses = this.expenses.filter(e => e.id !== id);
      this.renderExpenses();
      showToast('🗑️ Spesa eliminata.');
    }
  }

  openManualExpenseModal() {
    document.getElementById('manual-exp-store').value = 'Supermercato';
    document.getElementById('manual-exp-amount').value = '';
    document.getElementById('manual-exp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('manual-exp-items').value = '';
    document.getElementById('manual-exp-notes').value = '';

    const modal = document.getElementById('modal-manual-expense');
    if (modal) modal.removeAttribute('hidden');
  }

  closeManualExpenseModal() {
    const modal = document.getElementById('modal-manual-expense');
    if (modal) modal.setAttribute('hidden', '');
  }

  async saveManualExpense() {
    const store = document.getElementById('manual-exp-store').value.trim() || 'Supermercato';
    const amount = parseFloat(document.getElementById('manual-exp-amount').value) || 0;
    const date = document.getElementById('manual-exp-date').value || new Date().toISOString().split('T')[0];
    const itemsCount = parseInt(document.getElementById('manual-exp-items').value) || 0;
    const notes = document.getElementById('manual-exp-notes').value.trim();

    if (amount <= 0) {
      alert('Inserisci un importo valido per la spesa!');
      return;
    }

    await window.dispensaDB.put('expenses', {
      id: 'exp-' + Date.now(),
      date,
      storeName: store,
      totalAmount: amount,
      itemsCount,
      notes,
      createdAt: new Date().toISOString()
    });

    window.soundEngine.playBeep();
    this.closeManualExpenseModal();
    await this.loadShoppingAndExpenses();
    showToast(`🧾 Spesa di ${amount.toFixed(2)}€ registrata!`);
  }
}

window.shoppingManager = new ShoppingManager();
