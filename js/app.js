// Main Application Controller & View Router - jp27-trip style
document.addEventListener('DOMContentLoaded', async () => {
  // Update header date pill
  updateHeaderDate();

  // Initialize navigation & scroll listener for compact header
  setupNavigation();
  setupHeaderScrollEffect();

  // Load initial data
  await window.pantryManager.loadPantry();
  await window.shoppingManager.loadShoppingAndExpenses();

  // Setup sound settings in UI
  setupSoundControls();

  // Setup backup buttons
  setupBackupControls();

  // Setup barcode quick simulator
  setupBarcodeSimulator();

  // Sync theme dropdown in settings
  const themeChoice = JSON.parse(localStorage.getItem("dispensa:theme") || '""');
  const themeSelect = document.getElementById('setting-theme-select');
  if (themeSelect) {
    themeSelect.value = themeChoice || 'auto';
  }

  // Check URL query parameters for view shortcuts
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'cashier') {
    switchView('cashier');
  } else if (view === 'shopping') {
    switchView('shopping');
  } else {
    switchView('pantry');
  }
});

// Format Header Date like jp27-trip (e.g. "Oggi, 20 Ott")
function updateHeaderDate() {
  const el = document.getElementById('header-date');
  if (!el) return;
  const now = new Date();
  const dayName = now.toLocaleDateString('it-IT', { weekday: 'short' });
  const dayNum = now.getDate();
  const month = now.toLocaleDateString('it-IT', { month: 'short' });
  const cap = str => str.charAt(0).toUpperCase() + str.slice(1).replace('.', '');
  el.textContent = `${cap(dayName)} ${dayNum} ${cap(month)}`;
}

// Compact header border on scroll (jp27-trip style)
function setupHeaderScrollEffect() {
  const topBar = document.getElementById('top-bar');
  if (!topBar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      topBar.classList.add('compact');
    } else {
      topBar.classList.remove('compact');
    }
  }, { passive: true });
}

// View Navigation (.tab-link & .tabs da jp27-trip)
function setupNavigation() {
  const navTabs = document.querySelectorAll('.tab-link, .nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.dataset.view;
      if (target) switchView(target);
    });
  });
}

function switchView(viewName) {
  const tabs = document.querySelectorAll('.tab-link, .nav-tab');
  const sections = document.querySelectorAll('.view-section');
  const headerAddBtn = document.getElementById('header-add-btn');
  const ctitle = document.getElementById('ctitle');

  tabs.forEach(t => {
    const isTarget = t.dataset.view === viewName;
    t.classList.toggle('on', isTarget);
    t.classList.toggle('active', isTarget);
  });

  sections.forEach(s => {
    const isTarget = s.id === `view-${viewName}`;
    s.classList.toggle('active', isTarget);
  });

  // Dynamic header title & action button based on active view
  if (viewName === 'pantry') {
    if (ctitle) ctitle.textContent = 'La Mia Dispensa';
    if (headerAddBtn) {
      headerAddBtn.style.display = 'grid';
      headerAddBtn.onclick = () => window.pantryManager.openAddModal();
    }
    window.pantryManager.loadPantry();
  } else if (viewName === 'cashier') {
    if (ctitle) ctitle.textContent = 'Cassa Scanner';
    if (headerAddBtn) {
      headerAddBtn.style.display = 'none';
    }
    window.cashierScanner.startCamera();
    window.cashierScanner.renderTicket();
  } else if (viewName === 'shopping') {
    if (ctitle) ctitle.textContent = 'Spesa & Budget';
    if (headerAddBtn) {
      headerAddBtn.style.display = 'grid';
      headerAddBtn.onclick = () => window.shoppingManager.openManualExpenseModal();
    }
    window.shoppingManager.loadShoppingAndExpenses();
  } else if (viewName === 'settings') {
    if (ctitle) ctitle.textContent = 'Opzioni & Backup';
    if (headerAddBtn) headerAddBtn.style.display = 'none';
  }

  // Stop camera if not in cashier view
  if (viewName !== 'cashier') {
    window.cashierScanner.stopCamera();
  }

  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Quick Barcode / Supermarket Scanner Simulator
function setupBarcodeSimulator() {
  const simButtons = document.querySelectorAll('.btn-sim-code, .sim-chips .chip[data-code]');
  simButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      if (code) {
        window.cashierScanner.onScanSuccess(code, null);
      }
    });
  });

  const manualInput = document.getElementById('manual-barcode-input');
  const manualBtn = document.getElementById('btn-manual-scan');

  if (manualBtn && manualInput) {
    const triggerManual = () => {
      const code = manualInput.value.trim();
      if (code) {
        window.cashierScanner.onScanSuccess(code, null);
        manualInput.value = '';
      }
    };
    manualBtn.addEventListener('click', triggerManual);
    manualInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') triggerManual();
    });
  }

  // File barcode scanning input
  const fileInput = document.getElementById('qr-input-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
          if (!window.cashierScanner.html5QrCode) {
            window.cashierScanner.html5QrCode = new Html5Qrcode('qr-reader');
          }
          const res = await window.cashierScanner.html5QrCode.scanFile(file, true);
          window.cashierScanner.onScanSuccess(res, null);
        } catch (err) {
          alert('Nessun codice a barre o QR code rilevato nell\'immagine.');
        }
      }
    });
  }
}

// Sound & Audio Controls
function setupSoundControls() {
  const muteCheck = document.getElementById('setting-mute-sound');
  const volRange = document.getElementById('setting-volume');

  if (muteCheck) {
    muteCheck.checked = window.soundEngine.muted;
    muteCheck.addEventListener('change', (e) => {
      window.soundEngine.setMuted(e.target.checked);
    });
  }

  if (volRange) {
    volRange.value = window.soundEngine.volume;
    volRange.addEventListener('input', (e) => {
      window.soundEngine.setVolume(parseFloat(e.target.value));
    });
  }
}

// Backup & Data Export/Import
function setupBackupControls() {
  const exportBtn = document.getElementById('btn-export-data');
  const importInput = document.getElementById('input-import-data');
  const resetBtn = document.getElementById('btn-reset-db');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const data = await window.dispensaDB.exportAll();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-dispensa-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 Backup scaricato con successo!');
      } catch (err) {
        alert('Errore esportazione: ' + err.message);
      }
    });
  }

  if (importInput) {
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (confirm('Questo backup sovrascriverà tutti i dati attuali della dispensa. Vuoi continuare?')) {
          await window.dispensaDB.importAll(data);
          await window.pantryManager.loadPantry();
          await window.shoppingManager.loadShoppingAndExpenses();
          showToast('✅ Dati ripristinati con successo!');
        }
      } catch (err) {
        alert('File non valido o corrotto: ' + err.message);
      }
      importInput.value = '';
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Vuoi ripristinare i dati di esempio iniziali? I dati attuali verranno sostituiti.')) {
        await window.dispensaDB.clear('pantry');
        await window.dispensaDB.clear('shoppingList');
        await window.dispensaDB.clear('expenses');
        await window.dispensaDB.clear('barcodeCache');
        await window.dispensaDB.checkAndSeedDefaults();
        await window.pantryManager.loadPantry();
        await window.shoppingManager.loadShoppingAndExpenses();
        showToast('🔄 Dati di esempio ripristinati!');
      }
    });
  }
}

// Global Toast Notifications
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('visible'), 20);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}
