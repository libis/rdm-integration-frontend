import { Target } from '@angular/compiler';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { DataService } from '../data.service';
import { Credentials } from '../models/credentials';
import { NewDatasetResponse } from '../models/new-dataset-response';
import { credentials } from '../state/credentials.actions';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  credentials: Observable<Credentials>;
  subscription: Subscription;
  creds: Credentials = {};

  repoType?: string;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  repoToken?: string;
  datasetId?: string;
  dataverseToken?: string;

  constructor(private router: Router, private dataService: DataService, private store: Store<{ creds: Credentials}>) {
    this.credentials = this.store.select('creds');
    this.subscription = this.credentials.subscribe(creds => this.creds = creds);
  }

  ngOnInit(): void {
    this.repoType = this.creds.repo_type;
    this.repoOwner = this.creds.repo_owner;
    this.repoName = this.creds.repo_name;
    this.repoBranch = this.creds.repo_branch;
    this.datasetId = this.creds.dataset_id;
    let token = localStorage.getItem('dataverseToken');
    if (token !== null) {
      this.dataverseToken = token;
    }
    this.changeRepo();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  changeRepo() {
    let token = null;
    switch (this.repoType) {
      case 'github':
        token = localStorage.getItem('ghToken');
        break;
      case 'gitlab':
        token = localStorage.getItem('glToken');
        break;
    }
    if (token !== null) {
      this.repoToken = token;
    } else {
      this.repoToken = undefined;
    }
  }

  connect() {
    console.log('connecting...');
    if (this.dataverseToken !== undefined) {
      localStorage.setItem('dataverseToken', this.dataverseToken);
    }
    if (this.repoToken !== undefined && this.repoType === "github") {
      localStorage.setItem('ghToken', this.repoToken);
    }
    if (this.repoToken !== undefined && this.repoType === "gitlab") {
      localStorage.setItem('glToken', this.repoToken);
    }
    let creds = {
      repo_type: this.repoType,
      repo_owner: this.repoOwner,
      repo_name: this.repoName,
      repo_branch: this.repoBranch,
      repo_token: this.repoToken,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    this.store.dispatch(credentials({ creds }));
    this.router.navigate(['/compare', this.datasetId === undefined ? 'unknown' : this.datasetId]);
  }

  newDataset() {
    if (this.dataverseToken === undefined) {
      alert("Dataverse API token is missing.");
      return
    }
    let httpSubscr = this.dataService.newDataset(this.dataverseToken).subscribe(
      (data: NewDatasetResponse) => {
        this.datasetId = data.persistentId;
        httpSubscr.unsubscribe(); //should not be needed, http client calls complete()
      }
    );
  }
}
