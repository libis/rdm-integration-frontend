// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Injectable, signal } from '@angular/core';

export type ToastSeverity = 'error' | 'success' | 'warning' | 'info';

/** What holds a toast open: the pointer over it or the focus in it. */
type ToastHold = 'hover' | 'focus';

interface ToastMessage {
  severity: ToastSeverity;
  summary: string;
  detail: string;
  /** Milliseconds before auto dismiss. 0 keeps the toast until closed. */
  life?: number;
}

interface ActiveToast extends ToastMessage {
  id: number;
}

// The life a toast has left, and the timer counting it down while nothing holds the toast.
interface ToastTimer {
  remaining: number;
  startedAt: number;
  handle?: ReturnType<typeof setTimeout>;
  readonly holds: Set<ToastHold>;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _messages = signal<ActiveToast[]>([]);
  readonly messages = this._messages.asReadonly();
  private readonly timers = new Map<number, ToastTimer>();

  show(message: ToastMessage): void {
    const toast: ActiveToast = { ...message, id: this.nextId++ };
    this._messages.update((list) => [...list, toast]);
    const life = message.life ?? 5000;
    if (life > 0) {
      this.timers.set(toast.id, {
        remaining: life,
        startedAt: 0,
        holds: new Set(),
      });
      this.start(toast.id);
    }
  }

  /** Stops the toast's countdown while the pointer is over it or the focus is in it. */
  hold(id: number, reason: ToastHold): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    if (timer.handle !== undefined) {
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining -= Date.now() - timer.startedAt;
    }
    timer.holds.add(reason);
  }

  /** Lets the countdown go on with the life left once nothing holds the toast. */
  release(id: number, reason: ToastHold): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.holds.delete(reason) || timer.holds.size > 0) return;
    this.start(id);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    this.timers.delete(id);
    this._messages.update((list) => list.filter((t) => t.id !== id));
  }

  private start(id: number): void {
    const timer = this.timers.get(id)!;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(
      () => this.dismiss(id),
      Math.max(timer.remaining, 0),
    );
  }
}
