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

  private async checkLoginRequired(url: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.debug('[AppComponent] checkLoginRequired called, url:', url);
    
    // Skip redirect for download page - it shows popup instead
    if (url.includes('/download')) {
      // eslint-disable-next-line no-console
      console.debug('[AppComponent] Skipping redirect for download page');
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
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] User not logged in, redirecting...');
          this.pluginService.redirectToLogin();
        } else {
          // eslint-disable-next-line no-console
          console.debug('[AppComponent] User is logged in, no redirect needed');
        }
      },
      error: (err) => {
        // eslint-disable-next-line no-console
        console.error('[AppComponent] getUserInfo error:', err);
        // eslint-disable-next-line no-console
        console.debug('[AppComponent] Assuming not logged in, redirecting...');
        this.pluginService.redirectToLogin();
      },
    });
  }
}
