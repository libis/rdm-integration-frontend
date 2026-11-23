// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  buildAuthorizeUrl,
  extractReauth,
  normalizeTokenGetter,
  registerReauthAttempt,
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

  it('extracts policy, identity and MFA demands', () => {
    expect(
      extractReauth({
        status: 401,
        error: {
          reauth: {
            required_policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
          },
        },
      }),
    ).toEqual({ policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'] });
    expect(
      extractReauth({
        status: 401,
        error: {
          reauth: {
            required_identities: ['11111111-2222-4333-8444-555555555555'],
            required_mfa: true,
          },
        },
      }),
    ).toEqual({
      identities: ['11111111-2222-4333-8444-555555555555'],
      mfa: true,
    });
  });

  it('returns undefined for plain errors and empty payloads', () => {
    expect(extractReauth({ status: 500, error: 'boom' })).toBeUndefined();
    expect(
      extractReauth({ status: 401, error: 'session expired' }),
    ).toBeUndefined();
    expect(
      extractReauth({ status: 401, error: { reauth: {} } }),
    ).toBeUndefined();
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
    expect(base.authorizeUrl).toBe(
      'https://auth.globus.org/v2/oauth2/authorize',
    );
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
    expect(base.authorizeUrl).toBe(
      'https://auth.globus.org/v2/oauth2/authorize',
    );
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
  const opts = {
    redirectUri: 'https://app.example.org/connect',
    state: '{"nonce":"n"}',
  };

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

  it('keeps a scope that needs consent for two collections intact', () => {
    // From the Globus Transfer API docs: the data_access dependencies of
    // both collections, separated by a space, in one scope
    const twoCollections =
      'urn:globus:auth:scope:transfer.api.globus.org:all' +
      '[*https://auth.globus.org/scopes/ea4c8cf2-d3a2-4c1a-92c2-59925fe7ac5b/data_access' +
      ' *https://auth.globus.org/scopes/0357da44-c908-47e5-8351-ba5c695d11a7/data_access]';
    const reauth = extractReauth({
      status: 401,
      error: { reauth: { required_scopes: [twoCollections] } },
    });
    expect(reauth).toEqual({ scopes: [twoCollections] });
    const p = params(buildAuthorizeUrl(base, { ...opts, reauth }));
    expect(p.get('scope')).toBe(`${twoCollections} openid email profile`);
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
      buildAuthorizeUrl(base, {
        ...opts,
        reauth: { domains: ['sydney.edu.au'] },
      }),
    );
    expect(p.get('session_required_single_domain')).toBe('sydney.edu.au');
    expect(p.get('prompt')).toBe('login');
  });

  it('omits base domains in guest mode', () => {
    const p = params(buildAuthorizeUrl(base, { ...opts, guestMode: true }));
    expect(p.get('session_required_single_domain')).toBeNull();
    expect(p.get('prompt')).toBeNull();
  });

  // Globus Auth: policies cannot be combined with domains, identities or MFA
  it('sends a policy demand alone and forces a fresh login', () => {
    const p = params(
      buildAuthorizeUrl(base, {
        ...opts,
        reauth: {
          policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b', 'other-policy'],
        },
      }),
    );
    expect(p.get('session_required_policies')).toBe(
      '6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b,other-policy',
    );
    expect(p.get('session_required_single_domain')).toBeNull();
    expect(p.get('session_required_identities')).toBeNull();
    expect(p.get('session_required_mfa')).toBeNull();
    expect(p.get('prompt')).toBe('login');
  });

  // Globus Auth: identities cannot be combined with domains
  it('sends demanded identities with MFA but without domains', () => {
    const p = params(
      buildAuthorizeUrl(base, {
        ...opts,
        reauth: {
          identities: ['11111111-2222-4333-8444-555555555555'],
          mfa: true,
        },
      }),
    );
    expect(p.get('session_required_identities')).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
    expect(p.get('session_required_mfa')).toBe('true');
    expect(p.get('session_required_single_domain')).toBeNull();
    expect(p.get('prompt')).toBe('login');
  });

  it('sends an MFA demand with the demanded domains', () => {
    const p = params(
      buildAuthorizeUrl(base, {
        ...opts,
        reauth: { domains: ['sydney.edu.au'], mfa: true },
      }),
    );
    expect(p.get('session_required_single_domain')).toBe('sydney.edu.au');
    expect(p.get('session_required_mfa')).toBe('true');
    expect(p.get('prompt')).toBe('login');
  });

  it('sends an MFA demand alone with the configured domains', () => {
    const p = params(
      buildAuthorizeUrl(base, { ...opts, reauth: { mfa: true } }),
    );
    expect(p.get('session_required_single_domain')).toBe('kuleuven.be');
    expect(p.get('session_required_mfa')).toBe('true');
    expect(p.get('prompt')).toBe('login');
  });

  // Globus Auth only accepts MFA together with a domain or identities
  it('cannot send an MFA demand alone in guest mode, still forces a fresh login', () => {
    const p = params(
      buildAuthorizeUrl(base, {
        ...opts,
        guestMode: true,
        reauth: { mfa: true },
      }),
    );
    expect(p.get('session_required_mfa')).toBeNull();
    expect(p.get('prompt')).toBe('login');
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

  it('keeps policy, identity and MFA demands', () => {
    const demand = {
      policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
      identities: ['11111111-2222-4333-8444-555555555555'],
      mfa: true,
    };
    storePendingReauth(demand);
    expect(takePendingReauth()).toEqual(demand);
  });

  it('stores and takes exactly once', () => {
    storePendingReauth({ domains: ['sydney.edu.au'] });
    expect(takePendingReauth()).toEqual({ domains: ['sydney.edu.au'] });
    expect(takePendingReauth()).toBeUndefined();
  });

  it('survives malformed storage content', () => {
    sessionStorage.setItem('pendingReauth', 'not-json');
    expect(takePendingReauth()).toBeUndefined();
  });

  it('discards a stored demand older than the max age', () => {
    sessionStorage.setItem(
      'pendingReauth',
      JSON.stringify({
        scopes: ['scope-a'],
        storedAt: Date.now() - 6 * 60 * 1000,
      }),
    );
    expect(takePendingReauth()).toBeUndefined();
  });

  it('discards an entry without a timestamp (older app version)', () => {
    sessionStorage.setItem(
      'pendingReauth',
      JSON.stringify({ scopes: ['scope-a'] }),
    );
    expect(takePendingReauth()).toBeUndefined();
  });
});

describe('registerReauthAttempt', () => {
  afterEach(() => sessionStorage.removeItem('reauthAttempts'));

  it('allows up to two consecutive attempts for the same demand', () => {
    const demand = { domains: ['kuleuven.be'] };
    expect(registerReauthAttempt(demand)).toBeTrue();
    expect(registerReauthAttempt(demand)).toBeTrue();
  });

  it('blocks the third consecutive attempt for the same demand', () => {
    const demand = { domains: ['kuleuven.be'] };
    registerReauthAttempt(demand);
    registerReauthAttempt(demand);
    expect(registerReauthAttempt(demand)).toBeFalse();
  });

  it('a different demand restarts the counter', () => {
    const domainDemand = { domains: ['kuleuven.be'] };
    registerReauthAttempt(domainDemand);
    registerReauthAttempt(domainDemand);
    expect(registerReauthAttempt({ scopes: ['scope-a'] })).toBeTrue();
  });

  it('counts a different policy as a different demand', () => {
    registerReauthAttempt({
      policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
    });
    registerReauthAttempt({
      policies: ['6f5a1e2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
    });
    expect(registerReauthAttempt({ policies: ['other-policy'] })).toBeTrue();
  });

  it('forgets attempts older than the window', () => {
    sessionStorage.setItem(
      'reauthAttempts',
      JSON.stringify({
        key: JSON.stringify([[], ['kuleuven.be'], [], [], false]),
        count: 2,
        firstAt: Date.now() - 6 * 60 * 1000,
      }),
    );
    expect(registerReauthAttempt({ domains: ['kuleuven.be'] })).toBeTrue();
  });

  it('survives unavailable or malformed storage by allowing the attempt', () => {
    sessionStorage.setItem('reauthAttempts', 'not-json');
    expect(registerReauthAttempt({ scopes: ['scope-a'] })).toBeTrue();
  });
});
