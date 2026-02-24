import {
  Component,
  inject,
  signal,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { ScannerService } from '../../services/scanner';
import { StorageService } from '../../services/storage';
import { BrandAutocomplete } from '../../components/brand-autocomplete/brand-autocomplete';
import {
  Product,
  formatCentsToEuro,
  getCurrentFullPrice,
  sortSupermarketsCheapestFirst,
  getCheapestFullPrice,
} from '../../models/product.model';

@Component({
  selector: 'pw-scan',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    BrandAutocomplete,
  ],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan implements AfterViewInit, OnDestroy {
  private scanner = inject(ScannerService);
  private storage = inject(StorageService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  @ViewChild('scannerTarget') scannerTarget!: ElementRef<HTMLDivElement>;
  @ViewChild('brandInput') brandInput!: BrandAutocomplete;

  readonly selectedBrand = signal<string>(this.storage.selectedBrand());
  readonly scannerActive = signal<boolean>(false);
  readonly scannerError = signal<string | null>(null);
  readonly scannedProduct = signal<Product | null>(null);
  readonly nonEan13Prompt = signal<string | null>(null);

  private scanSubscription: Subscription | null = null;

  protected readonly formatCentsToEuro = formatCentsToEuro;
  protected readonly getCurrentFullPrice = getCurrentFullPrice;
  protected readonly sortSupermarketsCheapestFirst =
    sortSupermarketsCheapestFirst;
  protected readonly getCheapestFullPrice = getCheapestFullPrice;

  async ngAfterViewInit(): Promise<void> {
    await this.startScanning();
  }

  ngOnDestroy(): void {
    this.cleanupScanner();
  }

  async startScanning(): Promise<void> {
    try {
      this.scannerError.set(null);
      this.scannedProduct.set(null);
      this.nonEan13Prompt.set(null);

      await this.scanner.startScanner(this.scannerTarget.nativeElement);
      this.scannerActive.set(true);

      this.scanSubscription = this.scanner.barcodeDetected$.subscribe(
        (result) => this.handleBarcodeScan(result.code),
      );
    } catch (err: any) {
      this.scannerError.set(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access.'
          : 'Could not start camera. Please check permissions.',
      );
      this.scannerActive.set(false);
    }
  }

  private async handleBarcodeScan(barcode: string): Promise<void> {
    if (barcode.length !== 13) {
      if (this.storage.forceEan13()) {
        // Auto-skip: keep scanning without prompting
        return;
      }
      // Pause scanner and prompt the user
      await this.scanner.stopScanner();
      this.scannerActive.set(false);
      this.nonEan13Prompt.set(barcode);
      return;
    }

    await this.processBarcode(barcode);
  }

  acceptNonEan13(): void {
    const barcode = this.nonEan13Prompt();
    if (barcode) {
      this.nonEan13Prompt.set(null);
      this.processBarcode(barcode);
    }
  }

  async rejectNonEan13(): Promise<void> {
    this.nonEan13Prompt.set(null);
    await this.startScanning();
  }

  private async processBarcode(barcode: string): Promise<void> {
    if (this.scannerActive()) {
      await this.scanner.stopScanner();
      this.scannerActive.set(false);
    }

    const existingProduct = this.storage.getProduct(barcode);

    if (!existingProduct) {
      this.router.navigate(['/product/new', barcode], {
        queryParams: { brand: this.selectedBrand() || undefined },
      });
    } else {
      this.scannedProduct.set(existingProduct);
      this.snackBar.open(`Found: ${existingProduct.name}`, 'OK', {
        duration: 2000,
      });
    }
  }

  onBrandPreSelected(brand: string): void {
    this.selectedBrand.set(brand);
    if (brand) {
      this.storage.setSelectedBrand(brand);
    } else {
      this.storage.clearSelectedBrand();
    }
  }

  clearBrand(): void {
    this.selectedBrand.set('');
    this.storage.clearSelectedBrand();
    this.brandInput.clear();
  }

  goToProductDetail(barcode: string): void {
    this.router.navigate(['/product', barcode], {
      queryParams: { brand: this.selectedBrand() || undefined },
    });
  }

  goToUpdatePrice(barcode: string): void {
    this.router.navigate(['/product', barcode, 'edit'], {
      queryParams: { brand: this.selectedBrand() || undefined },
    });
  }

  async resumeScanning(): Promise<void> {
    this.scannedProduct.set(null);
    await this.startScanning();
  }

  private cleanupScanner(): void {
    this.scanSubscription?.unsubscribe();
    this.scanner.stopScanner();
    this.scannerActive.set(false);
  }
}
