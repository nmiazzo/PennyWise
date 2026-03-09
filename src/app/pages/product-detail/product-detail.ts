import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StorageService } from '../../services/storage';
import { ScannerService } from '../../services/scanner';
import { PriceChart } from '../../components/price-chart/price-chart';
import {
  Product,
  formatCentsToEuro,
  getCurrentFullPrice,
  getCheapestFullPrice,
  getCheapestDiscountedPrice,
  sortSupermarketsCheapestFirst,
  isManualBarcode,
} from '../../models/product.model';

@Component({
  selector: 'pw-product-detail',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    PriceChart,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storage = inject(StorageService);
  private scanner = inject(ScannerService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('barcodeScannerTarget') barcodeScannerTarget?: ElementRef<HTMLDivElement>;

  readonly barcode = signal<string>('');
  readonly highlightedBrand = signal<string>('');
  readonly editingName = signal(false);
  readonly editNameValue = signal('');
  readonly isManual = computed(() => isManualBarcode(this.barcode()));
  readonly scanningBarcode = signal(false);
  readonly manualBarcodeInput = signal(false);
  readonly manualBarcodeValue = signal('');
  readonly nonEan13Prompt = signal<string | null>(null);
  readonly nameConflict = signal<{ oldName: string; existingName: string; newBarcode: string } | null>(null);

  private scanSubscription: import('rxjs').Subscription | null = null;
  private routeSubscription: import('rxjs').Subscription | null = null;

  readonly product = computed<Product | null>(() => {
    const bc = this.barcode();
    if (!bc) return null;
    return this.storage.products().find((p) => p.barcode === bc) ?? null;
  });

  readonly sortedSupermarkets = computed(() => {
    const p = this.product();
    return p ? sortSupermarketsCheapestFirst(p.supermarkets) : [];
  });

  readonly cheapestFull = computed(() => {
    const p = this.product();
    return p ? getCheapestFullPrice(p) : null;
  });

  readonly cheapestDiscounted = computed(() => {
    const p = this.product();
    return p ? getCheapestDiscountedPrice(p) : null;
  });

  protected readonly formatCentsToEuro = formatCentsToEuro;
  protected readonly getCurrentFullPrice = getCurrentFullPrice;

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      this.barcode.set(params.get('barcode') ?? '');
    });
    this.highlightedBrand.set(
      this.route.snapshot.queryParamMap.get('brand') ?? '',
    );
  }

  ngOnDestroy(): void {
    this.stopBarcodeScanner();
    this.routeSubscription?.unsubscribe();
  }

  startEditName(): void {
    this.editNameValue.set(this.product()?.name ?? '');
    this.editingName.set(true);
  }

  saveName(): void {
    const name = this.editNameValue().trim();
    if (name) {
      this.storage.updateProductName(this.barcode(), name);
      this.snackBar.open('Name updated', 'OK', { duration: 2000 });
    }
    this.editingName.set(false);
  }

  cancelEditName(): void {
    this.editingName.set(false);
  }

  addNewSupermarketPrice(): void {
    this.router.navigate(['/product', this.barcode(), 'edit']);
  }

  updatePrice(brand: string): void {
    this.router.navigate(['/product', this.barcode(), 'edit', brand]);
  }

  removeDiscount(brand: string): void {
    this.storage.removeDiscountedPrice(this.barcode(), brand);
    this.snackBar.open(`Discount removed for ${brand}`, 'OK', {
      duration: 2000,
    });
  }

  // --- Barcode assignment for manual products ---

  async startBarcodeScanner(): Promise<void> {
    this.scanningBarcode.set(true);
    this.manualBarcodeInput.set(false);
    // Wait for ViewChild to be available
    setTimeout(async () => {
      if (!this.barcodeScannerTarget) return;
      try {
        await this.scanner.startScanner(this.barcodeScannerTarget.nativeElement);
        this.scanSubscription = this.scanner.barcodeDetected$.subscribe(
          (result) => this.handleBarcodeScan(result.code),
        );
      } catch {
        this.snackBar.open('Impossibile avviare la fotocamera', 'OK', { duration: 2000 });
        this.scanningBarcode.set(false);
      }
    });
  }

  private stopBarcodeScanner(): void {
    this.scanSubscription?.unsubscribe();
    this.scanSubscription = null;
    this.scanner.stopScanner();
    this.scanningBarcode.set(false);
  }

  cancelBarcodeScanner(): void {
    this.stopBarcodeScanner();
    this.nonEan13Prompt.set(null);
  }

  showManualBarcodeInput(): void {
    this.manualBarcodeInput.set(true);
    this.scanningBarcode.set(false);
  }

  submitManualBarcode(): void {
    const value = this.manualBarcodeValue().trim();
    if (!value) return;
    this.handleBarcodeAssignment(value);
  }

  cancelManualBarcode(): void {
    this.manualBarcodeInput.set(false);
    this.manualBarcodeValue.set('');
  }

  private handleBarcodeScan(barcode: string): void {
    if (barcode.length !== 13) {
      if (this.storage.forceEan13()) {
        return;
      }
      this.stopBarcodeScanner();
      this.nonEan13Prompt.set(barcode);
      return;
    }
    this.handleBarcodeAssignment(barcode);
  }

  acceptNonEan13Assignment(): void {
    const barcode = this.nonEan13Prompt();
    if (barcode) {
      this.nonEan13Prompt.set(null);
      this.handleBarcodeAssignment(barcode);
    }
  }

  async rejectNonEan13Assignment(): Promise<void> {
    this.nonEan13Prompt.set(null);
    await this.startBarcodeScanner();
  }

  private handleBarcodeAssignment(newBarcode: string): void {
    this.stopBarcodeScanner();
    this.manualBarcodeInput.set(false);

    const result = this.storage.reassignBarcode(this.barcode(), newBarcode);

    if (result.status === 'name-conflict') {
      this.nameConflict.set({
        oldName: result.oldName!,
        existingName: result.existingName!,
        newBarcode,
      });
      return;
    }

    this.snackBar.open('Codice a barre assegnato!', 'OK', { duration: 2000 });
    this.router.navigate(['/product', newBarcode], { replaceUrl: true });
  }

  resolveNameConflict(keepName: string): void {
    const conflict = this.nameConflict();
    if (!conflict) return;

    this.storage.reassignBarcode(this.barcode(), conflict.newBarcode, keepName);
    this.nameConflict.set(null);
    this.snackBar.open('Prodotti uniti!', 'OK', { duration: 2000 });
    this.router.navigate(['/product', conflict.newBarcode], { replaceUrl: true });
  }

  cancelNameConflict(): void {
    this.nameConflict.set(null);
  }
}
