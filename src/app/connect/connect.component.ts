import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Credentials } from '../models/credentials';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DoiLookupService } from '../doi.lookup.service';
import { BranchLookupService } from '../branch.lookup.service';
import { NewDatasetResponse } from '../models/new-dataset-response';
import { SelectItem } from 'primeng/api';
import { DomSanitizer, SafeStyle } from "@angular/platform-browser";

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
  datasetId?: string;
  dataverseToken?: string;
  doiDropdownWidth: SafeStyle;
  username?: string;
  zone?: string;

  repoTypes: SelectItem<string>[] = [
    { label: "GitHub", value: "github" },
    { label: "GitLab", value: "gitlab" },
    { label: "IRODS", value: "irods" },
  ];

  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  branchItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [this.loadingItem];

  creatingNewDataset: boolean = false;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    private sanitizer: DomSanitizer,
    private doiLookupService: DoiLookupService,
    private branchLookupService: BranchLookupService,
  ) {
    this.doiDropdownWidth = this.sanitizer.bypassSecurityTrustStyle("calc(100% - 12rem)");
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

  repoTypePlaceHolder(): string {
    switch (this.repoType) {
      case 'github':
        return 'https://github.com/<owner>/<repository>';
      case 'gitlab':
        return 'https://gitlab.kuleuven.be/<group>/<project>';
      case 'irods':
        return 'Hostname';
    }
    return "URL"
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
      case 'irods':
        break;
    }
    if (token !== null) {
      this.repoToken = token;
    } else {
      this.repoToken = undefined;
    }
    this.branchItems = [this.loadingItem];
  }

  parseUrl() {
    if (this.repoType === "irods") {
      this.repoOwner = this.username;
      this.repoName = this.zone;
      this.base = this.baseUrl;
      return;
    }
    var splitted = this.baseUrl?.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.base = 'https://' + splitted[0];
        this.repoOwner = splitted.slice(1, splitted.length - 1).join('/');
        this.repoName = splitted[splitted.length - 1];
      }
    }
  }

  connect() {
    this.parseUrl();
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
      repo_type: this.repoType,
      repo_name: this.repoName,
      url: this.base,
      option: this.repoBranch,
      user: this.repoOwner,
      token: this.repoToken,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    this.dataStateService.initializeState(creds);
    this.router.navigate(['/compare', this.datasetId]);
  }

  checkFields(): string | undefined {
    let strings: (string | undefined)[] = [this.repoType, this.datasetId, this.dataverseToken];
    let names: string[] = ['Repository type', 'Dataset DOI', 'Dataverse token'];
    let cnt = 0;
    let res = 'One or more mandatory fields are missing:';
    for (let i = 0; i < strings.length; i++) {
      let s = strings[i];
      if (s === undefined || s === '') {
        cnt++;
        res = res + '\n- ' + names[i];
      }
    }
    if (this.repoToken == undefined || this.repoToken === '') {
      cnt++;
      if (this.repoType === 'irods') {
        res = res + '\n- ' + 'Password';
      } else {
        res = res + '\n- ' + 'Repository token';
      }
    }
    if (this.baseUrl == undefined || this.baseUrl === '') {
      cnt++;
      res = res + '\n- ' + 'Source URL';
    } else if (this.repoType !== 'irods' && (this.repoName == undefined || this.repoName === '' || ((this.repoOwner == undefined || this.repoOwner === '') && this.repoType === 'github'))) {
      cnt++;
      res = res + '\n- ' + 'Source URL';
    }
    if (this.repoBranch == undefined || this.repoBranch === '' || this.repoBranch === 'loading') {
      cnt++;
      if (this.repoType === 'irods') {
        res = res + '\n- ' + 'Folder';
      } else {
        res = res + '\n- ' + 'Branch';
      }
    }
    if (this.repoType === 'irods') {
      if (this.username === undefined || this.username === '') {
        cnt++;
        res = res + '\n- Username';
      }
      if (this.zone === undefined || this.zone === '') {
        cnt++;
        res = res + '\n- Zone'
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

  getBranchOptions(): void {
    console.log('click branches');
    if (this.repoType === undefined) {
      alert('Branch lookup failed: repository type is missing');
      return;
    }
    if (this.repoToken === undefined || this.repoToken === '') {
      if (this.repoType === 'irods') {
        alert('Branch lookup failed: password is missing');
      } else {
        alert('Branch lookup failed: token is missing');
      }
      return;
    }
    if (this.baseUrl === undefined || this.baseUrl === '' || this.baseUrl === 'https://github.com/<owner>/<repository>') {
      alert('Branch lookup failed: URL is missing');
      return;
    }
    if (this.repoType === 'irods') {
      if (this.username === undefined || this.username === '') {
        alert('Folder lookup failed: Username is missing');
        return;
      }
      if (this.zone === undefined || this.zone === '') {
        alert('Folder lookup failed: Zone is missing');
        return;
      }
    }

    this.parseUrl();
    
    let req = {
      repoType: this.repoType,
      repoName: this.repoName,
      url: this.base,
      user: this.repoOwner,
      token: this.repoToken,
    };

    let httpSubscr = this.branchLookupService.getItems(req).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items !== undefined && items.length > 0) {
          this.branchItems = items;
        } else {
          this.branchItems = [];
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("branch lookup failed: " + err.error);
        this.branchItems = [this.loadingItem];
      },
    });
  }

  getDoiOptions() {
    if (this.dataverseToken === undefined || this.dataverseToken === '') {
      alert('DOI lookup failed: Dataverse API token is missing');
      return;
    }
    if (this.doiItems.length !== 1 || this.doiItems[0] !== this.loadingItem) {
      return;
    }

    let httpSubscr = this.doiLookupService.getItems(this.dataverseToken).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items !== undefined && items.length > 0) {
          this.doiItems = items;
        } else {
          this.doiItems = [];
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("doi lookup failed: " + err.error);
        this.doiItems = [this.loadingItem];
      },
    });
  }

  onUserChange() {
    this.doiItems = [this.loadingItem];
  }

  onRepoChange() {
    this.branchItems = [this.loadingItem];
  }
}
