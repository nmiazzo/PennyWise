export interface PriceRecord {
  price: number; // cents: 1099 = EUR 10.99
  timestamp: number; // milliseconds since epoch
}

export interface SupermarketPriceData {
  brand: string;
  fullPriceHistory: PriceRecord[]; // chronological; last = current full price
  discountedPrice: PriceRecord | null; // removable when sale ends
}

export interface Product {
  barcode: string;
  name: string;
  supermarkets: SupermarketPriceData[];
}

export interface PennyWiseDatabase {
  products: Product[];
  brands: string[];
  exportedAt: number;
  version: number;
}

export const STORAGE_KEYS = {
  PRODUCTS: 'pw_products',
  BRANDS: 'pw_brands',
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

export function getCurrentFullPrice(
  spd: SupermarketPriceData,
): PriceRecord | null {
  const h = spd.fullPriceHistory;
  return h.length > 0 ? h[h.length - 1] : null;
}

export function getCheapestFullPrice(
  product: Product,
): { brand: string; price: PriceRecord } | null {
  let cheapest: { brand: string; price: PriceRecord } | null = null;
  for (const sm of product.supermarkets) {
    const current = getCurrentFullPrice(sm);
    if (current && (!cheapest || current.price < cheapest.price.price)) {
      cheapest = { brand: sm.brand, price: current };
    }
  }
  return cheapest;
}

export function getCheapestDiscountedPrice(
  product: Product,
): { brand: string; price: PriceRecord } | null {
  let cheapest: { brand: string; price: PriceRecord } | null = null;
  for (const sm of product.supermarkets) {
    if (
      sm.discountedPrice &&
      (!cheapest || sm.discountedPrice.price < cheapest.price.price)
    ) {
      cheapest = { brand: sm.brand, price: sm.discountedPrice };
    }
  }
  return cheapest;
}

export function formatCentsToEuro(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2)}`;
}

export function sortSupermarketsCheapestFirst(
  supermarkets: SupermarketPriceData[],
): SupermarketPriceData[] {
  return [...supermarkets].sort((a, b) => {
    const priceA = getCurrentFullPrice(a)?.price ?? Infinity;
    const priceB = getCurrentFullPrice(b)?.price ?? Infinity;
    return priceA - priceB;
  });
}
