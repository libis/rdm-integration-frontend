// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';

// On the body while a dialog is open; styles.scss raises the CDK overlays above the modal then.
const DIALOG_OPEN_CLASS = 'app-dialog-open';

// The elements an open dialog stops from scrolling, with the number of open dialogs that stop
// each one and how to put its inline styles back when the last of them closes.
const scrollLocks = new Map<HTMLElement, { count: number; undo: () => void }>();
let openDialogs = 0;

// Hides the overflow of the page (on the body, as Bootstrap's modal does) or of a scrolling
// ancestor. Where a scrollbar showed, its gutter stays, so the content does not move.
function stopScrolling(el: HTMLElement): () => void {
  const page = el === document.body;
  const gutterOf = page ? document.documentElement : el;
  const style = getComputedStyle(el);
  const scrollbar = page
    ? window.innerWidth > document.documentElement.clientWidth
    : el.offsetWidth -
        el.clientWidth -
        parseFloat(style.borderLeftWidth) -
        parseFloat(style.borderRightWidth) >
      0;
  const before = {
    overflow: el.style.overflow,
    overflowY: el.style.overflowY,
    gutter: gutterOf.style.scrollbarGutter,
  };
  if (page) el.style.overflow = 'hidden';
  else el.style.overflowY = 'hidden';
  if (scrollbar) gutterOf.style.scrollbarGutter = 'stable';
  return () => {
    el.style.overflow = before.overflow;
    el.style.overflowY = before.overflowY;
    gutterOf.style.scrollbarGutter = before.gutter;
    for (const changed of [el, gutterOf]) {
      if (changed.getAttribute('style') === '')
        changed.removeAttribute('style');
    }
  };
}

// The page and every scrolling ancestor of the dialog, such as the host of a page that fits
// the window.
function lockScroll(host: HTMLElement): HTMLElement[] {
  const locked = [document.body];
  let el = host.parentElement;
  while (el && el !== document.body) {
    // An ancestor another open dialog stopped no longer looks like it scrolls.
    const scrolls = ['auto', 'scroll'].includes(getComputedStyle(el).overflowY);
    if (scrolls || scrollLocks.has(el)) locked.push(el);
    el = el.parentElement;
  }
  for (const target of locked) {
    const lock = scrollLocks.get(target);
    if (lock) lock.count++;
    else scrollLocks.set(target, { count: 1, undo: stopScrolling(target) });
  }
  if (openDialogs++ === 0) document.body.classList.add(DIALOG_OPEN_CLASS);
  return locked;
}

function unlockScroll(locked: HTMLElement[]): void {
  for (const el of locked) {
    const lock = scrollLocks.get(el);
    if (lock && --lock.count === 0) {
      lock.undo();
      scrollLocks.delete(el);
    }
  }
  if (--openDialogs === 0) document.body.classList.remove(DIALOG_OPEN_CLASS);
}

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class DialogComponent {
  readonly visible = model(false);
  readonly header = input('');
  readonly closable = input(true);
  readonly position = input<'center' | 'topright'>('center');
  readonly hidden = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let wasVisible = false;
    // What the open dialog stopped from scrolling, while it is open.
    let locked: HTMLElement[] | undefined;
    const unlock = () => {
      if (locked) unlockScroll(locked);
      locked = undefined;
    };
    effect(() => {
      const now = this.visible();
      if (wasVisible && !now) this.hidden.emit();
      wasVisible = now;
      if (now && !locked) locked = lockScroll(host);
      if (!now) unlock();
    });
    inject(DestroyRef).onDestroy(unlock);
  }

  close(): void {
    if (!this.closable()) return;
    this.visible.set(false);
  }

  onEscape(): void {
    if (this.visible()) this.close();
  }
}
