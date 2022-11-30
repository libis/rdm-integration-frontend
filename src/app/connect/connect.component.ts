import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Credentials } from '../models/credentials';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { NewDatasetResponse } from '../models/new-dataset-response';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  baseUrl?: string;
  base?: string;
  repoType?: string;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  repoToken?: string;
  datasetId?: string = "doi:";
  dataverseToken?: string;

  creatingNewDataset: boolean = false;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    ) {
  }

  ngOnInit(): void {
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
        this.baseUrl = 'https://github.com/<owner>/<repository>';
        break;
      case 'gitlab':
        token = localStorage.getItem('glToken');
        this.baseUrl = 'https://gitlab.kuleuven.be/<group>/<project>';
        break;
    }
    if (token !== null) {
      this.repoToken = token;
    } else {
      this.repoToken = undefined;
    }
  }

  connect() {
    var splitted = this.baseUrl?.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.base = splitted[0];
        this.repoOwner = splitted.slice(1, splitted.length - 1).join('/');
        this.repoName = splitted[splitted.length - 1];
      }
    }
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
    let creds: Credentials = {
      base: this.base,
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
      return undefined;
    }
    return res;
  }

  newDataset() {
    if (this.dataverseToken === undefined) {
      alert("Dataverse API token is missing.");
      return;
    }
    this.creatingNewDataset = true;
    let httpSubscr = this.datasetService.newDataset(this.dataverseToken).subscribe({
      next: (data: NewDatasetResponse) => {
        this.datasetId = data.persistentId;
        httpSubscr.unsubscribe();
        this.creatingNewDataset = false;
      },
      error: (err) => {
        alert("creating new dataset failed: " + err.error);
        httpSubscr.unsubscribe();
        this.creatingNewDataset = false;
      }
    });
  }
}
