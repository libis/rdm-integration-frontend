// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { enableProdMode, importProvidersFrom } from '@angular/core';

import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';
import { AutosizeModule } from 'ngx-autosize';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { providePrimeNG } from 'primeng/config';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PopoverModule } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TreeModule } from 'primeng/tree';
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeTableModule } from 'primeng/treetable';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routs';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withHashLocation()),
    importProvidersFrom(
      BrowserModule,
      NgbModule,
      AccordionModule,
      FormsModule,
      TreeTableModule,
      TableModule,
      ButtonModule,
      PopoverModule,
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
      ripple: false, // disable ripple effects globally
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
                  0: '#18181b',
                  50: '{zinc.950}',
                  100: '{zinc.900}',
                  200: '{zinc.800}',
                  300: '{zinc.700}',
                  400: '{zinc.600}',
                  500: '{zinc.500}',
                  600: '{zinc.400}',
                  700: '{zinc.300}',
                  800: '{zinc.200}',
                  900: '{zinc.100}',
                  950: '{zinc.50}',
                },
              },
            },
          },
        }),
      },
    }),
  ],
}).catch((err) => console.error(err));
