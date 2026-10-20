// Product Lookup API (Open Food Facts + Offline Local Dictionary)
class ProductAPI {
  constructor() {
    // Offline preloaded knowledge base of popular Italian food barcodes
    this.localCatalog = {
      '8076809513753': {
        name: 'Spaghetti n.5',
        brand: 'Barilla',
        category: 'Pasta & Cereali',
        quantityStr: '500g',
        nutriscore: 'A',
        defaultPrice: 1.15
      },
      '8076800195057': {
        name: 'Penne Rigate n.73',
        brand: 'Barilla',
        category: 'Pasta & Cereali',
        quantityStr: '500g',
        nutriscore: 'A',
        defaultPrice: 1.15
      },
      '8005110000000': {
        name: 'Passata di Pomodoro Classica',
        brand: 'Mutti',
        category: 'Conserve & Sughi',
        quantityStr: '700g',
        nutriscore: 'A',
        defaultPrice: 1.49
      },
      '8005110170109': {
        name: 'Polpa di Pomodoro in Finissimi Pezzi',
        brand: 'Mutti',
        category: 'Conserve & Sughi',
        quantityStr: '3x400g',
        nutriscore: 'A',
        defaultPrice: 2.29
      },
      '8000500310427': {
        name: 'Nutella Crema Spalmabile',
        brand: 'Ferrero',
        category: 'Snack & Dolci',
        quantityStr: '450g',
        nutriscore: 'E',
        defaultPrice: 3.89
      },
      '8000050800010': {
        name: 'Caffè Espresso Qualità Rossa',
        brand: 'Lavazza',
        category: 'Bevande',
        quantityStr: '250g',
        nutriscore: 'B',
        defaultPrice: 3.20
      },
      '8001300214619': {
        name: 'Latte UHT Parzialmente Scremato',
        brand: 'Granarolo',
        category: 'Freschi & Latticini',
        quantityStr: '1L',
        nutriscore: 'B',
        defaultPrice: 1.35
      },
      '8001120790100': {
        name: 'Tonno all\'Olio di Oliva',
        brand: 'Rio Mare',
        category: 'Conserve & Sughi',
        quantityStr: '3x80g',
        nutriscore: 'B',
        defaultPrice: 4.19
      },
      '8013355998822': {
        name: 'Olio Extra Vergine di Oliva Classico',
        brand: 'Monini',
        category: 'Condimenti & Spezie',
        quantityStr: '1L',
        nutriscore: 'C',
        defaultPrice: 7.90
      },
      '8076809572712': {
        name: 'Biscotti Pan di Stelle',
        brand: 'Mulino Bianco',
        category: 'Snack & Dolci',
        quantityStr: '700g',
        nutriscore: 'D',
        defaultPrice: 2.89
      },
      '8001210003001': {
        name: 'Acqua Minerale Naturale',
        brand: 'San Benedetto',
        category: 'Bevande',
        quantityStr: '1.5L',
        nutriscore: 'A',
        defaultPrice: 0.40
      },
      '8003710001002': {
        name: 'Piselli Novelli Surgelati',
        brand: 'Findus',
        category: 'Surgelati',
        quantityStr: '450g',
        nutriscore: 'A',
        defaultPrice: 2.49
      }
    };
  }

  // Look up product by barcode: 1) local DB cache, 2) Open Food Facts API, 3) fallback dictionary
  async lookup(barcode) {
    if (!barcode) return null;
    const cleanBarcode = barcode.trim();

    // 1. Check local IndexedDB cache
    try {
      const cached = await window.dispensaDB.get('barcodeCache', cleanBarcode);
      if (cached && cached.name) {
        return { ...cached, source: 'cache' };
      }
    } catch (e) {
      console.warn('Cache lookup error:', e);
    }

    // 2. Try Open Food Facts API (if online)
    if (navigator.onLine) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json`;
        const res = await fetch(url, { signal: controller });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 1 && data.product) {
            const prod = data.product;
            const mapped = {
              barcode: cleanBarcode,
              name: prod.product_name_it || prod.product_name || prod.generic_name_it || prod.generic_name || `Prodotto ${cleanBarcode}`,
              brand: prod.brands || '',
              category: this.mapCategory(prod.categories_tags, prod.categories),
              quantityStr: prod.quantity || '1 pz',
              image: prod.image_front_small_url || prod.image_url || '',
              nutriscore: (prod.nutriscore_grade || '').toUpperCase(),
              defaultPrice: 0,
              source: 'openfoodfacts'
            };

            // Save to IndexedDB cache
            window.dispensaDB.put('barcodeCache', mapped).catch(() => {});
            return mapped;
          }
        }
      } catch (err) {
        console.log('OFF API error or timeout, falling back to local catalog:', err.message);
      }
    }

    // 3. Fallback to local built-in dictionary
    if (this.localCatalog[cleanBarcode]) {
      const item = {
        barcode: cleanBarcode,
        ...this.localCatalog[cleanBarcode],
        source: 'localCatalog'
      };
      window.dispensaDB.put('barcodeCache', item).catch(() => {});
      return item;
    }

    // 4. Default placeholder for unknown barcode
    return {
      barcode: cleanBarcode,
      name: `Prodotto ${cleanBarcode.substring(cleanBarcode.length - 4)}`,
      brand: '',
      category: 'Altro',
      quantityStr: '1 pz',
      image: '',
      nutriscore: '',
      defaultPrice: 0,
      source: 'unknown'
    };
  }

  mapCategory(tags = [], categoryStr = '') {
    const text = (Array.isArray(tags) ? tags.join(' ') : '') + ' ' + (categoryStr || '');
    const lower = text.toLowerCase();

    if (lower.includes('pasta') || lower.includes('riso') || lower.includes('cereali') || lower.includes('farina')) {
      return 'Pasta & Cereali';
    }
    if (lower.includes('pomodor') || lower.includes('conserve') || lower.includes('sugh') || lower.includes('tonno') || lower.includes('scatolame')) {
      return 'Conserve & Sughi';
    }
    if (lower.includes('latte') || lower.includes('formagg') || lower.includes('yogurt') || lower.includes('fresch') || lower.includes('burro')) {
      return 'Freschi & Latticini';
    }
    if (lower.includes('surgelat') || lower.includes('frozen') || lower.includes('gelat')) {
      return 'Surgelati';
    }
    if (lower.includes('snack') || lower.includes('biscott') || lower.includes('cioccolat') || lower.includes('dolc')) {
      return 'Snack & Dolci';
    }
    if (lower.includes('bevand') || lower.includes('acqua') || lower.includes('caff') || lower.includes('te') || lower.includes('vino') || lower.includes('succo')) {
      return 'Bevande';
    }
    if (lower.includes('olio') || lower.includes('spezi') || lower.includes('aceto') || lower.includes('sale') || lower.includes('condiment')) {
      return 'Condimenti & Spezie';
    }
    if (lower.includes('pulizi') || lower.includes('igiene') || lower.includes('casa') || lower.includes('detersiv')) {
      return 'Igiene & Casa';
    }
    return 'Altro';
  }
}

window.productAPI = new ProductAPI();
