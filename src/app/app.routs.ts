// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/connect', pathMatch: 'full' },
  {
    path: 'connect',
    loadComponent: () =>
      import('./connect/connect.component').then((m) => m.ConnectComponent),
  },
  {
    path: 'redcap2-export/:id',
    loadComponent: () =>
      import('./redcap2-export/redcap2-export.component').then(
        (m) => m.Redcap2ExportComponent,
      ),
  },
  {
    path: 'compare/:id',
    loadComponent: () =>
      import('./compare/compare.component').then((m) => m.CompareComponent),
  },
  {
    path: 'submit',
    loadComponent: () =>
      import('./submit/submit.component').then((m) => m.SubmitComponent),
  },
  {
    path: 'metadata-selector',
    loadComponent: () =>
      import('./metadata-selector/metadata-selector.component').then(
        (m) => m.MetadataSelectorComponent,
      ),
  },
  {
    path: 'compute',
    loadComponent: () =>
      import('./compute/compute.component').then((m) => m.ComputeComponent),
  },
  {
    path: 'ddi-cdi',
    loadComponent: () =>
      import('./ddi-cdi/ddi-cdi.component').then((m) => m.DdiCdiComponent),
  },
  {
    path: 'download',
    loadComponent: () =>
      import('./download/download.component').then((m) => m.DownloadComponent),
  },
];
