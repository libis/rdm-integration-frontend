import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CompareComponent } from './compare/compare.component';
import { ConnectComponent } from './connect/connect.component';
import { DatafileComponent } from './datafile/datafile.component';
import { SubmitComponent } from './submit/submit.component';
import { HttpClientModule } from '@angular/common/http';
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

@NgModule({
  declarations: [
    AppComponent,
    CompareComponent,
    ConnectComponent,
    DatafileComponent,
    SubmitComponent,
    SubmittedFileComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    AccordionModule,
    HttpClientModule,
    FormsModule,
    TreeTableModule,
    TableModule,
    ButtonModule,
    RippleModule,
    BrowserAnimationsModule,
    OverlayPanelModule,
    DropdownModule,
    SkeletonModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
