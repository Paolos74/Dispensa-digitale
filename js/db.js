// Database module using IndexedDB for offline storage with sample seeding
const DB_NAME = 'DispensaSmartDB';
const DB_VERSION = 1;

class DispensaDB {
  constructor() {
    this.db = null;
    this.readyPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Pantry store
        if (!db.objectStoreNames.contains('pantry')) {
          const pantryStore = db.createObjectStore('pantry', { keyPath: 'id' });
          pantryStore.createIndex('barcode', 'barcode', { unique: false });
          pantryStore.createIndex('category', 'category', { unique: false });
          pantryStore.createIndex('location', 'location', { unique: false });
          pantryStore.createIndex('expiryDate', 'expiryDate', { unique: false });
        }

        // 2. Shopping list store
        if (!db.objectStoreNames.contains('shoppingList')) {
          const shoppingStore = db.createObjectStore('shoppingList', { keyPath: 'id' });
          shoppingStore.createIndex('checked', 'checked', { unique: false });
          shoppingStore.createIndex('barcode', 'barcode', { unique: false });
        }

        // 3. Expenses store
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('date', 'date', { unique: false });
        }

        // 4. Barcode lookup cache
        if (!db.objectStoreNames.contains('barcodeCache')) {
          db.createObjectStore('barcodeCache', { keyPath: 'barcode' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        // Check if database needs initial sample seed
        await this.checkAndSeedDefaults();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Seed sample products if pantry is empty
  async checkAndSeedDefaults() {
    const count = await this.count('pantry');
    if (count === 0) {
      console.log('Seeding initial pantry and shopping data...');
      const today = new Date();
      const inDays = (d) => {
        const dt = new Date(today);
        dt.setDate(dt.getDate() + d);
        return dt.toISOString().split('T')[0];
      };

      const samplePantry = [
        {
          id: 'item-1',
          barcode: '8076809513753',
          name: 'Spaghetti n.5 (500g)',
          brand: 'Barilla',
          category: 'Pasta & Cereali',
          location: 'Dispensa',
          quantity: 3,
          unit: 'pz',
          expiryDate: inDays(180),
          minQuantity: 2,
          price: 1.15,
          image: '',
          nutriscore: 'A',
          notes: 'Pasta di semola grano 100% italiano'
        },
        {
          id: 'item-2',
          barcode: '8005110000000',
          name: 'Passata di Pomodoro (700g)',
          brand: 'Mutti',
          category: 'Conserve & Sughi',
          location: 'Dispensa',
          quantity: 4,
          unit: 'bottiglie',
          expiryDate: inDays(320),
          minQuantity: 2,
          price: 1.49,
          image: '',
          nutriscore: 'A',
          notes: 'Dolce e densa'
        },
        {
          id: 'item-3',
          barcode: '8001300214619',
          name: 'Latte Parzialmente Scremato (1L)',
          brand: 'Granarolo',
          category: 'Freschi & Latticini',
          location: 'Frigo',
          quantity: 2,
          unit: 'L',
          expiryDate: inDays(2), // Expiring in 2 days!
          minQuantity: 1,
          price: 1.35,
          image: '',
          nutriscore: 'B',
          notes: 'Aprire subito'
        },
        {
          id: 'item-4',
          barcode: '8000500310427',
          name: 'Nutella (450g)',
          brand: 'Ferrero',
          category: 'Snack & Dolci',
          location: 'Dispensa',
          quantity: 1,
          unit: 'vasetto',
          expiryDate: inDays(90),
          minQuantity: 1,
          price: 3.89,
          image: '',
          nutriscore: 'E',
          notes: 'Per la colazione'
        },
        {
          id: 'item-5',
          barcode: '8000050800010',
          name: 'Caffè Qualità Rossa (250g)',
          brand: 'Lavazza',
          category: 'Bevande',
          location: 'Dispensa',
          quantity: 1,
          unit: 'pz',
          expiryDate: inDays(240),
          minQuantity: 2, // Low stock alert!
          price: 3.20,
          image: '',
          nutriscore: 'B',
          notes: 'Gusto pieno ed equilibrato'
        },
        {
          id: 'item-6',
          barcode: '8004030040003',
          name: 'Yogurt Greco Bianco 0%',
          brand: 'Fage',
          category: 'Freschi & Latticini',
          location: 'Frigo',
          quantity: 1,
          unit: 'pz',
          expiryDate: inDays(-1), // Expired yesterday!
          minQuantity: 2,
          price: 1.60,
          image: '',
          nutriscore: 'A',
          notes: ''
        },
        {
          id: 'item-7',
          barcode: '8001120790100',
          name: 'Tonno all\'Olio d\'Oliva (3x80g)',
          brand: 'Rio Mare',
          category: 'Conserve & Sughi',
          location: 'Dispensa',
          quantity: 2,
          unit: 'confezioni',
          expiryDate: inDays(450),
          minQuantity: 1,
          price: 4.19,
          image: '',
          nutriscore: 'B',
          notes: 'Pescato sostenibile'
        }
      ];

      for (const item of samplePantry) {
        await this.put('pantry', {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        // Cache barcode lookup
        await this.put('barcodeCache', {
          barcode: item.barcode,
          name: item.name,
          brand: item.brand,
          category: item.category,
          quantityStr: '1 ' + item.unit,
          defaultPrice: item.price,
          nutriscore: item.nutriscore
        });
      }

      // Sample Shopping List
      const sampleShopping = [
        {
          id: 'shop-1',
          barcode: '8000050800010',
          name: 'Caffè Lavazza Qualità Rossa',
          brand: 'Lavazza',
          category: 'Bevande',
          quantity: 2,
          unit: 'pz',
          estimatedPrice: 3.20,
          checked: false,
          notes: 'Scorta in esaurimento',
          createdAt: new Date().toISOString()
        },
        {
          id: 'shop-2',
          barcode: '8001300214619',
          name: 'Latte Parzialmente Scremato',
          brand: 'Granarolo',
          category: 'Freschi & Latticini',
          quantity: 3,
          unit: 'L',
          estimatedPrice: 1.35,
          checked: false,
          notes: 'In scadenza tra 2 giorni',
          createdAt: new Date().toISOString()
        },
        {
          id: 'shop-3',
          barcode: '',
          name: 'Pane casereccio fresco',
          brand: 'Forno locale',
          category: 'Pasta & Cereali',
          quantity: 1,
          unit: 'kg',
          estimatedPrice: 3.50,
          checked: true,
          notes: 'Integrale o rustico',
          createdAt: new Date().toISOString()
        }
      ];

      for (const item of sampleShopping) {
        await this.put('shoppingList', item);
      }

      // Sample Expenses History
      const sampleExpenses = [
        {
          id: 'exp-1',
          date: inDays(-7),
          storeName: 'Esselunga',
          totalAmount: 48.70,
          itemsCount: 14,
          notes: 'Spesa settimanale scorte dispensa',
          createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
        },
        {
          id: 'exp-2',
          date: inDays(-15),
          storeName: 'Coop',
          totalAmount: 32.40,
          itemsCount: 8,
          notes: 'Freschi, frutta e latticini',
          createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
        }
      ];

      for (const exp of sampleExpenses) {
        await this.put('expenses', exp);
      }
    }
  }

  // Generic DB Operations
  async getAll(storeName) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Backup & Restore
  async exportAll() {
    const pantry = await this.getAll('pantry');
    const shoppingList = await this.getAll('shoppingList');
    const expenses = await this.getAll('expenses');
    const barcodeCache = await this.getAll('barcodeCache');

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      pantry,
      shoppingList,
      expenses,
      barcodeCache
    };
  }

  async importAll(data) {
    if (!data || !data.pantry) throw new Error('Formato backup non valido');

    await this.clear('pantry');
    await this.clear('shoppingList');
    await this.clear('expenses');
    await this.clear('barcodeCache');

    for (const item of (data.pantry || [])) await this.put('pantry', item);
    for (const item of (data.shoppingList || [])) await this.put('shoppingList', item);
    for (const item of (data.expenses || [])) await this.put('expenses', item);
    for (const item of (data.barcodeCache || [])) await this.put('barcodeCache', item);

    return true;
  }
}

window.dispensaDB = new DispensaDB();
