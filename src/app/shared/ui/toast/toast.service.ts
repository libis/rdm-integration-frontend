// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Injectable, signal } from '@angular/core';

export type ToastSeverity = 'error' | 'success' | 'warning' | 'info';

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

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _messages = signal<ActiveToast[]>([]);
  readonly messages = this._messages.asReadonly();

  show(message: ToastMessage): void {
    const toast: ActiveToast = { ...message, id: this.nextId++ };
    this._messages.update((list) => [...list, toast]);
    const life = message.life ?? 5000;
    if (life > 0) {
      setTimeout(() => this.dismiss(toast.id), life);
    }
  }

  dismiss(id: number): void {
    this._messages.update((list) => list.filter((t) => t.id !== id));
  }
}
