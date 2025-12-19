// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { DataService } from './data.service';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { PluginService } from './plugin.service';
import { filter } from 'rxjs';

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

    // Redirect to login for non-download pages when user is not logged in
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkLoginRequired(event.url);
      });
    // Also check on initial load
    this.checkLoginRequired(this.router.url);
  }

  /**
   * Checks if the current URL represents a download flow that should skip login redirect.
   * Download flows allow guest access with Globus OAuth only.
   * 
   * This includes:
   * - Direct /download page access
   * - /connect with callback containing downloadId (Dataverse Globus callback)
   * - Any URL with state param containing download: true (OAuth return)
   */
  private isDownloadFlow(url: string): boolean {
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] isDownloadFlow called with url:', url);
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] window.location.href:', window.location.href);
    
    // Direct download page
    if (url.includes('/download')) {
      // eslint-disable-next-line no-console
      console.debug('[AppComponent] URL contains /download, returning true');
      return true;
    }

    // Parse query parameters from the URL
    const queryIndex = url.indexOf('?');
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] queryIndex:', queryIndex);
    if (queryIndex === -1) {
      // eslint-disable-next-line no-console
      console.debug('[AppComponent] No query string found, returning false');
      return false;
    }
    
    const queryString = url.substring(queryIndex + 1);
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] queryString:', queryString);
    const params = new URLSearchParams(queryString);
    
    // Check callback param for downloadId (Dataverse Globus integration callback)
    const callback = params.get('callback');
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] callback param:', callback);
    if (callback) {
      try {
        const decodedCallback = atob(callback);
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] decodedCallback:', decodedCallback);
        if (decodedCallback.includes('downloadId=')) {
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] Download flow detected via callback with downloadId');
          return true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] Failed to decode callback as base64:', e);
      }
    }

    // Check state param for download flag (OAuth return)
    const state = params.get('state');
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] state param:', state);
    if (state) {
      try {
        const loginState = JSON.parse(state);
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] parsed loginState:', loginState);
        if (loginState.download) {
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] Download flow detected via state.download flag');
          return true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] Failed to parse state as JSON:', e);
      }
    }

    // eslint-disable-next-line no-console
    console.debug('[AppComponent] No download flow detected, returning false');
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
            console.warn('[AppComponent] Redirect loop detected, stopping redirects');
            return true;
          }
          // Increment count
          sessionStorage.setItem(
            AppComponent.REDIRECT_STORAGE_KEY,
            JSON.stringify({ count: data.count + 1, timestamp: data.timestamp })
          );
        } else {
          // Time window expired, reset
          sessionStorage.setItem(
            AppComponent.REDIRECT_STORAGE_KEY,
            JSON.stringify({ count: 1, timestamp: now })
          );
        }
      } else {
        // First redirect attempt
        sessionStorage.setItem(
          AppComponent.REDIRECT_STORAGE_KEY,
          JSON.stringify({ count: 1, timestamp: now })
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

  private async checkLoginRequired(url: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] checkLoginRequired called, url:', url);
    
    // Skip redirect for download flow - it shows popup instead and allows guest access
    if (this.isDownloadFlow(url)) {
      // eslint-disable-next-line no-console
      console.debug('[AppComponent] Skipping redirect for download flow');
      return;
    }

    // Ensure config is loaded before checking login
    await this.pluginService.setConfig();

    // Check if user is logged in
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] Checking user info...');
    this.dataService.getUserInfo().subscribe({
      next: (userInfo) => {
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] getUserInfo response:', userInfo);
        if (!userInfo.loggedIn) {
          // Check for redirect loop before redirecting
          if (this.isRedirectLoop()) {
            // eslint-disable-next-line no-console
            console.error('[AppComponent] Login redirect loop detected - authentication may be misconfigured');
            return;
          }
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] User not logged in, redirecting...');
          this.pluginService.redirectToLogin();
        } else {
          // User is logged in, clear any redirect counter
          this.clearRedirectCounter();
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] User is logged in, no redirect needed');
        }
      },
      error: (err) => {
        // eslint-disable-next-line no-console
        console.error('[AppComponent] getUserInfo error:', err);
        // Check for redirect loop before redirecting
        if (this.isRedirectLoop()) {
          // eslint-disable-next-line no-console
          console.error('[AppComponent] Login redirect loop detected - authentication may be misconfigured');
          return;
        }
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] Assuming not logged in, redirecting...');
        this.pluginService.redirectToLogin();
      },
    });
  }
}
