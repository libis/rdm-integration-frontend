// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License
import { Routes } from '@angular/router';
import { ConnectComponent } from './connect/connect.component';
import { CompareComponent } from './compare/compare.component';
import { SubmitComponent } from './submit/submit.component';
import { ComputeComponent } from './compute/compute.component';
import { DownloadComponent } from './download/download.component';

export const routes: Routes = [
    { path: '', redirectTo: '/connect', pathMatch: 'full' },
    { path: 'connect', component: ConnectComponent },
    { path: 'compare/:id', component: CompareComponent },
    { path: 'submit', component: SubmitComponent },
    { path: 'compute', component: ComputeComponent },
    { path: 'download', component: DownloadComponent },
];
