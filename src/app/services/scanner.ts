import { Injectable, NgZone } from '@angular/core';
import Quagga from '@ericblade/quagga2';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface ScanResult {
  code: string;
  format: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerService {
  private _barcodeDetected$ = new Subject<ScanResult>();
  private _isRunning = false;
  private _onDetectedHandler: ((data: any) => void) | null = null;

  readonly barcodeDetected$: Observable<ScanResult> =
    this._barcodeDetected$.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => prev.code === curr.code),
    );

  constructor(private ngZone: NgZone) {}

  async startScanner(targetElement: HTMLElement): Promise<void> {
    if (this._isRunning) {
      await this.stopScanner();
    }

    return new Promise<void>((resolve, reject) => {
      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: targetElement,
            constraints: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'environment',
            },
          },
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'upc_reader',
              'upc_e_reader',
            ],
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
          },
          locate: true,
          frequency: 10,
        },
        (err: any) => {
          if (err) {
            reject(err);
            return;
          }

          this._onDetectedHandler = (data: any) => {
            if (data?.codeResult?.code) {
              this.ngZone.run(() => {
                this._barcodeDetected$.next({
                  code: data.codeResult.code,
                  format: data.codeResult.format,
                });
              });
            }
          };
          Quagga.onDetected(this._onDetectedHandler);

          Quagga.start();
          this._isRunning = true;
          resolve();
        },
      );
    });
  }

  async stopScanner(): Promise<void> {
    if (!this._isRunning) return;
    if (this._onDetectedHandler) {
      Quagga.offDetected(this._onDetectedHandler);
      this._onDetectedHandler = null;
    }
    Quagga.stop();
    this._isRunning = false;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }
}
