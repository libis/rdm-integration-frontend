// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  buildAuthorizeUrl,
  extractReauth,
  normalizeTokenGetter,
  storePendingReauth,
  takePendingReauth,
} from './reauth';

describe('extractReauth', () => {
  it('extracts structured 401 payload', () => {
    const err = {
      status: 401,
      error: {
        reauth: {
          required_scopes: ['scope-a'],
          required_domains: ['sydney.edu.au'],
          message: 'institutional login required',
        },
      },
    };
    expect(extractReauth(err)).toEqual({
      scopes: ['scope-a'],
      domains: ['sydney.edu.au'],
      message: 'institutional login required',
    });
  });

  it('extracts legacy *scopes* marker from string error body', () => {
    const err = { status: 500, error: '500 - *scopes*scope-a scope-b*scopes*' };
    expect(extractReauth(err)).toEqual({ scopes: ['scope-a', 'scope-b'] });
  });

  it('extracts legacy marker from message field', () => {
    expect(extractReauth({ message: '*scopes*repo.read*scopes*' })).toEqual({
      scopes: ['repo.read'],
    });
  });

  it('returns undefined for plain errors and empty payloads', () => {
    expect(extractReauth({ status: 500, error: 'boom' })).toBeUndefined();
    expect(extractReauth({ status: 401, error: 'session expired' })).toBeUndefined();
    expect(extractReauth({ status: 401, error: { reauth: {} } })).toBeUndefined();
    expect(extractReauth(undefined)).toBeUndefined();
  });
});

describe('normalizeTokenGetter', () => {
  const legacyUrl =
    'https://auth.globus.org/v2/oauth2/authorize?scope=urn%3Aglobus%3Aauth%3Ascope%3Atransfer.api.globus.org%3Aall+openid+email+profile&session_required_single_domain=kuleuven.be';

  it('prefers structured fields when present', () => {
    const base = normalizeTokenGetter(
      {
        URL: 'https://auth.globus.org/v2/oauth2/authorize',
        oauth_client_id: 'client-1',
        scopes: ['scope-a', 'openid'],
        session_required_single_domain: ['kuleuven.be'],
      },
      'https://auth.globus.org/v2/oauth2/authorize',
    )!;
    expect(base.authorizeUrl).toBe('https://auth.globus.org/v2/oauth2/authorize');
    expect(base.clientId).toBe('client-1');
    expect(base.baseScopes).toEqual(['scope-a', 'openid']);
    expect(base.baseDomains).toEqual(['kuleuven.be']);
  });

  it('parses legacy URL query params and strips them from the base URL', () => {
    const base = normalizeTokenGetter(
      { URL: legacyUrl, oauth_client_id: 'client-1' },
      legacyUrl,
    )!;
    expect(base.baseScopes).toEqual([
      'urn:globus:auth:scope:transfer.api.globus.org:all',
      'openid',
      'email',
      'profile',
    ]);
    expect(base.baseDomains).toEqual(['kuleuven.be']);
    expect(base.authorizeUrl).toBe('https://auth.globus.org/v2/oauth2/authorize');
  });

  it('preserves unrelated query params in the base URL', () => {
    const base = normalizeTokenGetter(
      {
        URL: 'https://example.org/authorize?scope=a&foo=bar',
        oauth_client_id: 'client-1',
      },
      'https://example.org/authorize?scope=a&foo=bar',
    )!;
    expect(base.authorizeUrl).toBe('https://example.org/authorize?foo=bar');
    expect(base.baseScopes).toEqual(['a']);
  });

  it('returns undefined without client id or absolute URL', () => {
    expect(normalizeTokenGetter({ URL: legacyUrl }, legacyUrl)).toBeUndefined();
    expect(
      normalizeTokenGetter(
        { URL: 'settings/tokens', oauth_client_id: 'client-1' },
        'https://github.com/settings/tokens'.replace('https://', ''),
      ),
    ).toBeUndefined();
  });
});

describe('buildAuthorizeUrl', () => {
  const base = {
    authorizeUrl: 'https://auth.globus.org/v2/oauth2/authorize',
    clientId: 'client-1',
    baseScopes: [
      'urn:globus:auth:scope:transfer.api.globus.org:all',
      'openid',
      'email',
      'profile',
    ],
    baseDomains: ['kuleuven.be'],
  };
  const opts = { redirectUri: 'https://app.example.org/connect', state: '{"nonce":"n"}' };

  function params(url: string): URLSearchParams {
    return new URL(url).searchParams;
  }

  it('builds default URL with base scopes and domains', () => {
    const p = params(buildAuthorizeUrl(base, opts));
    expect(p.get('scope')).toBe(
      'urn:globus:auth:scope:transfer.api.globus.org:all openid email profile',
    );
    expect(p.get('session_required_single_domain')).toBe('kuleuven.be');
    expect(p.get('client_id')).toBe('client-1');
    expect(p.get('redirect_uri')).toBe('https://app.example.org/connect');
    expect(p.get('response_type')).toBe('code');
    expect(p.get('state')).toBe('{"nonce":"n"}');
    expect(p.get('prompt')).toBeNull();
  });

  it('merges required scopes by base prefix, keeping other base scopes', () => {
    const consented =
      'urn:globus:auth:scope:transfer.api.globus.org:all[*https://auth.globus.org/scopes/x/data_access]';
    const p = params(
      buildAuthorizeUrl(base, { ...opts, reauth: { scopes: [consented] } }),
    );
    expect(p.get('scope')).toBe(`${consented} openid email profile`);
  });

  it('appends unmatched required scopes', () => {
    const p = params(
      buildAuthorizeUrl(
        { ...base, baseScopes: [] },
        { ...opts, reauth: { scopes: ['repo.read'] } },
      ),
    );
    expect(p.get('scope')).toBe('repo.read');
  });

  it('replaces domains and forces fresh login when reauth demands domains', () => {
    const p = params(
      buildAuthorizeUrl(base, { ...opts, reauth: { domains: ['sydney.edu.au'] } }),
    );
    expect(p.get('session_required_single_domain')).toBe('sydney.edu.au');
    expect(p.get('prompt')).toBe('login');
  });

  it('omits base domains in guest mode', () => {
    const p = params(buildAuthorizeUrl(base, { ...opts, guestMode: true }));
    expect(p.get('session_required_single_domain')).toBeNull();
    expect(p.get('prompt')).toBeNull();
  });

  it('applies error-demanded domains even in guest mode', () => {
    const p = params(
      buildAuthorizeUrl(base, {
        ...opts,
        guestMode: true,
        reauth: { domains: ['sydney.edu.au'] },
      }),
    );
    expect(p.get('session_required_single_domain')).toBe('sydney.edu.au');
    expect(p.get('prompt')).toBe('login');
  });
});

describe('pending reauth storage', () => {
  afterEach(() => sessionStorage.removeItem('pendingReauth'));

  it('stores and takes exactly once', () => {
    storePendingReauth({ domains: ['sydney.edu.au'] });
    expect(takePendingReauth()).toEqual({ domains: ['sydney.edu.au'] });
    expect(takePendingReauth()).toBeUndefined();
  });

  it('survives malformed storage content', () => {
    sessionStorage.setItem('pendingReauth', 'not-json');
    expect(takePendingReauth()).toBeUndefined();
  });
});
