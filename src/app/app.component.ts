// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { DataService } from './data.service';
import { DatasetService } from './dataset.service';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { PluginService } from './plugin.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
  private primengConfig = inject(PrimeNG);
  dataService = inject(DataService);
  private datasetService = inject(DatasetService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pluginService = inject(PluginService);

  title = 'datasync';

  constructor() {}
  ngOnInit(): void {
    this.primengConfig.ripple.set(true);
    const subscription = this.dataService
      .checkAccessToQueue('', '', '')
      .subscribe({
        next: (access) => {
          subscription.unsubscribe();
          if (!access.access) {
            const computeLink = document.getElementById(
              'navbar-compute-li',
            ) as HTMLElement;
            computeLink?.style.setProperty('display', 'none');
          }
        },
        error: () => {
          const computeLink = document.getElementById(
            'navbar-compute-li',
          ) as HTMLElement;
          computeLink?.style.setProperty('display', 'none');
        },
      });

    // Subscribe to query params and check login requirement
    this.route.queryParams.subscribe((params) => {
      this.checkLoginRequired(params);
    });
  }

  /**
   * Checks if the query params indicate a download flow that should skip login redirect.
   * Download flows allow guest access with Globus OAuth only.
   * Also handles navigation to /download when URL contains /download but route doesn't match.
   * Also handles navigation to /connect when URL contains /upload but route doesn't match.
   */
  private isDownloadFlow(params: Record<string, string | undefined>): boolean {
    // For testing: allow overriding window.location.href
    const locationHref =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)._testWindowLocationHref ?? window.location.href;

    // eslint-disable-next-line no-console
    console.debug('[AppComponent] isDownloadFlow check:', {
      routerUrl: this.router.url,
      params: params,
      windowLocation: locationHref,
    });

    // Check if URL contains /upload but Angular routing failed (e.g., /connect/upload)
    // In this case, redirect to /connect with the same query params
    if (
      locationHref.includes('/upload') &&
      !this.router.url.includes('/connect')
    ) {
      // eslint-disable-next-line no-console
      console.debug(
        '[AppComponent] URL contains /upload but route does not match, redirecting to /connect',
      );
      this.redirectToConnect(locationHref);
      // Return false - uploads require login, so continue with login check
      return false;
    }

    // Check if we're on the download page via router
    if (this.router.url.includes('/download')) {
      // eslint-disable-next-line no-console
      console.debug(
        '[AppComponent] isDownloadFlow: true (router matches /download)',
      );
      return true;
    }

    // Check if URL contains /download but Angular routing failed (e.g., /connect/download)
    // In this case, parse the callback and navigate to /download with the correct params
    if (
      locationHref.includes('/download') &&
      !this.router.url.includes('/download')
    ) {
      // eslint-disable-next-line no-console
      console.debug(
        '[AppComponent] URL contains /download but route does not match, redirecting to /download',
      );
      this.redirectToDownload(locationHref);
      return true;
    }

    // Check callback param for downloadId (Dataverse Globus integration callback)
    // First try Angular params, then fall back to parsing from URL
    let callback = params['callback'];
    if (!callback && Object.keys(params).length === 0) {
      // Angular params empty (route didn't match) - parse from URL
      try {
        const url = new URL(locationHref);
        callback = url.searchParams.get('callback') ?? undefined;
      } catch {
        // Invalid URL, ignore
      }
    }

    if (callback) {
      try {
        const decodedCallback = atob(callback);
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] decoded callback:', decodedCallback);
        if (decodedCallback.includes('downloadId=')) {
          // eslint-disable-next-line no-console
          console.debug(
            '[AppComponent] isDownloadFlow: true (downloadId in callback)',
          );
          return true;
        }
      } catch {
        // Invalid base64, not a download callback
      }
    }

    // Check state param for download flag (OAuth return)
    let state = params['state'];
    if (!state && Object.keys(params).length === 0) {
      // Angular params empty - parse from URL
      try {
        const url = new URL(locationHref);
        state = url.searchParams.get('state') ?? undefined;
      } catch {
        // Invalid URL, ignore
      }
    }

    if (state) {
      try {
        const loginState = JSON.parse(state);
        if (loginState.download) {
          // eslint-disable-next-line no-console
          console.debug(
            '[AppComponent] isDownloadFlow: true (download flag in state)',
          );
          return true;
        }
      } catch {
        // Invalid JSON, not a valid state
      }
    }

    // eslint-disable-next-line no-console
    console.debug('[AppComponent] isDownloadFlow: false');
    return false;
  }

  /**
   * Parses a base64-encoded Globus callback URL to extract dataset info.
   * The callback URL format is:
   * https://example.com/api/v1/datasets/{datasetDbId}/globus[Upload|Download]Parameters?...
   *
   * @param callback Base64-encoded callback URL
   * @returns Parsed data or null if invalid
   */
  private parseGlobusCallback(
    callback: string,
  ): { datasetDbId: string; downloadId?: string; token?: string } | null {
    try {
      const callbackUrl = atob(callback);
      const parts = callbackUrl.split('/');
      if (parts.length <= 6) {
        return null;
      }

      // Extract datasetDbId from URL (position 6 in the path)
      const datasetDbId = parts[6];

      // Extract downloadId and token from query params
      let downloadId: string | undefined;
      let token: string | undefined;
      const queryString = callbackUrl.split('?')[1];
      if (queryString) {
        const globusParams = queryString.split('&');
        for (const p of globusParams) {
          if (p.startsWith('downloadId=')) {
            downloadId = p.substring('downloadId='.length);
          } else if (p.startsWith('token=')) {
            token = p.substring('token='.length);
          }
        }
      }

      // Only include token in result if it's defined
      return { datasetDbId, downloadId, ...(token !== undefined && { token }) };
    } catch {
      // Invalid base64 or URL format
      return null;
    }
  }

  /**
   * Fetches persistentId from datasetDbId and navigates to the target route.
   * Used by both upload (→ /connect) and download (→ /download) redirect flows.
   * For preview URL users, token is passed to enable API calls.
   */
  private fetchAndRedirect(
    targetRoute: string,
    datasetDbId: string,
    downloadId?: string,
    token?: string,
  ): void {
    this.datasetService.getDatasetVersion(datasetDbId, undefined).subscribe({
      next: (x) => {
        // If persistentId is empty/missing, treat as error (e.g., draft dataset without auth)
        if (!x.persistentId) {
          // eslint-disable-next-line no-console
          console.warn(
            '[AppComponent] getDatasetVersion returned empty persistentId, using fallback',
          );
          this.navigateWithFallback(
            targetRoute,
            datasetDbId,
            downloadId,
            token,
          );
          return;
        }
        const queryParams: Record<string, string | null | undefined> = {
          datasetPid: x.persistentId,
        };
        if (downloadId) {
          queryParams['downloadId'] = downloadId;
        }
        // eslint-disable-next-line no-console
        console.debug(
          `[AppComponent] Redirecting to ${targetRoute} with:`,
          queryParams,
        );
        this.router.navigate([targetRoute], { queryParams });
      },
      error: (err) => {
        // eslint-disable-next-line no-console
        console.error('[AppComponent] Failed to get dataset version:', err);
        this.navigateWithFallback(targetRoute, datasetDbId, downloadId, token);
      },
    });
  }

  /**
   * Navigate with fallback params when getDatasetVersion fails or returns empty.
   */
  private navigateWithFallback(
    targetRoute: string,
    datasetDbId: string,
    downloadId?: string,
    token?: string,
  ): void {
    const fallbackParams: Record<string, string | undefined> = {
      datasetDbId: datasetDbId,
    };
    if (downloadId) {
      fallbackParams['downloadId'] = downloadId;
    }
    if (token) {
      fallbackParams['token'] = token;
    }
    // eslint-disable-next-line no-console
    console.debug(
      `[AppComponent] Redirecting to ${targetRoute} with fallback:`,
      fallbackParams,
    );
    this.router.navigate([targetRoute], { queryParams: fallbackParams });
  }

  /**
   * Parses the Globus callback from the URL and redirects to /download with the correct params.
   */
  private redirectToDownload(locationHref: string): void {
    try {
      const url = new URL(locationHref);
      const callback = url.searchParams.get('callback');

      if (!callback) {
        this.router.navigate(['/download']);
        return;
      }

      const parsed = this.parseGlobusCallback(callback);
      if (!parsed) {
        // eslint-disable-next-line no-console
        console.warn('[AppComponent] Invalid callback for download redirect');
        this.router.navigate(['/download']);
        return;
      }

      this.fetchAndRedirect(
        '/download',
        parsed.datasetDbId,
        parsed.downloadId,
        parsed.token,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        '[AppComponent] Failed to parse URL for download redirect:',
        e,
      );
      this.router.navigate(['/download']);
    }
  }

  /**
   * Parses the Globus callback from the URL and redirects to /connect with the correct params.
   * Used when Dataverse sends users to /connect/upload which Angular can't route.
   */
  private redirectToConnect(locationHref: string): void {
    try {
      const url = new URL(locationHref);
      const callback = url.searchParams.get('callback');

      if (!callback) {
        this.router.navigate(['/connect']);
        return;
      }

      const parsed = this.parseGlobusCallback(callback);
      if (!parsed) {
        // eslint-disable-next-line no-console
        console.warn('[AppComponent] Invalid callback for connect redirect');
        this.router.navigate(['/connect']);
        return;
      }

      this.fetchAndRedirect('/connect', parsed.datasetDbId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        '[AppComponent] Failed to parse URL for connect redirect:',
        e,
      );
      this.router.navigate(['/connect']);
    }
  }

  private static readonly REDIRECT_STORAGE_KEY = 'loginRedirectAttempt';
  private static readonly MAX_REDIRECTS = 2;
  private static readonly REDIRECT_WINDOW_MS = 30000; // 30 seconds

  /**
   * Checks for redirect loops by tracking redirect attempts in sessionStorage.
   * Returns true if we should stop redirecting to prevent infinite loop.
   */
  private isRedirectLoop(): boolean {
    try {
      const stored = sessionStorage.getItem(AppComponent.REDIRECT_STORAGE_KEY);
      const now = Date.now();

      if (stored) {
        const data = JSON.parse(stored) as { count: number; timestamp: number };
        const elapsed = now - data.timestamp;

        if (elapsed < AppComponent.REDIRECT_WINDOW_MS) {
          // Within time window - check count
          if (data.count >= AppComponent.MAX_REDIRECTS) {
            // eslint-disable-next-line no-console
            console.warn(
              '[AppComponent] Redirect loop detected, stopping redirects',
            );
            return true;
          }
          // Increment count
          sessionStorage.setItem(
            AppComponent.REDIRECT_STORAGE_KEY,
            JSON.stringify({
              count: data.count + 1,
              timestamp: data.timestamp,
            }),
          );
        } else {
          // Time window expired, reset
          sessionStorage.setItem(
            AppComponent.REDIRECT_STORAGE_KEY,
            JSON.stringify({ count: 1, timestamp: now }),
          );
        }
      } else {
        // First redirect attempt
        sessionStorage.setItem(
          AppComponent.REDIRECT_STORAGE_KEY,
          JSON.stringify({ count: 1, timestamp: now }),
        );
      }
    } catch {
      // sessionStorage not available, allow redirect
    }
    return false;
  }

  /**
   * Clears the redirect loop counter. Call when user successfully logs in.
   */
  private clearRedirectCounter(): void {
    try {
      sessionStorage.removeItem(AppComponent.REDIRECT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  private async checkLoginRequired(
    params: Record<string, string | undefined>,
  ): Promise<void> {
    // Skip redirect for download flow - it shows popup instead and allows guest access
    if (this.isDownloadFlow(params)) {
      return;
    }

    // Ensure config is loaded before checking login
    await this.pluginService.setConfig();

    // Check if user is logged in
    this.dataService.getUserInfo().subscribe({
      next: (userInfo) => {
        if (!userInfo.loggedIn) {
          // Check for redirect loop before redirecting
          if (this.isRedirectLoop()) {
            // eslint-disable-next-line no-console
            console.error(
              '[AppComponent] Login redirect loop detected - authentication may be misconfigured',
            );
            return;
          }
          this.pluginService.redirectToLogin();
        } else {
          // User is logged in, clear any redirect counter
          this.clearRedirectCounter();
        }
      },
      error: () => {
        // Check for redirect loop before redirecting
        if (this.isRedirectLoop()) {
          // eslint-disable-next-line no-console
          console.error(
            '[AppComponent] Login redirect loop detected - authentication may be misconfigured',
          );
          return;
        }
        this.pluginService.redirectToLogin();
      },
    });
  }
}
