import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BrandAutocomplete } from '../../components/brand-autocomplete/brand-autocomplete';
import { StorageService } from '../../services/storage';

export interface BulkImportItem {
  name: string;
  priceCents: number;
  isDiscounted: boolean;
  fullPriceCents: number;
}

@Component({
  selector: 'pw-bulk-import',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    BrandAutocomplete,
  ],
  templateUrl: './bulk-import.html',
  styleUrl: './bulk-import.scss',
})
export class BulkImport {
  private router = inject(Router);
  private storage = inject(StorageService);
  private snackBar = inject(MatSnackBar);

  readonly step = signal<'paste' | 'review'>('paste');
  readonly rawText = signal<string>('');
  readonly brand = signal<string>(this.storage.selectedBrand());
  readonly items = signal<BulkImportItem[]>([]);

  private barcodeCounter = 0;

  parseText(): void {
    const text = this.rawText();
    if (!text.trim()) return;

    const lines = text.split('\n');
    const parsed: BulkImportItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Find all price-like patterns (e.g., 1.99, 1,99, €1.99, € 1.99)
      const priceRegex = /€?\s*(\d+[.,]\d{1,2})/g;
      let lastMatch: RegExpExecArray | null = null;
      let match: RegExpExecArray | null;

      while ((match = priceRegex.exec(trimmed)) !== null) {
        lastMatch = match;
      }

      if (lastMatch) {
        const priceStr = lastMatch[1].replace(',', '.');
        const price = parseFloat(priceStr);
        const name = trimmed.substring(0, lastMatch.index).trim();
        const cleanName = name.replace(/[\s\-–—:.*]+$/, '').trim();

        if (cleanName && !isNaN(price) && price > 0) {
          parsed.push({
            name: cleanName,
            priceCents: Math.round(price * 100),
            isDiscounted: false,
            fullPriceCents: 0,
          });
        }
      }
    }

    if (parsed.length === 0) {
      this.snackBar.open('Nessun articolo trovato nel testo', 'OK', {
        duration: 3000,
      });
      return;
    }

    this.items.set(parsed);
    this.step.set('review');
  }

  onBrandChanged(brand: string): void {
    this.brand.set(brand);
  }

  updateItemName(index: number, name: string): void {
    const current = [...this.items()];
    current[index] = { ...current[index], name };
    this.items.set(current);
  }

  updateItemPrice(index: number, priceEuro: string): void {
    const cents = Math.round(parseFloat(priceEuro.replace(',', '.')) * 100);
    if (!isNaN(cents) && cents > 0) {
      const current = [...this.items()];
      current[index] = { ...current[index], priceCents: cents };
      this.items.set(current);
    }
  }

  toggleDiscount(index: number, isDiscounted: boolean): void {
    const current = [...this.items()];
    current[index] = {
      ...current[index],
      isDiscounted,
      fullPriceCents: isDiscounted ? current[index].fullPriceCents : 0,
    };
    this.items.set(current);
  }

  updateFullPrice(index: number, priceEuro: string): void {
    const cents = Math.round(parseFloat(priceEuro.replace(',', '.')) * 100);
    if (!isNaN(cents) && cents >= 0) {
      const current = [...this.items()];
      current[index] = { ...current[index], fullPriceCents: cents };
      this.items.set(current);
    }
  }

  removeItem(index: number): void {
    const current = [...this.items()];
    current.splice(index, 1);
    this.items.set(current);
  }

  save(): void {
    const brandValue = this.brand().trim();
    if (!brandValue) {
      this.snackBar.open('Seleziona un supermercato', 'OK', { duration: 2000 });
      return;
    }

    const items = this.items();
    if (items.length === 0) {
      this.snackBar.open('Nessun articolo da importare', 'OK', {
        duration: 2000,
      });
      return;
    }

    const now = Date.now();
    let count = 0;

    for (const item of items) {
      const barcode = `MAN-${now}-${++this.barcodeCounter}`;

      if (item.isDiscounted && item.fullPriceCents > 0) {
        // Save full price first, then discounted price
        this.storage.addOrUpdatePrice(
          barcode,
          brandValue,
          item.fullPriceCents,
          false,
          item.name,
        );
        this.storage.addOrUpdatePrice(barcode, brandValue, item.priceCents, true);
      } else {
        this.storage.addOrUpdatePrice(
          barcode,
          brandValue,
          item.priceCents,
          false,
          item.name,
        );
      }
      count++;
    }

    this.snackBar.open(`${count} articoli importati!`, 'OK', { duration: 2000 });
    this.router.navigate(['/products']);
  }

  goBack(): void {
    if (this.step() === 'review') {
      this.step.set('paste');
    } else {
      this.router.navigate(['/scan']);
    }
  }

  formatCentsToEuro(cents: number): string {
    return (cents / 100).toFixed(2);
  }
}
