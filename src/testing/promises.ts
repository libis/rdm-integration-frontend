/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

/**
 * Lets the promise callbacks queued so far run, and those they queue in turn,
 * for a fixed number of microtask turns. It waits for no timer, so it gives
 * the same result on a busy machine and works while jasmine.clock() holds the
 * timers: an async ngOnInit or a search result promise settles, a debounce
 * waits for the clock to tick.
 */
export async function settlePromises(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}
