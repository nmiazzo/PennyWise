import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'scan', pathMatch: 'full' },
  {
    path: 'scan',
    loadComponent: () => import('./pages/scan/scan').then((m) => m.Scan),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products-list/products-list').then(
        (m) => m.ProductsList,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'product/new/:barcode',
    loadComponent: () =>
      import('./pages/product-form/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'product/:barcode',
    loadComponent: () =>
      import('./pages/product-detail/product-detail').then(
        (m) => m.ProductDetail,
      ),
  },
  {
    path: 'product/:barcode/edit',
    loadComponent: () =>
      import('./pages/product-form/product-form').then((m) => m.ProductForm),
    data: { mode: 'edit' },
  },
  {
    path: 'product/:barcode/edit/:brand',
    loadComponent: () =>
      import('./pages/product-form/product-form').then((m) => m.ProductForm),
    data: { mode: 'edit-brand' },
  },
  { path: '**', redirectTo: 'scan' },
];
