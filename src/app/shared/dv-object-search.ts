// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { WritableSignal } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  debounceTime,
  firstValueFrom,
  map,
} from 'rxjs';
import { SelectItem } from '../models/select-item';
import { APP_CONSTANTS } from './constants';

interface DvObjectSearchConfig {
  /** The options of the select: the placeholders, then the answer. */
  readonly items: WritableSignal<SelectItem<string>[]>;
  /** The lookup of a term, with the page's parameters. */
  readonly lookup: (term: string) => Observable<SelectItem<string>[]>;
  /** Makes the option put before every answer, such as "+ Create new dataset". */
  readonly prepend?: () => SelectItem<string>;
  /** The resets of the page so far (TokenEdit.generation). */
  readonly generation: () => number;
  /** Runs after an answer is in the options. */
  readonly answered?: (items: SelectItem<string>[]) => void;
  /** Runs before a failure is in the options, to show a toast for instance. */
  readonly failed?: (err: { message: string }) => void;
}

/**
 * The search of a select of Dataverse objects, datasets or collections: the
 * filter of the select asks for it with at least three letters, and the
 * lookup is sent DEBOUNCE_TIME after the last change of the filter. An answer
 * or a failure that comes after a token change has reset the page is dropped.
 */
export class DvObjectSearch {
  /** The terms to search, before the debounce. */
  readonly terms = new Subject<string>();
  /** The answer to each term searched, after the debounce. */
  readonly results: Observable<Promise<SelectItem<string>[]>>;

  constructor(private readonly config: DvObjectSearchConfig) {
    this.results = this.terms.pipe(
      debounceTime(APP_CONSTANTS.DEBOUNCE_TIME),
      map((term) => this.search(term)),
    );
  }

  /** The filter of the select changed. */
  onSearch(term: string | null): void {
    if (term === null || term.length < 3) {
      this.config.items.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.config.items.set([{ label: `searching "${term}"...`, value: term }]);
    this.terms.next(term);
  }

  /** Looks the term up; a new prepended option comes first. */
  async search(term: string): Promise<SelectItem<string>[]> {
    const items = await firstValueFrom(this.config.lookup(term));
    return this.config.prepend ? [this.config.prepend(), ...items] : items;
  }

  /** Puts the answers in the options until the subscription ends. */
  start(): Subscription {
    return this.results.subscribe({
      next: (answer) => {
        // The search has just been sent; its answer is dropped when a token
        // change has reset the page since.
        const generation = this.config.generation();
        answer
          .then((items) => {
            if (this.config.generation() !== generation) return;
            this.config.items.set(items);
            this.config.answered?.(items);
          })
          .catch((err) => {
            if (this.config.generation() !== generation) return;
            this.fail(err);
          });
      },
      error: (err) => this.fail(err),
    });
  }

  private fail(err: { message: string }): void {
    this.config.failed?.(err);
    this.config.items.set([
      { label: `search failed: ${err.message}`, value: err.message },
    ]);
  }
}
