import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PosKeypad } from '../../components/pos-keypad/pos-keypad';
import { BrandAutocomplete } from '../../components/brand-autocomplete/brand-autocomplete';
import { StorageService } from '../../services/storage';

@Component({
  selector: 'pw-product-form',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatIconModule,
    MatSnackBarModule,
    PosKeypad,
    BrandAutocomplete,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storage = inject(StorageService);
  private snackBar = inject(MatSnackBar);

  readonly barcode = signal<string>('');
  readonly isNewProduct = signal<boolean>(false);
  readonly preSelectedBrand = signal<string>('');
  readonly productName = signal<string>('');
  readonly brand = signal<string>('');
  readonly priceCents = signal<number>(0);
  readonly isDiscounted = signal<boolean>(false);

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    const queryParams = this.route.snapshot.queryParamMap;
    const routeData = this.route.snapshot.data;

    const barcode = params.get('barcode') ?? '';
    this.barcode.set(barcode);

    const brandParam = params.get('brand') ?? queryParams.get('brand') ?? '';
    this.preSelectedBrand.set(brandParam);
    this.brand.set(brandParam);

    const existing = this.storage.getProduct(barcode);
    if (!existing || this.route.snapshot.url.some((seg) => seg.path === 'new')) {
      this.isNewProduct.set(true);
    } else {
      this.isNewProduct.set(false);
      this.productName.set(existing.name);
    }

    if (routeData['mode'] === 'edit-brand' && existing && brandParam) {
      const sm = existing.supermarkets.find(
        (s) => s.brand.toLowerCase() === brandParam.toLowerCase(),
      );
      if (sm && sm.fullPriceHistory.length > 0) {
        this.priceCents.set(
          sm.fullPriceHistory[sm.fullPriceHistory.length - 1].price,
        );
      }
    }
  }

  onPriceChanged(cents: number): void {
    this.priceCents.set(cents);
  }

  onBrandChanged(brand: string): void {
    this.brand.set(brand);
  }

  save(): void {
    const brandValue = this.brand().trim();
    const priceValue = this.priceCents();

    if (!brandValue) {
      this.snackBar.open('Please select a supermarket', 'OK', {
        duration: 2000,
      });
      return;
    }
    if (priceValue <= 0) {
      this.snackBar.open('Please enter a price', 'OK', { duration: 2000 });
      return;
    }

    this.storage.addOrUpdatePrice(
      this.barcode(),
      brandValue,
      priceValue,
      this.isDiscounted(),
      this.isNewProduct() ? this.productName() || this.barcode() : undefined,
    );

    this.snackBar.open('Price saved!', 'OK', { duration: 1500 });
    this.router.navigate(['/product', this.barcode()]);
  }

  cancel(): void {
    const existing = this.storage.getProduct(this.barcode());
    if (existing) {
      this.router.navigate(['/product', this.barcode()]);
    } else {
      this.router.navigate(['/scan']);
    }
  }
}
