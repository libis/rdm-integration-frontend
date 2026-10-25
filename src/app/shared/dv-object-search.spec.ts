import { signal } from '@angular/core';
import { Observable, Subscription, of, throwError } from 'rxjs';
import { SelectItem } from '../models/select-item';
import { answerLater } from '../../testing/answer-later';
import { settlePromises } from '../../testing/promises';
import { APP_CONSTANTS } from './constants';
import { DvObjectSearch } from './dv-object-search';

describe('DvObjectSearch', () => {
  const found = [{ label: 'Dataset C', value: 'doi:10.1/C' }];
  const start = {
    label: 'start typing to search (at least three letters)',
    value: 'start',
  };
  let generation: number;
  let subscription: Subscription | undefined;

  const setup = (
    answer: (term: string) => Observable<SelectItem<string>[]> = () =>
      answerLater(found),
    extra: {
      prepend?: SelectItem<string>;
      answered?: (items: SelectItem<string>[]) => void;
      failed?: (err: { message: string }) => void;
    } = {},
  ) => {
    const items = signal<SelectItem<string>[]>([]);
    const lookup = jasmine.createSpy('lookup').and.callFake(answer);
    const search = new DvObjectSearch({
      items,
      lookup,
      generation: () => generation,
      ...extra,
    });
    subscription = search.start();
    return { items, lookup, search };
  };

  // debounceTime reads Date.now(), hence mockDate.
  beforeEach(() => {
    generation = 0;
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 25));
  });
  afterEach(() => {
    subscription?.unsubscribe();
    jasmine.clock().uninstall();
  });

  it('asks for three letters and searches nothing before', () => {
    const { items, lookup, search } = setup();
    search.onSearch(null);
    expect(items()).toEqual([start]);
    search.onSearch('ab');
    expect(items()).toEqual([start]);
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('searches the last term DEBOUNCE_TIME after it and lists the answer', async () => {
    const { items, lookup, search } = setup();
    search.onSearch('abc');
    expect(items()).toEqual([{ label: 'searching "abc"...', value: 'abc' }]);
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME / 2);
    search.onSearch('abcd');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME - 1);
    expect(lookup).not.toHaveBeenCalled();
    expect(items()).toEqual([{ label: 'searching "abcd"...', value: 'abcd' }]);
    jasmine.clock().tick(1);
    expect(lookup).toHaveBeenCalledOnceWith('abcd');
    jasmine.clock().tick(0);
    await settlePromises();
    expect(items()).toEqual(found);
  });

  it('puts the prepended option first and runs answered with the options set', async () => {
    const createNew = {
      label: '+ Create new dataset',
      value: 'CREATE_NEW_DATASET',
    };
    let listed: SelectItem<string>[] | undefined;
    const answered = jasmine
      .createSpy('answered')
      .and.callFake(() => (listed = items()));
    const { items, search } = setup(() => of(found), {
      prepend: createNew,
      answered,
    });
    expect(await search.search('abc')).toEqual([createNew, ...found]);
    search.onSearch('abc');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    await settlePromises();
    expect(items()).toEqual([createNew, ...found]);
    expect(answered).toHaveBeenCalledOnceWith([createNew, ...found]);
    expect(listed).toEqual([createNew, ...found]);
  });

  it('lists a failure after running failed', async () => {
    let listed: SelectItem<string>[] | undefined;
    const failed = jasmine
      .createSpy('failed')
      .and.callFake(() => (listed = items()));
    const { items, search } = setup(() => throwError(() => new Error('boom')), {
      failed,
    });
    search.onSearch('abc');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    await settlePromises();
    expect(failed).toHaveBeenCalledOnceWith(new Error('boom'));
    expect(listed).toEqual([{ label: 'searching "abc"...', value: 'abc' }]);
    expect(items()).toEqual([{ label: 'search failed: boom', value: 'boom' }]);
  });

  it('lists a failure of the terms themselves', () => {
    const failed = jasmine.createSpy('failed');
    const { items, search } = setup(undefined, { failed });
    search.terms.error(new Error('Test error'));
    expect(failed).toHaveBeenCalledOnceWith(new Error('Test error'));
    expect(items()).toEqual([
      { label: 'search failed: Test error', value: 'Test error' },
    ]);
  });

  it('drops an answer and a failure that come after a reset', async () => {
    const failed = jasmine.createSpy('failed');
    let fail = false;
    const { items, search } = setup(
      () => (fail ? throwError(() => new Error('boom')) : answerLater(found)),
      { failed },
    );
    search.onSearch('abc');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    generation++;
    jasmine.clock().tick(0);
    await settlePromises();
    expect(items()).toEqual([{ label: 'searching "abc"...', value: 'abc' }]);

    fail = true;
    search.onSearch('abcd');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    generation++;
    await settlePromises();
    expect(failed).not.toHaveBeenCalled();
    expect(items()).toEqual([{ label: 'searching "abcd"...', value: 'abcd' }]);
  });

  // The generation is the one the search is sent in, after the debounce.
  it('keeps the answer to a search sent after a reset', async () => {
    const { items, search } = setup();
    search.onSearch('abc');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME - 1);
    generation++;
    jasmine.clock().tick(1);
    jasmine.clock().tick(0);
    await settlePromises();
    expect(items()).toEqual(found);
  });

  it('searches nothing once its subscription ended', () => {
    const { lookup, search } = setup();
    subscription!.unsubscribe();
    search.onSearch('abc');
    jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
    expect(lookup).not.toHaveBeenCalled();
  });
});
