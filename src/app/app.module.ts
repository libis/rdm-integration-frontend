import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CompareComponent } from './compare/compare.component';
import { ConnectComponent } from './connect/connect.component';
import { DatafileComponent } from './datafile/datafile.component';
import { SubmitComponent } from './submit/submit.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { credentialsReducer } from './state/credentials.reducer';

@NgModule({
  declarations: [
    AppComponent,
    CompareComponent,
    ConnectComponent,
    DatafileComponent,
    SubmitComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    FontAwesomeModule,
    HttpClientModule,
    FormsModule,
    StoreModule.forRoot({ creds: credentialsReducer }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
