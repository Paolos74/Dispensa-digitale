// PWA Lifecyle, Installation, Offline Monitoring & Updates
let deferredInstallPrompt = null;

class PWAManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.init();
  }

  async init() {
    this.setupNetworkMonitoring();
    this.setupInstallPrompt();
    await this.registerServiceWorker();
  }

  // Register Service Worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', {
          scope: './'
        });
        console.log('[PWA] Service Worker registrato con successo, scope:', registration.scope);

        // Check if there is an update waiting
        if (registration.waiting) {
          this.showUpdateBanner(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateBanner(newWorker);
              }
            });
          }
        });
      } catch (err) {
        console.warn('[PWA] Registrazione Service Worker non riuscita:', err);
      }

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Nuovo Service Worker attivo, ricaricamento app.');
        window.location.reload();
      });
    }
  }

  showUpdateBanner(worker) {
    const banner = document.getElementById('pwa-update-banner');
    if (banner) {
      banner.style.display = 'flex';
      const updateBtn = document.getElementById('btn-apply-update');
      if (updateBtn) {
        updateBtn.onclick = () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        };
      }
    }
  }

  // Network Monitoring
  setupNetworkMonitoring() {
    const updateStatus = () => {
      this.isOnline = navigator.onLine;
      const syncDot = document.getElementById('connection-sync-dot');
      if (syncDot) {
        if (this.isOnline) {
          syncDot.className = 'sync-dot on';
          syncDot.title = 'Stato connessione: Online';
        } else {
          syncDot.className = 'sync-dot offline';
          syncDot.title = 'Stato connessione: Offline';
        }
      }

      if (!this.isOnline) {
        showToast('📡 Modalità Offline: Dispensa e Cassa funzionano normalmente!', 4000);
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  // Install Prompt Handling
  setupInstallPrompt() {
    const installBtn = document.getElementById('btn-pwa-install');
    const installBanner = document.getElementById('pwa-install-banner');

    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent automatic browser banner
      e.preventDefault();
      deferredInstallPrompt = e;

      if (installBtn) installBtn.style.display = 'inline-flex';
      if (installBanner) installBanner.style.display = 'flex';
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installata con successo');
      deferredInstallPrompt = null;
      if (installBtn) installBtn.style.display = 'none';
      if (installBanner) installBanner.style.display = 'none';
      showToast('🎉 Dispensa Smart installata sulla schermata iniziale!');
    });

    // Check if already in standalone mode
    if (this.isStandalone()) {
      if (installBtn) installBtn.style.display = 'none';
      if (installBanner) installBanner.style.display = 'none';
    }
  }

  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  async promptInstall() {
    if (!deferredInstallPrompt) {
      if (this.isStandalone()) {
        alert('L\'applicazione è già installata in modalità standalone!');
      } else {
        alert('Per installare l\'app:\n- Su Android/Chrome: clicca sul menu dei 3 puntini e seleziona "Aggiungi a schermata Home" o "Installa app".\n- Su iOS Safari: tocca l\'icona Condividi e seleziona "Aggiungi alla schermata Home".');
      }
      return;
    }

    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] Scelta utente installazione:', outcome);
    deferredInstallPrompt = null;

    const installBtn = document.getElementById('btn-pwa-install');
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBtn) installBtn.style.display = 'none';
    if (installBanner) installBanner.style.display = 'none';
  }
}

window.pwaManager = new PWAManager();
