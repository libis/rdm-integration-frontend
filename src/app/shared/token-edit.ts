// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { WritableSignal } from '@angular/core';

/**
 * The edits of the Dataverse token field of a page. The field binds
 * (ngModelChange) to input() and (change) to the page's onUserChange, which
 * resets what the page looked up with the old token when commit() returns
 * true. Every such reset counts: a dataset lookup keeps the generation it was
 * sent in and drops its answer when a reset came since.
 */
export class TokenEdit {
  // The token before an edit of the field, kept from the first input event of
  // the edit to the change event that commits it.
  private before?: { value: string | undefined };
  private resets = 0;

  constructor(private readonly token: WritableSignal<string | undefined>) {}

  /** The resets so far; a lookup sent before one is stale. */
  get generation(): number {
    return this.resets;
  }

  /** An input event of the field. */
  input(value: string | undefined): void {
    this.before ??= { value: this.token() };
    this.token.set(value);
  }

  /**
   * The change event that commits the edit. A commit that leaves the token as
   * it was, a browser filling in the same token again for instance, changes
   * nothing and returns false; any other counts a reset and returns true.
   */
  commit(): boolean {
    const before = this.before;
    this.before = undefined;
    if (before === undefined || before.value === this.token()) {
      return false;
    }
    this.resets++;
    return true;
  }
}
