import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, InjectionToken } from '@angular/core';

export const WINDOW = new InjectionToken<Window>('RDM_WINDOW', {
  factory: () => window,
});

@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(WINDOW) private readonly defaultWindow: Window,
  ) {}

  assign(url: string): void {
    const targetWindow = this.document?.defaultView ?? this.defaultWindow;
    targetWindow.location.assign(url);
  }
}
