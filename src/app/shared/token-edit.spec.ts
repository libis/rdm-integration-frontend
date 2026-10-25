import { signal } from '@angular/core';
import { TokenEdit } from './token-edit';

describe('TokenEdit', () => {
  let keep: jasmine.Spy<() => boolean>;
  const setup = (initial?: string) => {
    const token = signal<string | undefined>(initial);
    return { token, edit: new TokenEdit(token, keep) };
  };

  beforeEach(() => {
    keep = jasmine.createSpy('storeToken').and.returnValue(false);
    localStorage.removeItem('dataverseToken');
  });
  afterEach(() => localStorage.removeItem('dataverseToken'));

  it('restores the kept token only when the configuration keeps it', () => {
    localStorage.setItem('dataverseToken', 'kept');
    const { token, edit } = setup('initial');
    edit.restore();
    expect(token()).toBe('initial');
    keep.and.returnValue(true);
    edit.restore();
    expect(token()).toBe('kept');
    localStorage.removeItem('dataverseToken');
    token.set('other');
    edit.restore();
    expect(token()).toBe('other');
    // A restore is no edit: the next commit resets nothing.
    expect(edit.commit()).toBeFalse();
  });

  it('stores a token only when there is one and the configuration keeps it', () => {
    const { token, edit } = setup('tok');
    edit.store();
    expect(localStorage.getItem('dataverseToken')).toBeNull();
    keep.and.returnValue(true);
    edit.store();
    expect(localStorage.getItem('dataverseToken')).toBe('tok');
    token.set(undefined);
    keep.calls.reset();
    edit.store();
    expect(localStorage.getItem('dataverseToken')).toBe('tok');
    expect(keep).not.toHaveBeenCalled();
  });

  it('takes every input and resets on a commit that changed the token', () => {
    const { token, edit } = setup('old');
    edit.input('n');
    expect(token()).toBe('n');
    edit.input('new');
    expect(token()).toBe('new');
    expect(edit.generation).toBe(0);
    expect(edit.commit()).toBeTrue();
    expect(edit.generation).toBe(1);
  });

  it('resets nothing when the commit leaves the token as it was', () => {
    const { token, edit } = setup('old');
    edit.input('oldx');
    edit.input('old');
    expect(edit.commit()).toBeFalse();
    expect(token()).toBe('old');
    expect(edit.generation).toBe(0);
  });

  it('resets nothing on a commit without an edit, the token set in code included', () => {
    const { token, edit } = setup('old');
    expect(edit.commit()).toBeFalse();
    token.set('from code');
    expect(edit.commit()).toBeFalse();
    expect(edit.generation).toBe(0);
  });

  it('starts the next edit from the token the last commit left', () => {
    const { edit } = setup();
    edit.input('a');
    expect(edit.commit()).toBeTrue();
    edit.input('ab');
    edit.input('a');
    expect(edit.commit()).toBeFalse();
    edit.input(undefined);
    expect(edit.commit()).toBeTrue();
    expect(edit.generation).toBe(2);
  });
});
