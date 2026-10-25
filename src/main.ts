// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import {
  enableProdMode,
  inject,
  importProvidersFrom,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';

import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AutosizeModule } from 'ngx-autosize';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routs';
import { environment } from './environments/environment';
import { PluginService } from './app/plugin.service';

if (environment.production) {
  enableProdMode();
}

async function initializeApp(): Promise<void> {
  const pluginService = inject(PluginService);
  try {
    await pluginService.setConfig();
  } catch (error) {
    console.error('Failed to load config:', error);
    // Allow app to continue with defaults
    pluginService.markConfigLoaded();
  }
}

// The Bootstrap colour mode (data-bs-theme) is set by an inline script in
// index.html, before the first paint.

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    importProvidersFrom(BrowserModule, FormsModule, AutosizeModule),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    provideZonelessChangeDetection(),
    provideAppInitializer(initializeApp),
  ],
}).catch((err) => console.error(err));
