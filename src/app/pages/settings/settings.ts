import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { StorageService } from '../../services/storage';
import { PennyWiseDatabase } from '../../models/product.model';

@Component({
  selector: 'pw-settings',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private storage = inject(StorageService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly importing = signal<boolean>(false);
  readonly importResult = signal<string | null>(null);

  get productCount(): number {
    return this.storage.products().length;
  }

  get brandCount(): number {
    return this.storage.brands().length;
  }

  exportDatabase(): void {
    const data = this.storage.exportDatabase();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pennywise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    this.snackBar.open('Database exported!', 'OK', { duration: 2000 });
  }

  triggerImport(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing.set(true);
    this.importResult.set(null);

    try {
      const text = await file.text();
      const data: PennyWiseDatabase = JSON.parse(text);

      if (!Array.isArray(data.products) || !Array.isArray(data.brands)) {
        throw new Error(
          'Invalid file format: missing products or brands array',
        );
      }

      const stats = this.storage.importDatabase(data);
      this.importResult.set(
        `Import complete: ${stats.productsAdded} added, ` +
          `${stats.productsUpdated} updated, ${stats.brandsAdded} new brands`,
      );
      this.snackBar.open('Import successful!', 'OK', { duration: 3000 });
    } catch (err: any) {
      this.importResult.set(`Import failed: ${err.message}`);
      this.snackBar.open('Import failed', 'OK', { duration: 3000 });
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  clearAllData(): void {
    if (
      confirm(
        'Are you sure you want to delete ALL data? This cannot be undone.',
      )
    ) {
      this.storage.clearAll();
      this.snackBar.open('All data cleared', 'OK', { duration: 2000 });
    }
  }
}
