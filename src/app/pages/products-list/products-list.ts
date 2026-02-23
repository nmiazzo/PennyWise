import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../services/storage';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'pw-products-list',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ProductCard,
  ],
  templateUrl: './products-list.html',
  styleUrl: './products-list.scss',
})
export class ProductsList {
  private storage = inject(StorageService);

  readonly searchQuery = signal<string>('');

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const all = this.storage.products();
    if (!query) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(query) || p.barcode.includes(query),
    );
  });
}
