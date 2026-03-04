// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, Signal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  EmptyError,
  firstValueFrom,
  Subject,
  Subscription,
  takeUntil,
} from 'rxjs';
import { DataService } from './data.service';
import { CompareResult, Key } from './models/compare-result';
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
  private readonly cancelPoll$ = new Subject<void>();

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
    this.cancelPoll$.next();
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = undefined;
    if (resetState) {
      this.resetState();
    }
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.pollGeneration;
  }

  private async getCompareData(key: Key, generation: number): Promise<void> {
    while (this.isCurrentGeneration(generation)) {
      try {
        const res = await firstValueFrom(
          this.dataService.getCachedData(key).pipe(takeUntil(this.cancelPoll$)),
        );
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
          return;
        }
        if (res.res) {
          // Partial result from server, could update state if needed
        }
        await this.utils.sleep(1000);
      } catch (err: unknown) {
        // Observable completed without emitting (cancelled via takeUntil)
        if (
          err instanceof EmptyError ||
          !this.isCurrentGeneration(generation)
        ) {
          return;
        }
        const error = err as { status?: number; error?: string };
        const is401 =
          error.status === 401 || (error.error && error.error.includes('401'));
        this.notificationService.showError(`Comparing failed: ${error.error}`);
        this.router.navigate(['/connect'], {
          queryParams: is401 ? { reset: 'true' } : {},
        });
        return;
      }
    }
  }

  updateState(state: CompareResult): void {
    this._state.set(state);
  }

  resetState(): void {
    this._state.set(null);
  }
}
