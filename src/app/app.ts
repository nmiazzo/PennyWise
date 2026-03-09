import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'pw-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatRippleModule, MatSnackBarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private swUpdate = inject(SwUpdate);
  private snackBar = inject(MatSnackBar);
  private updateSub: Subscription | null = null;

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;

    this.updateSub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        const ref = this.snackBar.open('Nuova versione disponibile', 'Aggiorna', { duration: 0 });
        ref.onAction().subscribe(() => document.location.reload());
      });
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
  }
}
