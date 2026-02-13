import { WritableSignal } from '@angular/core';

/**
 * Centralized helper for zoneless flows that mutate object/array contents in place.
 * Call this after mutation so dependent computeds/templates are re-evaluated.
 */
export function bumpRefreshTrigger(trigger: WritableSignal<number>): void {
  trigger.update((n) => n + 1);
}

/**
 * Run an in-place mutation block and then bump the refresh trigger.
 */
export function mutateWithRefresh<T>(
  trigger: WritableSignal<number>,
  mutate: () => T,
): T {
  const result = mutate();
  bumpRefreshTrigger(trigger);
  return result;
}
