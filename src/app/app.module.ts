// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CompareComponent } from './compare/compare.component';
import { ConnectComponent } from './connect/connect.component';
import { DatafileComponent } from './datafile/datafile.component';
import { SubmitComponent } from './submit/submit.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SubmittedFileComponent } from './submitted-file/submitted-file.component';
import { TreeTableModule } from 'primeng/treetable';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AccordionModule } from 'primeng/accordion';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TreeModule } from 'primeng/tree';
import { TreeSelectModule } from 'primeng/treeselect';
import { ExecutablefileComponent } from './executablefile/executablefile.component';
import { ComputeComponent } from './compute/compute.component';
import { DownloadComponent } from './download/download.component';
import { DownladablefileComponent } from './downloadablefile/downladablefile.component';
import { AutosizeModule } from 'ngx-autosize';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';
import { definePreset } from '@primeng/themes';

@NgModule({
  declarations: [
    AppComponent,
    CompareComponent,
    ConnectComponent,
    DatafileComponent,
    SubmitComponent,
    SubmittedFileComponent,
    ExecutablefileComponent,
    ComputeComponent,
    DownloadComponent,
    DownladablefileComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    AccordionModule,
    FormsModule,
    TreeTableModule,
    TableModule,
    ButtonModule,
    RippleModule,
    BrowserAnimationsModule,
    OverlayPanelModule,
    DropdownModule,
    SkeletonModule,
    DialogModule,
    CheckboxModule,
    TreeModule,
    TreeSelectModule,
    AutosizeModule,
    ProgressSpinnerModule,
  ],
  providers: [
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
              950: '{blue.950}'
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
                  950: '{zinc.950}'
                }
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
                  950: '{zinc.950}'
                }
              }
            }
          }
        }),
      }
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
