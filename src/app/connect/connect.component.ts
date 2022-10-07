import { Target } from '@angular/compiler';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectService } from '../connect.service';
import { DataService } from '../data.service';
import { Credentials } from '../models/credentials';
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

  constructor(private connectService: ConnectService, private router: Router, private dataService: DataService) { }

  ngOnInit(): void {
    this.repoType = this.connectService.credentials.repo_type;
    this.repoOwner = this.connectService.credentials.repo_owner;
    this.repoName = this.connectService.credentials.repo_name;
    this.repoBranch = this.connectService.credentials.repo_branch;
    this.datasetId = this.connectService.credentials.dataset_id;
    let token = localStorage.getItem('dataverseToken');
    if (token !== null) {
      this.dataverseToken = token;
    }
    this.changeRepo();
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
    let credentials = {
      repo_type: this.repoType,
      repo_owner: this.repoOwner,
      repo_name: this.repoName,
      repo_branch: this.repoBranch,
      repo_token: this.repoToken,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    let connection_id = this.connectService.login(credentials);
    this.router.navigate(['/compare', connection_id]);
  }

  newDataset() {
    if (this.dataverseToken === undefined) {
      alert("Dataverse API token is missing.");
      return
    }
    this.dataService.newDataset(this.dataverseToken).subscribe(
      (data: NewDatasetResponse) => this.datasetId = data.persistentId
    );
  }
}
