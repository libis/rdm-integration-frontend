// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { LoginState } from '../models/oauth';
import { restoreLoginState, stashLoginState } from './login-state-storage';

describe('login state storage', () => {
  const fileIds = Array.from({ length: 5000 }, (_, i) => String(1000000 + i));
  const full: LoginState = {
    nonce: 'nonce-1',
    download: true,
    downloadId: 'dl-1',
    accessMode: 'guest',
    dataverseToken: 'secret-token',
    datasetId: { label: 'doi:10.48804/X', value: 'doi:10.48804/X' },
    preSelectedFileIds: fileIds,
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('sends only the nonce and the download flag', () => {
    expect(JSON.parse(stashLoginState(full))).toEqual({
      nonce: 'nonce-1',
      download: true,
    });
  });

  it('leaves out the download flag for other logins', () => {
    const state = stashLoginState({ nonce: 'n2', repoName: 'org/repo' });
    expect(JSON.parse(state)).toEqual({ nonce: 'n2' });
  });

  it('keeps the state parameter short however many files are selected', () => {
    expect(stashLoginState(full).length).toBeLessThan(100);
  });

  it('restores the full state kept in the browser for the same nonce', () => {
    const param = stashLoginState(full);
    expect(restoreLoginState(param)).toEqual(full);
  });

  it('restores the full state again on a second read', () => {
    const param = stashLoginState(full);
    restoreLoginState(param);
    expect(restoreLoginState(param)).toEqual(full);
  });

  it('returns only what the URL carried when the nonce differs', () => {
    stashLoginState(full);
    const other = JSON.stringify({ nonce: 'other', download: true });
    expect(restoreLoginState(other)).toEqual({
      nonce: 'other',
      download: true,
    });
  });

  it('accepts a full state from a login started before this change', () => {
    const legacy = JSON.stringify(full);
    expect(restoreLoginState(legacy)).toEqual(full);
  });

  it('rejects a state that is not a JSON object', () => {
    expect(restoreLoginState('not json')).toBeUndefined();
    expect(restoreLoginState('"text"')).toBeUndefined();
  });

  it('still sends a minimal state when the browser storage fails', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    const param = stashLoginState(full);
    expect(JSON.parse(param)).toEqual({ nonce: 'nonce-1', download: true });
    expect(restoreLoginState(param)).toEqual({
      nonce: 'nonce-1',
      download: true,
    });
  });
});
