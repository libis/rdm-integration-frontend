// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { LoginState } from '../models/oauth';

// The OAuth `state` parameter travels through the identity provider and comes
// back in the redirect URL. Only the nonce (and the download flag the app
// needs to route the return) goes there; the rest of the login state stays in
// this tab's sessionStorage. Long file lists made the URL too long (414), and
// tokens do not belong in URLs.
const STORAGE_KEY = 'oauthLoginState';

interface StoredLoginState {
  nonce: string;
  state: LoginState;
}

/**
 * Keep the full login state in the browser and return the minimal JSON to
 * send as the OAuth `state` parameter.
 */
export function stashLoginState(state: LoginState): string {
  try {
    const stored: StoredLoginState = { nonce: state.nonce ?? '', state };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable: the login still works, the selections are lost.
  }
  const minimal: LoginState = { nonce: state.nonce };
  if (state.download) minimal.download = true;
  return JSON.stringify(minimal);
}

/**
 * Read the OAuth `state` parameter after the redirect. Returns the full state
 * kept in the browser for the same nonce, otherwise what the URL carried
 * (logins started before the state moved to the browser carry everything).
 */
export function restoreLoginState(stateParam: string): LoginState | undefined {
  let fromUrl: unknown;
  try {
    fromUrl = JSON.parse(stateParam);
  } catch {
    return undefined;
  }
  if (typeof fromUrl !== 'object' || fromUrl === null) return undefined;
  const urlState = fromUrl as LoginState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredLoginState) : undefined;
    if (urlState.nonce && stored?.nonce === urlState.nonce) {
      return stored.state;
    }
  } catch {
    // Unreadable storage: fall back to the URL.
  }
  return urlState;
}
