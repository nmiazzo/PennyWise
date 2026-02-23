import { Component, signal, computed, forwardRef, output, input } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { formatCentsToEuro } from '../../models/product.model';

@Component({
  selector: 'pw-pos-keypad',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './pos-keypad.html',
  styleUrl: './pos-keypad.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PosKeypad),
      multi: true,
    },
  ],
})
export class PosKeypad implements ControlValueAccessor {
  readonly initialValue = input<number>(0);
  readonly valueCents = signal<number>(0);
  readonly displayValue = computed(() => formatCentsToEuro(this.valueCents()));
  readonly valueChanged = output<number>();

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number): void {
    this.valueCents.set(value ?? 0);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  pressDigit(digit: number): void {
    const newValue = this.valueCents() * 10 + digit;
    if (newValue > 999999) return;
    this.valueCents.set(newValue);
    this.emitChange();
  }

  pressBackspace(): void {
    this.valueCents.set(Math.floor(this.valueCents() / 10));
    this.emitChange();
  }

  pressClear(): void {
    this.valueCents.set(0);
    this.emitChange();
  }

  private emitChange(): void {
    const value = this.valueCents();
    this.onChange(value);
    this.onTouched();
    this.valueChanged.emit(value);
  }
}
