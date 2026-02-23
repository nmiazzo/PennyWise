import {
  Component,
  inject,
  signal,
  forwardRef,
  input,
  output,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  ReactiveFormsModule,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StorageService } from '../../services/storage';

@Component({
  selector: 'pw-brand-autocomplete',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './brand-autocomplete.html',
  styleUrl: './brand-autocomplete.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BrandAutocomplete),
      multi: true,
    },
  ],
})
export class BrandAutocomplete implements ControlValueAccessor, OnInit {
  private storage = inject(StorageService);

  readonly label = input<string>('Supermarket');
  readonly initialValue = input<string>('');
  readonly brandSelected = output<string>();
  readonly searchControl = new FormControl('');
  readonly filteredBrands = signal<string[]>([]);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    const initial = this.initialValue();
    if (initial) {
      this.searchControl.setValue(initial, { emitEvent: false });
    }

    this.searchControl.valueChanges.subscribe((value) => {
      const search = (value ?? '').toLowerCase();
      const allBrands = this.storage.brands();
      this.filteredBrands.set(
        search
          ? allBrands.filter((b) => b.toLowerCase().includes(search))
          : allBrands,
      );
      this.onChange(value ?? '');
    });
  }

  clear(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.onChange('');
    this.brandSelected.emit('');
  }

  writeValue(value: string): void {
    this.searchControl.setValue(value ?? '', { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onOptionSelected(brand: string): void {
    this.brandSelected.emit(brand);
    this.onChange(brand);
    this.onTouched();
  }

  onBlur(): void {
    const value = this.searchControl.value?.trim() ?? '';
    if (value) {
      this.storage.addBrand(value);
      this.brandSelected.emit(value);
      this.onChange(value);
    }
    this.onTouched();
  }
}
