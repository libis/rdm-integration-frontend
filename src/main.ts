// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { enableProdMode, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { TreeTableModule } from 'primeng/treetable';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { provideAnimations } from '@angular/platform-browser/animations';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TreeModule } from 'primeng/tree';
import { TreeSelectModule } from 'primeng/treeselect';
import { AutosizeModule } from 'ngx-autosize';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AppComponent } from './app/app.component';
import Lara from '@primeng/themes/lara';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routs';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    importProvidersFrom(
      BrowserModule,
      NgbModule,
      AccordionModule,
      FormsModule,
      TreeTableModule,
      TableModule,
      ButtonModule,
      RippleModule,
      OverlayPanelModule,
      SelectModule,
      FloatLabelModule,
      SkeletonModule,
      DialogModule,
      CheckboxModule,
      TreeModule,
      TreeSelectModule,
      AutosizeModule,
      ProgressSpinnerModule,
    ),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: definePreset(Lara, {
          semantic: {
            primary: {
              50: '{blue.50}',
              100: '{blue.100}',
              200: '{blue.200}',
              300: '{blue.300}',
              400: '{blue.400}',
              500: '{blue.500}',
              600: '{blue.600}',
              700: '{blue.700}',
              800: '{blue.800}',
              900: '{blue.900}',
              950: '{blue.950}',
            },
            colorScheme: {
              light: {
                surface: {
                  0: '#ffffff',
                  50: '{zinc.50}',
                  100: '{zinc.100}',
                  200: '{zinc.200}',
                  300: '{zinc.300}',
                  400: '{zinc.400}',
                  500: '{zinc.500}',
                  600: '{zinc.600}',
                  700: '{zinc.700}',
                  800: '{zinc.800}',
                  900: '{zinc.900}',
                  950: '{zinc.950}',
                },
              },
              dark: {
                surface: {
                  0: '#ffffff',
                  50: '{zinc.50}',
                  100: '{zinc.100}',
                  200: '{zinc.200}',
                  300: '{zinc.300}',
                  400: '{zinc.400}',
                  500: '{zinc.500}',
                  600: '{zinc.600}',
                  700: '{zinc.700}',
                  800: '{zinc.800}',
                  900: '{zinc.900}',
                  950: '{zinc.950}',
                },
              },
            },
          },
        }),
      },
    }),
    provideAnimations(),
  ],
}).catch((err) => console.error(err));
