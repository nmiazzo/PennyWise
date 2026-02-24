import { Injectable, signal } from '@angular/core';
import {
  Product,
  SupermarketPriceData,
  PriceRecord,
  PennyWiseDatabase,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
} from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly _products = signal<Product[]>(this.loadProducts());
  private readonly _brands = signal<string[]>(this.loadBrands());
  private readonly _selectedBrand = signal<string>(this.loadSelectedBrand());

  readonly products = this._products.asReadonly();
  readonly brands = this._brands.asReadonly();
  readonly selectedBrand = this._selectedBrand.asReadonly();

  // --- localStorage I/O ---

  private loadProducts(): Product[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistProducts(products: Product[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this._products.set(products);
  }

  private loadBrands(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BRANDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistBrands(brands: string[]): void {
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
    this._brands.set(brands);
  }

  private loadSelectedBrand(): string {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_BRAND) ?? '';
  }

  setSelectedBrand(brand: string): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_BRAND, brand);
    this._selectedBrand.set(brand);
  }

  clearSelectedBrand(): void {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_BRAND);
    this._selectedBrand.set('');
  }

  // --- Product CRUD ---

  getProduct(barcode: string): Product | null {
    return this._products().find((p) => p.barcode === barcode) ?? null;
  }

  saveProduct(product: Product): void {
    const products = [...this._products()];
    const index = products.findIndex((p) => p.barcode === product.barcode);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.push(product);
    }
    this.persistProducts(products);
  }

  deleteProduct(barcode: string): void {
    this.persistProducts(
      this._products().filter((p) => p.barcode !== barcode),
    );
  }

  updateProductName(barcode: string, name: string): void {
    const product = this.getProduct(barcode);
    if (!product) return;
    product.name = name.trim() || barcode;
    this.saveProduct(product);
  }

  // --- Brand management ---

  addBrand(brand: string): void {
    const normalized = brand.trim();
    if (!normalized) return;
    const brands = this._brands();
    if (!brands.some((b) => b.toLowerCase() === normalized.toLowerCase())) {
      this.persistBrands([...brands, normalized].sort());
    }
  }

  // --- Price operations ---

  addOrUpdatePrice(
    barcode: string,
    brand: string,
    priceCents: number,
    isDiscounted: boolean,
    productName?: string,
  ): void {
    let product = this.getProduct(barcode);
    const now = Date.now();
    const record: PriceRecord = { price: priceCents, timestamp: now };

    if (!product) {
      product = {
        barcode,
        name: productName ?? barcode,
        supermarkets: [],
      };
    }

    if (productName) {
      product.name = productName;
    }

    let smEntry = product.supermarkets.find(
      (s) => s.brand.toLowerCase() === brand.toLowerCase(),
    );

    if (!smEntry) {
      smEntry = { brand, fullPriceHistory: [], discountedPrice: null };
      product.supermarkets.push(smEntry);
    }

    if (isDiscounted) {
      smEntry.discountedPrice = record;
    } else {
      smEntry.fullPriceHistory.push(record);
    }

    this.saveProduct(product);
    this.addBrand(brand);
  }

  removeDiscountedPrice(barcode: string, brand: string): void {
    const product = this.getProduct(barcode);
    if (!product) return;
    const smEntry = product.supermarkets.find(
      (s) => s.brand.toLowerCase() === brand.toLowerCase(),
    );
    if (smEntry) {
      smEntry.discountedPrice = null;
      this.saveProduct(product);
    }
  }

  // --- Export ---

  exportDatabase(): PennyWiseDatabase {
    return {
      products: this._products(),
      brands: this._brands(),
      exportedAt: Date.now(),
      version: CURRENT_SCHEMA_VERSION,
    };
  }

  // --- Import with merge ---

  importDatabase(
    data: PennyWiseDatabase,
  ): { productsAdded: number; productsUpdated: number; brandsAdded: number } {
    const stats = { productsAdded: 0, productsUpdated: 0, brandsAdded: 0 };
    const existingProducts = [...this._products()];

    for (const importedProduct of data.products) {
      const existingIndex = existingProducts.findIndex(
        (p) => p.barcode === importedProduct.barcode,
      );

      if (existingIndex < 0) {
        existingProducts.push(importedProduct);
        stats.productsAdded++;
      } else {
        const existing = existingProducts[existingIndex];

        for (const importedSm of importedProduct.supermarkets) {
          const existingSm = existing.supermarkets.find(
            (s) => s.brand.toLowerCase() === importedSm.brand.toLowerCase(),
          );

          if (!existingSm) {
            existing.supermarkets.push(importedSm);
          } else {
            // Merge full price history by timestamp
            const existingTimestamps = new Set(
              existingSm.fullPriceHistory.map((r) => r.timestamp),
            );
            for (const record of importedSm.fullPriceHistory) {
              if (!existingTimestamps.has(record.timestamp)) {
                existingSm.fullPriceHistory.push(record);
              }
            }
            existingSm.fullPriceHistory.sort(
              (a, b) => a.timestamp - b.timestamp,
            );

            // Keep most recent discounted price
            if (importedSm.discountedPrice) {
              if (
                !existingSm.discountedPrice ||
                importedSm.discountedPrice.timestamp >
                  existingSm.discountedPrice.timestamp
              ) {
                existingSm.discountedPrice = importedSm.discountedPrice;
              }
            }
          }
        }

        // Prefer a real name over barcode-as-name
        if (importedProduct.name && existing.name === existing.barcode) {
          existing.name = importedProduct.name;
        }

        existingProducts[existingIndex] = existing;
        stats.productsUpdated++;
      }
    }

    this.persistProducts(existingProducts);

    // Merge brands
    const existingBrandsLower = new Set(
      this._brands().map((b) => b.toLowerCase()),
    );
    const newBrands: string[] = [];
    for (const brand of data.brands) {
      if (!existingBrandsLower.has(brand.toLowerCase())) {
        newBrands.push(brand);
        stats.brandsAdded++;
      }
    }
    if (newBrands.length > 0) {
      this.persistBrands([...this._brands(), ...newBrands].sort());
    }

    return stats;
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.BRANDS);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_BRAND);
    this._products.set([]);
    this._brands.set([]);
    this._selectedBrand.set('');
  }
}
