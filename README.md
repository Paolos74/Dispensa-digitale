# 🥫 Dispensa & Cassa Smart - Progressive Web App (PWA)

Una Progressive Web App moderna, installabile e funzionante **100% offline**, progettata per la gestione completa delle scorte in dispensa, il tracking delle spese e l'inserimento rapido continuo dei prodotti tramite fotocamera (modalità Cassa Supermercato).

---

## 🌟 Funzionalità Principali

### 1. 🥫 Gestione e Tracking della Dispensa
- **Monitoraggio scorte in tempo reale**: conteggio totale, alimenti in scadenza a breve (≤ 4 giorni), alimenti scaduti e prodotti sotto scorta minima.
- **Badge di scadenza dinamici**:
  - 🟢 *Buono* (data di scadenza con formattazione italiana)
  - 🟡 *In Scadenza* (countdown dei giorni rimanenti)
  - 🔴 *Scaduto* (evidenziazione e conteggio dei giorni passati)
- **Filtri avanzati e ricerca istantanea**:
  - Filtro per categoria (*Pasta & Cereali, Conserve & Sughi, Freschi & Latticini, Surgelati, Snack & Dolci, Bevande, Condimenti, Igiene & Casa, Altro*)
  - Filtro per posizione fisica (*Dispensa, Frigo, Freezer, Cantina, Ripostiglio*)
  - Ordinamento intelligente (scadenza più vicina, nome alfabetico, quantità, data modifica)
- **Controllo rapido delle quantità**: pulsanti `+` e `−` diretti sulle schede con salvataggio immediato e avviso quando un prodotto finisce.
- **Integrazione diretta con la spesa**: pulsante `🛒 Compra` su ogni prodotto per aggiungerlo con 1 click alla lista della spesa.

### 2. 🛒 Tracking della Spesa e Budget
- **Lista della Spesa Intelligente**:
  - Inserimento rapido di nuovi articoli con categoria.
  - **Banner Suggerimenti Automatici**: rileva gli articoli esauriti o sotto scorta in dispensa e propone di aggiungerli con un tocco.
  - Caselle di spunta personalizzate con barratura per gli articoli già messi nel carrello.
  - Conteggio articoli e stima del costo complessivo previsto.
- **Trasferimento Diretto in Dispensa ("Ho fatto la spesa!")**:
  - Con un solo click trasferisce gli articoli acquistati direttamente nell'inventario della dispensa.
  - Registra automaticamente la transazione monetaria nello storico delle spese.
- **Tracking delle Spese & Statistiche Budget**:
  - Calcolo del **Totale Speso nel Mese Corrente**, **Numero di Spese** e **Spesa Media**.
  - Storico cronologico degli scontrini con negozio, data, articoli e importo in €.
  - Modalità per registrare manualmente scontrini cartacei.

### 3. 📟 Scanner Cassa Supermercato (Scansione Continua a Nastro)
- **Esperienza cassa realistica**:
  - Scansione continua: non si ferma dopo un singolo prodotto, permettendo di passare gli alimenti uno dopo l'altro come su un nastro di cassa del supermercato.
  - **Feedback Audio & Tattile**: sintetizzatore Web Audio API con l'iconico segnale acustico ad alta frequenza (*bip* da cassa POS), doppio bip vivace all'incremento di quantità e vibrazione aptica sui dispositivi mobili.
  - **Gestione intelligente del Cooldown**: previene i micro-doppi scatti sullo stesso codice per 1.4s, ma accetta istantaneamente senza ritardo codici diversi passati in rapida sequenza.
  - Se ripassi lo stesso prodotto, aumenta automaticamente la quantità (`2x`, `3x`) con animazione sul nastro.
- **Nastro Cassa Live (Running Receipt)**:
  - Visualizzazione in tempo reale degli articoli passati, subtotali in €, conteggio pezzi e costo progressivo.
- **Tre Modalità Operative**:
  1. **📦 Carico Dispensa**: per registrare la spesa appena tornati a casa.
  2. **🍽️ Scarico / Consumo**: per scalare i prodotti mentre cucini.
  3. **🛒 Aggiungi a Lista Spesa**: per scannerizzare la scatola vuota prima di buttarla.
- **Riconoscimento Prodotti**:
  - Integrazione con **Open Food Facts API** (scarica nome, marca, categoria e nutriscore).
  - **Dizionario Offline Italiano** precaricato con i prodotti di largo consumo più popolari (Barilla, Mutti, Ferrero, Granarolo, Lavazza, Rio Mare, ecc.).
  - Cache locale in IndexedDB per il funzionamento senza connessione.
  - **Simulatore Rapido**: pulsanti di test per provare lo scanner anche senza webcam fisica o prodotti sottomano.

---

## 📱 Caratteristiche Progressive Web App (PWA)

Conforme a tutti i criteri di installabilità del documento di skill:
- **Web App Manifest (`manifest.json`)**: icone in tutte le risoluzioni standard (72, 96, 128, 144, 152, 192, 384, 512px + icona maskable adattiva), tema scuro (`#0f172a`), colore primario (`#10b981`), scorciatoie rapide per le schermate.
- **Service Worker (`sw.js`)**:
  - Pre-caching completo di tutti gli asset statici (HTML, CSS, JS, librerie, icone).
  - Strategia *Cache-First* per caricamento istantaneo offline.
  - Strategia *Network-First* con cache locale per le chiamate API esterne.
  - Pagina di fallback offline (`offline.html`).
  - Gestione degli aggiornamenti via `skipWaiting`.
- **Intercettazione `beforeinstallprompt`**: pulsante "Installa App" e banner nativo per l'aggiunta alla schermata Home su Android, Windows e Mac.
- **Indicatore Stato Rete**: pillola dinamica `Online / Offline` con sincronizzazione automatica.

---

## 🚀 Come Avviare l'Applicazione

I Service Worker e le API della fotocamera richiedono di essere eseguiti su `localhost` o `https`. È fornito uno script pronto per PowerShell:

1. Apri una finestra di PowerShell e posizionati nella cartella del progetto:
   ```powershell
   cd C:\Users\fpschiav\.gemini\antigravity\scratch\dispensa-pwa
   ```
2. Esegui il server web locale:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-server.ps1
   ```
3. Il server si avvierà su `http://localhost:8080/` e aprirà automaticamente il tuo browser!

---

## 📁 Struttura dei File

```
dispensa-pwa/
├── index.html              # Shell principale dell'applicazione (SPA)
├── offline.html            # Pagina di fallback offline
├── manifest.json           # Manifest PWA con metadati e icone
├── sw.js                   # Service Worker con logica di caching avanzata
├── start-server.ps1        # Server HTTP locale rapido per Windows
├── css/
│   └── style.css           # Design moderno, responsivo e dark mode
├── js/
│   ├── app.js              # Routing viste, simulatori e inizializzazione
│   ├── audio.js            # Sintetizzatore Web Audio API per bip cassa e vibrazioni
│   ├── db.js               # Storage persistente IndexedDB e seed dati
│   ├── api.js              # Open Food Facts API e catalogo offline italiano
│   ├── scanner.js          # Motore scansione continua stile cassa supermercato
│   ├── pantry.js           # Gestione scorte, scadenze e filtri dispensa
│   ├── shopping.js         # Lista della spesa e tracking delle spese
│   └── pwa.js              # Registrazione Service Worker, offline & install prompt
├── lib/
│   └── html5-qrcode.min.js # Motore di decodifica Barcode & QR vendored offline
└── icons/                  # Icone PWA generate per tutte le risoluzioni
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    ├── icon-512.png
    ├── icon-maskable.png
    └── apple-touch-icon.png
```

---

## 💾 Backup e Sicurezza Dati
Dalla scheda **Impostazioni**, puoi in qualsiasi momento cliccare su **"Scarica Backup JSON"** per salvare una copia di sicurezza di tutti i tuoi alimenti, liste della spesa e scontrini registrati.
