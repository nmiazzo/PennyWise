import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import {
  Product,
  getCheapestFullPrice,
  getCheapestDiscountedPrice,
  formatCentsToEuro,
} from '../../models/product.model';

@Component({
  selector: 'pw-product-card',
  imports: [RouterLink, MatCardModule],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();

  readonly cheapestFull = computed(() => {
    const result = getCheapestFullPrice(this.product());
    return result
      ? `${formatCentsToEuro(result.price.price)} @ ${result.brand}`
      : 'No price';
  });

  readonly cheapestDiscounted = computed(() => {
    const result = getCheapestDiscountedPrice(this.product());
    return result
      ? `${formatCentsToEuro(result.price.price)} @ ${result.brand}`
      : null;
  });

  readonly supermarketCount = computed(
    () => this.product().supermarkets.length,
  );
}
