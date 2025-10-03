// Author: Added as part of architectural refactor (2025). Apache 2.0 License
// Generic polling utility encapsulating repeated observable execution with
// delay and cancellation. Replaces ad-hoc recursive polling loops.

import { Injectable } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export interface PollingHandle {
  cancel(): void;
  readonly subscription: Subscription;
  readonly iteration: number;
}

@Injectable({ providedIn: 'root' })
export class PollingService {
  poll<T>(args: {
    iterate: () => Observable<T>;
    onResult: (value: T, iteration: number) => void;
    shouldContinue: (value: T, iteration: number) => boolean;
    delayMs: number;
    onError?: (err: unknown, iteration: number) => boolean; // return true to continue
  }): PollingHandle {
    const { iterate, onResult, shouldContinue, delayMs, onError } = args;
    const aggregateSub = new Subscription();
    let cancelled = false;
    let iteration = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = () => {
      if (cancelled) return;
      const sub = iterate().subscribe({
        next: (val) => {
          if (cancelled) return;
          iteration++;
          try {
            onResult(val, iteration);
          } catch {
            // Swallow user onResult handler errors to prevent poll loop crash
          }
          let cont = false;
          try {
            cont = shouldContinue(val, iteration);
          } catch {
            cont = false;
          }
          if (cont && !cancelled) {
            const handle = setTimeout(schedule, delayMs);
            timeouts.push(handle);
          }
        },
        error: (err) => {
          if (cancelled) return;
          let cont = false;
          try {
            cont = onError ? onError(err, iteration) : false;
          } catch {
            cont = false;
          }
          if (cont && !cancelled) {
            const handle = setTimeout(schedule, delayMs);
            timeouts.push(handle);
          }
        },
      });
      aggregateSub.add(sub);
    };

    schedule();

    return {
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        aggregateSub.unsubscribe();
        timeouts.forEach((t) => clearTimeout(t));
      },
      get subscription() {
        return aggregateSub;
      },
      get iteration() {
        return iteration;
      },
    } as PollingHandle;
  }
}
