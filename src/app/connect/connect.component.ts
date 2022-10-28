import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { NewDatasetResponse } from '../models/new-dataset-response';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  repoType?: string;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  repoToken?: string;
  datasetId?: string;
  dataverseToken?: string;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    private credentialsService: CredentialsService) {
  }

  ngOnInit(): void {
    let credentials = this.credentialsService.credentials
    this.repoType = credentials.repo_type;
    this.repoOwner = credentials.repo_owner;
    this.repoName = credentials.repo_name;
    this.repoBranch = credentials.repo_branch;
    this.datasetId = credentials.dataset_id;
    let token = localStorage.getItem('dataverseToken');
    if (token !== null) {
      this.dataverseToken = token;
    }
    this.changeRepo();
  }

  ngOnDestroy() {
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
    let err = this.checkFields();
    if (err !== undefined) {
      alert(err);
      return;
    }
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
    this.dataStateService.initializeState(creds);
    this.router.navigate(['/compare', this.datasetId]);
  }

  checkFields(): string | undefined {
    let strings: (string | undefined)[] = [this.repoType, this.repoOwner, this.repoName, this.repoBranch, this.repoToken, this.datasetId, this.dataverseToken];
    let names: string[] = ['Repository type', 'Owner', 'Repository', 'Branch', 'Repository token', 'Dataset', 'Dataverse API token'];
    let cnt = 0;
    let res = 'One or more mandatory fields are missing:';
    for (let i = 0; i < strings.length; i++) {
      let s = strings[i];
      if (s === undefined || s === '') {
        cnt++;
        res = res + '\n- ' + names[i];
      }
    }
    if (cnt === 0) {
      return undefined
    }
    return res;
  }

  newDataset() {
    if (this.dataverseToken === undefined) {
      alert("Dataverse API token is missing.");
      return;
    }
    let httpSubscr = this.datasetService.newDataset(this.dataverseToken).subscribe(
      (data: NewDatasetResponse) => {
        this.datasetId = data.persistentId;
        httpSubscr.unsubscribe(); //should not be needed, http client calls complete()
      }
    );
  }
}
