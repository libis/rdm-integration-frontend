// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { WritableSignal } from '@angular/core';

/** The localStorage key of the token, kept when the configuration says so. */
const STORED_TOKEN = 'dataverseToken';

/**
 * The edits of the Dataverse token field of a page. The field binds
 * (ngModelChange) to input() and (change) to the page's onUserChange, which
 * resets what the page looked up with the old token when commit() returns
 * true. Every such reset counts: a dataset lookup keeps the generation it was
 * sent in and drops its answer when a reset came since. With storeDvToken in
 * the configuration (storeToken), the token is kept in localStorage.
 */
export class TokenEdit {
  // The token before an edit of the field, kept from the first input event of
  // the edit to the change event that commits it.
  private before?: { value: string | undefined };
  private resets = 0;

  constructor(
    private readonly token: WritableSignal<string | undefined>,
    private readonly storeToken: () => boolean,
  ) {}

  /** The resets so far; a lookup sent before one is stale. */
  get generation(): number {
    return this.resets;
  }

  /** Takes the token kept in localStorage, when the configuration keeps it. */
  restore(): void {
    if (this.storeToken()) {
      const stored = localStorage.getItem(STORED_TOKEN);
      if (stored !== null) {
        this.token.set(stored);
      }
    }
  }

  /** Keeps the token in localStorage, when there is one and the configuration keeps it. */
  store(): void {
    const token = this.token();
    if (token !== undefined && this.storeToken()) {
      localStorage.setItem(STORED_TOKEN, token);
    }
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
