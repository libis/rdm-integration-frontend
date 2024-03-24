// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompareComponent } from './compare/compare.component';
import { ConnectComponent } from './connect/connect.component';
import { SubmitComponent } from './submit/submit.component';
import { ComputeComponent } from './compute/compute.component';

const routes: Routes = [
  { path: '', redirectTo: '/connect', pathMatch: 'full' },
  { path: 'connect', component: ConnectComponent },
  { path: 'compare/:id', component: CompareComponent },
  { path: 'submit', component: SubmitComponent },
  { path: 'compute', component: ComputeComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
