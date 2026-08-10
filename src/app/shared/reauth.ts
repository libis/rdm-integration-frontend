// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { TokenGetter } from '../models/plugin';

/** What a new OAuth login must include, as demanded by a backend error. */
export interface ReauthRequest {
  scopes?: string[];
  domains?: string[];
  message?: string;
}

/** Normalized token-getter configuration for OAuth authorize URL building. */
export interface AuthorizeBase {
  authorizeUrl: string;
  clientId: string;
  baseScopes: string[];
  baseDomains: string[];
}

interface ReauthPayload {
  required_scopes?: string[];
  required_domains?: string[];
  message?: string;
}

const LEGACY_MARKER = '*scopes*';
const PENDING_REAUTH_KEY = 'pendingReauth';

/**
 * Inspect a failed HTTP response for a re-authentication demand.
 * Primary: structured `401 {"reauth": {...}}` responses from the backend.
 * Fallback: the legacy `*scopes*<space-joined scopes>*scopes*` marker in
 * plain-text bodies (kept for backend/frontend version skew).
 */
export function extractReauth(err: unknown): ReauthRequest | undefined {
  const e = err as
    | { status?: number; error?: unknown; message?: unknown }
    | undefined;
  if (!e) return undefined;
  if (e.status === 401 && typeof e.error === 'object' && e.error !== null) {
    const payload = (e.error as { reauth?: ReauthPayload }).reauth;
    if (payload) {
      const res: ReauthRequest = {};
      if (payload.required_scopes?.length) res.scopes = payload.required_scopes;
      if (payload.required_domains?.length)
        res.domains = payload.required_domains;
      if (payload.message) res.message = payload.message;
      if (res.scopes || res.domains) return res;
    }
    return undefined;
  }
  const text =
    (typeof e.error === 'string' ? e.error : undefined) ??
    (typeof e.message === 'string' ? e.message : undefined) ??
    '';
  const first = text.indexOf(LEGACY_MARKER);
  const last = text.lastIndexOf(LEGACY_MARKER);
  if (first < 0 || last <= first) return undefined;
  const scopes = text
    .substring(first + LEGACY_MARKER.length, last)
    .split(' ')
    .filter((s) => s.length > 0);
  return scopes.length > 0 ? { scopes } : undefined;
}

/**
 * Normalize a token getter into an AuthorizeBase. Structured config fields
 * (scopes, session_required_single_domain) are preferred; when absent they
 * are parsed out of the legacy URL query string and stripped from the base
 * URL. Returns undefined when there is no OAuth client id or the resolved
 * URL is not absolute (non-OAuth token getters open a plain window instead).
 */
export function normalizeTokenGetter(
  tg: TokenGetter | undefined,
  resolvedUrl: string,
): AuthorizeBase | undefined {
  if (!tg?.oauth_client_id || !resolvedUrl.includes('://')) return undefined;
  let url: URL;
  try {
    url = new URL(resolvedUrl);
  } catch {
    return undefined;
  }
  const urlScope = url.searchParams.get('scope');
  const urlDomains = url.searchParams.get('session_required_single_domain');
  url.searchParams.delete('scope');
  url.searchParams.delete('session_required_single_domain');
  const baseScopes =
    tg.scopes ?? (urlScope ? urlScope.split(/[\s+]+/).filter(Boolean) : []);
  const baseDomains =
    tg.session_required_single_domain ??
    (urlDomains ? urlDomains.split(',').filter(Boolean) : []);
  return {
    authorizeUrl: url.toString(),
    clientId: tg.oauth_client_id,
    baseScopes,
    baseDomains,
  };
}

/**
 * Merge required scopes into the base scope list: a required scope replaces
 * the base entry it extends (same prefix before `[`), unmatched required
 * scopes are appended, all other base entries are preserved. Keeping
 * openid/email/profile intact is essential — dropping them breaks the
 * backend userinfo (getPrincipal) call after re-login.
 */
function mergeScopes(baseScopes: string[], required: string[]): string[] {
  const result = [...baseScopes];
  for (const req of required) {
    const reqBase = req.split('[')[0];
    const i = result.findIndex((s) => s.split('[')[0] === reqBase);
    if (i >= 0) result[i] = req;
    else result.push(req);
  }
  return result;
}

/**
 * Build the OAuth authorize URL. Reauth-demanded domains replace the
 * configured ones and force a fresh login (`prompt=login`); guest mode omits
 * the configured domains (any Globus identity may be used) unless an error
 * explicitly demanded one.
 */
export function buildAuthorizeUrl(
  base: AuthorizeBase,
  opts: {
    redirectUri: string;
    state: string;
    reauth?: ReauthRequest;
    guestMode?: boolean;
  },
): string {
  const url = new URL(base.authorizeUrl);
  const scopes = mergeScopes(base.baseScopes, opts.reauth?.scopes ?? []);
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '));
  }
  const demanded = opts.reauth?.domains ?? [];
  const domains =
    demanded.length > 0 ? demanded : opts.guestMode ? [] : base.baseDomains;
  if (domains.length > 0) {
    url.searchParams.set('session_required_single_domain', domains.join(','));
  }
  if (demanded.length > 0) {
    url.searchParams.set('prompt', 'login');
  }
  url.searchParams.set('client_id', base.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', opts.state);
  return url.toString();
}

/** Persist a reauth demand across an in-app navigation (compare -> connect). */
export function storePendingReauth(reauth: ReauthRequest): void {
  try {
    sessionStorage.setItem(PENDING_REAUTH_KEY, JSON.stringify(reauth));
  } catch {
    // Storage unavailable (private mode) — the user can re-authorize manually.
  }
}

/** Read and clear a stored reauth demand. */
export function takePendingReauth(): ReauthRequest | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_REAUTH_KEY);
    sessionStorage.removeItem(PENDING_REAUTH_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ReauthRequest;
    return parsed.scopes || parsed.domains ? parsed : undefined;
  } catch {
    return undefined;
  }
}
