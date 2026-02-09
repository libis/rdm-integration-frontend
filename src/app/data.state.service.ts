// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, Signal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DataService } from './data.service';
import { CachedResponse, CompareResult, Key } from './models/compare-result';
import { NotificationService } from './shared/notification.service';
import { UtilsService } from './utils.service';

@Injectable({
  providedIn: 'root',
})
export class DataStateService {
  private dataService = inject(DataService);
  private router = inject(Router);
  private utils = inject(UtilsService);
  private notificationService = inject(NotificationService);

  // Internal signal for state
  private readonly _state = signal<CompareResult | null>(null);

  // Public read-only signal
  readonly state$: Signal<CompareResult | null> = this._state.asReadonly();

  private pollGeneration = 0;
  private dataSubscription?: Subscription;
  private compareSubscription?: Subscription;

  constructor() {}

  initializeState(): void {
    this.cancelInitialization(false);
    this.resetState();
    const generation = ++this.pollGeneration;
    this.dataSubscription = this.dataService.getData().subscribe({
      next: (key) => this.getCompareData(key, generation),
      error: (err) => {
        const is401 =
          err.status === 401 || (err.error && err.error.includes('401'));
        this.notificationService.showError(`Getting data failed: ${err.error}`);
        this.router.navigate(['/connect'], {
          queryParams: is401 ? { reset: 'true' } : {},
        });
        this.dataSubscription = undefined;
      },
    });
  }

  cancelInitialization(resetState = true): void {
    this.pollGeneration++;
    this.dataSubscription?.unsubscribe();
    this.compareSubscription?.unsubscribe();
    this.dataSubscription = undefined;
    this.compareSubscription = undefined;
    if (resetState) {
      this.resetState();
    }
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.pollGeneration;
  }

  private getCompareData(key: Key, generation: number): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }
    this.compareSubscription = this.dataService.getCachedData(key).subscribe({
      next: async (res: CachedResponse) => {
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        if (res.ready === true) {
          if (res.res) {
            res.res.data = res.res.data?.sort((o1, o2) =>
              (o1.id === undefined ? '' : o1.id) <
              (o2.id === undefined ? '' : o2.id)
                ? -1
                : 1,
            );
            this._state.set(res.res);
          } else {
            this._state.set(null);
          }
          if (res.err && res.err !== '') {
            this.notificationService.showError(res.err);
          }
          this.compareSubscription = undefined;
        } else {
          await this.utils.sleep(1000);
          if (this.isCurrentGeneration(generation)) {
            this.getCompareData(key, generation);
          }
        }
      },
      error: (err) => {
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        const is401 =
          err.status === 401 || (err.error && err.error.includes('401'));
        this.notificationService.showError(`Comparing failed: ${err.error}`);
        this.router.navigate(['/connect'], {
          queryParams: is401 ? { reset: 'true' } : {},
        });
        this.compareSubscription = undefined;
      },
    });
  }

  updateState(state: CompareResult): void {
    this._state.set(state);
  }

  resetState(): void {
    this._state.set(null);
  }
}
