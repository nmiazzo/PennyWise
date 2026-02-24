import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StorageService } from '../../services/storage';
import { PriceChart } from '../../components/price-chart/price-chart';
import {
  Product,
  formatCentsToEuro,
  getCurrentFullPrice,
  getCheapestFullPrice,
  getCheapestDiscountedPrice,
  sortSupermarketsCheapestFirst,
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
export class ProductDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storage = inject(StorageService);
  private snackBar = inject(MatSnackBar);

  readonly barcode = signal<string>('');
  readonly highlightedBrand = signal<string>('');
  readonly editingName = signal(false);
  readonly editNameValue = signal('');

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
    this.barcode.set(this.route.snapshot.paramMap.get('barcode') ?? '');
    this.highlightedBrand.set(
      this.route.snapshot.queryParamMap.get('brand') ?? '',
    );
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
}
