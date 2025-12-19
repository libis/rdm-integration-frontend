// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { DataService } from './data.service';
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pluginService = inject(PluginService);

  title = 'datasync';

  constructor() {}
  ngOnInit(): void {
    this.primengConfig.ripple.set(true);
    const dvToken = localStorage.getItem('dataverseToken');
    const subscription = this.dataService
      .checkAccessToQueue('', dvToken ? dvToken : '', '')
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
   */
  private isDownloadFlow(params: Record<string, string | undefined>): boolean {
    // For testing: allow overriding window.location.href
    const locationHref =
      (this as any)._testWindowLocationHref ?? window.location.href;

    // eslint-disable-next-line no-console
    console.debug('[AppComponent] isDownloadFlow check:', {
      routerUrl: this.router.url,
      params: params,
      windowLocation: locationHref,
    });

    // Check if we're on the download page (via router or window.location)
    if (
      this.router.url.includes('/download') ||
      locationHref.includes('/download')
    ) {
      // eslint-disable-next-line no-console
      console.debug('[AppComponent] isDownloadFlow: true (download page)');
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
