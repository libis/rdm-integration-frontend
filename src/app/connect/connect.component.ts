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
import { PluginService } from '../plugin.service';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  sourceUrl?: string;
  url?: string;
  repoType?: string;
  repoName?: string;
  user?: string;
  token?: string;
  option?: string;
  datasetId?: string;
  dataverseToken?: string;
  doiDropdownWidth: SafeStyle;

  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  branchItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [this.loadingItem];
  repoTypes: SelectItem<string>[] = [];

  creatingNewDataset: boolean = false;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    private sanitizer: DomSanitizer,
    private doiLookupService: DoiLookupService,
    private branchLookupService: BranchLookupService,
    private pluginService: PluginService,
  ) {
    this.doiDropdownWidth = this.sanitizer.bypassSecurityTrustStyle("calc(100% - 12rem)");
  }

  ngOnInit(): void {
    let token = localStorage.getItem('dataverseToken');
    if (token !== null) {
      this.dataverseToken = token;
    }
    this.repoTypes = this.getRepoTypes();
    this.changeRepo();
  }

  ngOnDestroy() {
  }

  changeRepo() {
    let token = this.pluginService.getPlugin(this.repoType).getToken();
    if (token !== null) {
      this.token = token;
    } else {
      this.token = undefined;
    }
    this.branchItems = [this.loadingItem];
  }

  parseUrl(): string | undefined {
    if (!this.pluginService.getPlugin(this.repoType).parseSourceUrlField) {
      this.url = this.sourceUrl;
      return;
    }
    var splitted = this.sourceUrl?.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.url = 'https://' + splitted[0];
        this.user = splitted.slice(1, splitted.length - 1).join('/');
        this.repoName = splitted[splitted.length - 1];
      } else {
        return "Malformed source url";
      }
    } else {
      return "Malformed source url";
    }
    return;
  }

  connect() {
    let err = this.parseAndCheckFields();
    if (err !== undefined) {
      alert(err);
      return;
    }
    if (this.dataverseToken !== undefined) {
      localStorage.setItem('dataverseToken', this.dataverseToken);
    }
    this.pluginService.getPlugin(this.repoType).setToken(this.token);
    let creds: Credentials = {
      repo_type: this.repoType,
      repo_name: this.repoName,
      url: this.url,
      option: this.option,
      user: this.user,
      token: this.token,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    this.dataStateService.initializeState(creds);
    this.router.navigate(['/compare', this.datasetId]);
  }

  parseAndCheckFields(): string | undefined {
    let strings: (string | undefined)[] = [this.repoType, this.datasetId, this.dataverseToken, this.token, this.sourceUrl];
    let names: string[] = ['Repository type', 'Dataset DOI', 'Dataverse token', 'Token', 'Source URL'];
    let cnt = 0;
    let res = 'One or more mandatory fields are missing:';
    for (let i = 0; i < strings.length; i++) {
      let s = strings[i];
      if (s === undefined || s === '') {
        cnt++;
        res = res + '\n- ' + names[i];
      }
    }

    if (this.option == undefined || this.option === '' || this.option === 'loading') {
      cnt++;
      res = res + '\n- ' + this.pluginService.getPlugin(this.repoType).optionFieldName;
    }

    let err = this.parseUrl();
    if (err) {
      cnt++;
      res = res + '\n\n' + err;
    } else {
      if (this.user === undefined || this.user === '') {
        cnt++;
        res = res + '\n- ' + 'Username';
      }
      if (this.repoName === undefined || this.repoName === '') {
        cnt++;
        res = res + '\n- ' + 'Zone';
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

  getRepoOptions(): void {
    if (this.repoType === undefined) {
      alert('Repository type is missing');
      return;
    }
    if (this.sourceUrl === undefined || this.sourceUrl === '') {
      alert('Source URL is missing');
      return;
    }
    let err = this.parseUrl();
    if (err) {
      alert(err);
      return;
    }
    if (this.user === undefined || this.user === '') {
      alert('Username is missing');
      return;
    }
    if (this.repoName === undefined || this.repoName === '') {
      alert('Zone is missing');
      return;
    }

    let req = {
      repoType: this.repoType,
      repoName: this.repoName,
      url: this.url,
      user: this.user,
      token: this.token,
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

  getRepoTypes(): SelectItem<string>[] {
    return this.pluginService.getRepoTypes();
  }

  getTokenName(): string {
    return this.pluginService.getPlugin(this.repoType).tokenFieldName;
  }

  getOptionName(): string {
    return this.pluginService.getPlugin(this.repoType).optionFieldName;
  }

  getTokenPlaceholder(): string {
    return this.pluginService.getPlugin(this.repoType).tokenFieldPlaceholder;
  }

  getSourceUrlPlaceholder(): string {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldPlaceholder;
  }

  usernameHidden(): boolean {
    return this.pluginService.getPlugin(this.repoType).usernameFieldHidden;
  }

  zoneHidden(): boolean {
    return this.pluginService.getPlugin(this.repoType).zoneFieldHidden;
  }

  onUserChange() {
    this.doiItems = [this.loadingItem];
  }

  onRepoChange() {
    this.branchItems = [this.loadingItem];
  }
}
