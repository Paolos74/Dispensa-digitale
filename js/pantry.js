// Pantry Management Module - jp27-trip style
class PantryManager {
  constructor() {
    this.items = [];
    this.currentCategory = 'all';
    this.currentLocation = 'all';
    this.currentStatus = 'all';
    this.searchQuery = '';
    this.sortBy = 'expiry_asc';
  }

  async loadPantry() {
    this.items = await window.dispensaDB.getAll('pantry');
    this.updateStats();
    this.renderPantryList();
  }

  updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expiringSoonCount = 0;
    let expiredCount = 0;
    let lowStockCount = 0;

    for (const item of this.items) {
      if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          expiredCount++;
        } else if (diffDays <= 4) {
          expiringSoonCount++;
        }
      }

      if (item.quantity <= (item.minQuantity || 1)) {
        lowStockCount++;
      }
    }

    const totalEl = document.getElementById('stat-total-items');
    const expiringEl = document.getElementById('stat-expiring-soon');
    const expiredEl = document.getElementById('stat-expired');
    const lowStockEl = document.getElementById('stat-low-stock');

    if (totalEl) totalEl.textContent = this.items.length;
    if (expiringEl) expiringEl.textContent = expiringSoonCount;
    if (expiredEl) expiredEl.textContent = expiredCount;
    if (lowStockEl) lowStockEl.textContent = lowStockCount;
  }

  setFilterCategory(cat) {
    this.currentCategory = cat;
    this.renderPantryList();
  }

  setFilterLocation(loc) {
    this.currentLocation = loc;
    this.renderPantryList();
  }

  setFilterStatus(status) {
    this.currentStatus = status;
    this.renderPantryList();
  }

  setSearchQuery(q) {
    this.searchQuery = (q || '').toLowerCase().trim();
    this.renderPantryList();
  }

  setSortBy(val) {
    this.sortBy = val;
    this.renderPantryList();
  }

  getFilteredItems() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.items.filter(item => {
      // Category filter
      if (this.currentCategory !== 'all' && item.category !== this.currentCategory) {
        return false;
      }
      // Location filter
      if (this.currentLocation !== 'all' && item.location !== this.currentLocation) {
        return false;
      }
      // Status filter
      if (this.currentStatus !== 'all') {
        const exp = item.expiryDate ? new Date(item.expiryDate) : null;
        if (exp) exp.setHours(0, 0, 0, 0);
        const diffDays = exp ? Math.ceil((exp - today) / (1000 * 60 * 60 * 24)) : 999;

        if (this.currentStatus === 'expiring' && (diffDays < 0 || diffDays > 4)) return false;
        if (this.currentStatus === 'expired' && diffDays >= 0) return false;
        if (this.currentStatus === 'low_stock' && item.quantity > (item.minQuantity || 1)) return false;
      }
      // Search query
      if (this.searchQuery) {
        const text = `${item.name} ${item.brand || ''} ${item.barcode || ''} ${item.category} ${item.location}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (this.sortBy === 'expiry_asc') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 9999999999999;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 9999999999999;
        return dateA - dateB;
      }
      if (this.sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (this.sortBy === 'qty_desc') {
        return b.quantity - a.quantity;
      }
      if (this.sortBy === 'recent') {
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      }
      return 0;
    });
  }

  renderPantryList() {
    const listEl = document.getElementById('pantry-grid');
    const emptyNotice = document.getElementById('pantry-empty-state');
    if (!listEl) return;

    const filtered = this.getFilteredItems();

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      if (emptyNotice) emptyNotice.style.display = 'block';
      return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    listEl.innerHTML = filtered.map(item => {
      let expiryBadge = '';
      let cardBorderClass = '';

      if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          expiryBadge = `<span class="pill danger">⚠️ Scaduto da ${Math.abs(diffDays)} gg</span>`;
          cardBorderClass = 'card-expired';
        } else if (diffDays === 0) {
          expiryBadge = `<span class="pill warn">⚡ Scade oggi!</span>`;
          cardBorderClass = 'card-warning';
        } else if (diffDays <= 4) {
          expiryBadge = `<span class="pill warn">⏳ Scade tra ${diffDays} gg</span>`;
          cardBorderClass = 'card-warning';
        } else {
          const dStr = exp.toLocaleDateString('it-IT');
          expiryBadge = `<span class="pill ok">Scad: ${dStr}</span>`;
        }
      }

      const isLowStock = item.quantity <= (item.minQuantity || 1);
      const lowStockBadge = isLowStock ? `<span class="pill shu">📉 Sotto scorta (${item.quantity}/${item.minQuantity || 1})</span>` : '';
      const locationEmoji = item.location === 'Frigo' ? '❄️ Frigo' : (item.location === 'Freezer' ? '🧊 Freezer' : (item.location === 'Cantina' ? '🍷 Cantina' : '🥫 Dispensa'));

      return `
        <div class="card pantry-card ${cardBorderClass}" id="pantry-card-${item.id}">
          <div class="card-top">
            <div>
              <div class="card-loc-kicker">${locationEmoji}</div>
              <div class="card-prod-title">${escapeHtml(item.name)}</div>
              ${item.brand ? `<div class="card-prod-brand">${escapeHtml(item.brand)}</div>` : ''}
            </div>
            <div style="display: flex; gap: 5px;">
              <button class="round" style="width:32px; height:32px; border-radius:10px; font-size:0.85rem;" onclick="window.pantryManager.openEditModal('${item.id}')" title="Modifica">✏️</button>
              <button class="round" style="width:32px; height:32px; border-radius:10px; font-size:0.85rem;" onclick="window.pantryManager.deleteItem('${item.id}')" title="Elimina">🗑️</button>
            </div>
          </div>

          <div class="card-badges-row">
            ${expiryBadge}
            ${lowStockBadge}
            <span class="pill ghost">${item.category}</span>
          </div>

          <div class="card-bottom-row">
            <div class="qty-stepper">
              <button class="btn-step" onclick="window.pantryManager.updateQty('${item.id}', -1)" title="Consuma 1">−</button>
              <span class="qty-val">${item.quantity} <small>${item.unit || 'pz'}</small></span>
              <button class="btn-step" onclick="window.pantryManager.updateQty('${item.id}', 1)" title="Aggiungi 1">+</button>
            </div>

            <button class="btn small ghost" style="color: var(--ai); font-weight: 700;" onclick="window.pantryManager.addToShoppingList('${item.id}')" title="Aggiungi alla lista spesa">
              🛒 Compra
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async updateQty(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.quantity = Math.max(0, item.quantity + delta);
    item.updatedAt = new Date().toISOString();

    if (delta > 0) {
      window.soundEngine.playBeep();
    } else {
      window.soundEngine.playDoubleBeep();
    }

    await window.dispensaDB.put('pantry', item);
    this.updateStats();
    this.renderPantryList();

    if (item.quantity === 0) {
      showToast(`⚠️ "${item.name}" è esaurito! Clicca su "Compra" per metterlo in lista spesa.`, 4000);
    }
  }

  async deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (confirm(`Rimuovere "${item.name}" dalla dispensa?`)) {
      await window.dispensaDB.delete('pantry', id);
      window.soundEngine.playErrorBuzz();
      await this.loadPantry();
      showToast(`🗑️ "${item.name}" rimosso dalla dispensa.`);
    }
  }

  async addToShoppingList(pantryId) {
    const item = this.items.find(i => i.id === pantryId);
    if (!item) return;

    const shoppingItem = {
      id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      barcode: item.barcode || '',
      name: item.name,
      brand: item.brand || '',
      category: item.category || 'Altro',
      quantity: 1,
      unit: item.unit || 'pz',
      estimatedPrice: item.price || 1.50,
      checked: false,
      notes: 'Aggiunto dalla dispensa',
      createdAt: new Date().toISOString()
    };

    await window.dispensaDB.put('shoppingList', shoppingItem);
    window.soundEngine.playBeep();
    window.shoppingManager.loadShoppingAndExpenses();
    showToast(`🛒 "${item.name}" aggiunto alla lista della spesa!`);
  }

  openAddModal() {
    document.getElementById('modal-title').textContent = 'Nuovo Alimento';
    document.getElementById('form-pantry-id').value = '';
    document.getElementById('form-barcode').value = '';
    document.getElementById('form-name').value = '';
    document.getElementById('form-brand').value = '';
    document.getElementById('form-category').value = 'Pasta & Cereali';
    document.getElementById('form-location').value = 'Dispensa';
    document.getElementById('form-qty').value = '1';
    document.getElementById('form-unit').value = 'pz';
    document.getElementById('form-min-qty').value = '1';
    document.getElementById('form-price').value = '1.50';

    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    document.getElementById('form-expiry').value = d.toISOString().split('T')[0];
    document.getElementById('form-notes').value = '';

    const modal = document.getElementById('modal-item');
    if (modal) modal.removeAttribute('hidden');
  }

  async openEditModal(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modal-title').textContent = 'Modifica Alimento';
    document.getElementById('form-pantry-id').value = item.id;
    document.getElementById('form-barcode').value = item.barcode || '';
    document.getElementById('form-name').value = item.name || '';
    document.getElementById('form-brand').value = item.brand || '';
    document.getElementById('form-category').value = item.category || 'Altro';
    document.getElementById('form-location').value = item.location || 'Dispensa';
    document.getElementById('form-qty').value = item.quantity || 1;
    document.getElementById('form-unit').value = item.unit || 'pz';
    document.getElementById('form-min-qty').value = item.minQuantity || 1;
    document.getElementById('form-price').value = item.price || 0;
    document.getElementById('form-expiry').value = item.expiryDate || '';
    document.getElementById('form-notes').value = item.notes || '';

    const modal = document.getElementById('modal-item');
    if (modal) modal.removeAttribute('hidden');
  }

  closeModal() {
    const modal = document.getElementById('modal-item');
    if (modal) modal.setAttribute('hidden', '');
  }

  async saveFromModal() {
    const id = document.getElementById('form-pantry-id').value;
    const name = document.getElementById('form-name').value.trim();
    if (!name) {
      alert('Inserisci il nome dell\'alimento!');
      return;
    }

    const barcode = document.getElementById('form-barcode').value.trim();
    const brand = document.getElementById('form-brand').value.trim();
    const category = document.getElementById('form-category').value;
    const location = document.getElementById('form-location').value;
    const quantity = parseFloat(document.getElementById('form-qty').value) || 1;
    const unit = document.getElementById('form-unit').value;
    const minQuantity = parseFloat(document.getElementById('form-min-qty').value) || 1;
    const price = parseFloat(document.getElementById('form-price').value) || 0;
    const expiryDate = document.getElementById('form-expiry').value;
    const notes = document.getElementById('form-notes').value.trim();

    const itemObj = {
      id: id || ('pantry-' + Date.now()),
      barcode,
      name,
      brand,
      category,
      location,
      quantity,
      unit,
      minQuantity,
      price,
      expiryDate,
      notes,
      updatedAt: new Date().toISOString(),
      createdAt: id ? (this.items.find(i => i.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    await window.dispensaDB.put('pantry', itemObj);

    if (barcode) {
      await window.dispensaDB.put('barcodeCache', {
        barcode,
        name,
        brand,
        category,
        quantityStr: `${quantity} ${unit}`,
        defaultPrice: price
      });
    }

    window.soundEngine.playBeep();
    this.closeModal();
    await this.loadPantry();
    showToast(`✅ "${name}" salvato con successo!`);
  }
}

window.pantryManager = new PantryManager();
