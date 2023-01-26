// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Credentials } from '../models/credentials';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
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
  collectionId?: string;
  dataverseToken?: string;
  doiDropdownWidth: SafeStyle;

  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  branchItems: SelectItem<string>[] = this.loadingItems;
  doiItems: SelectItem<string>[] = this.loadingItems;
  collectionItems: SelectItem<string>[] = this.loadingItems;
  repoTypes: SelectItem<string>[] = [];

  creatingNewDataset: boolean = false;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    private sanitizer: DomSanitizer,
    private dvObjectLookupService: DvObjectLookupService,
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
    this.changeRepoType();
  }

  ngOnDestroy() {
  }

  changeRepoType() {
    let token = this.pluginService.getToken(this.repoType);
    if (token !== null) {
      this.token = token;
    } else {
      this.token = undefined;
    }
    this.sourceUrl = undefined;
    this.branchItems = this.loadingItems;
    this.option = undefined;
    this.url = undefined;
    this.user = undefined;
    this.repoName = undefined;
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
        if (this.repoName.endsWith(".git")) {
          this.repoName = this.repoName.substring(0, this.repoName.length - 4);
        }
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
    this.pluginService.setToken(this.repoType, this.token);
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
    let strings: (string | undefined)[] = [this.repoType, this.datasetId, this.dataverseToken, this.sourceUrl];
    let names: string[] = ['Repository type', 'Dataset DOI', 'Dataverse token', this.getSourceUrlFieldName()];
    if (this.getTokenFieldName()) {
      strings.push(this.token);
      names.push(this.getTokenFieldName()!);
    }
    if (this.getOptionFieldName()) {
      strings.push(this.option);
      names.push(this.getOptionFieldName()!);
    }
    if (this.getUsernameFieldName()) {
      strings.push(this.user);
      names.push(this.getUsernameFieldName()!);
    }
    if (this.getZoneFieldName()) {
      strings.push(this.repoName);
      names.push(this.getZoneFieldName()!);
    }

    let cnt = 0;
    let res = 'One or more mandatory fields are missing:';
    for (let i = 0; i < strings.length; i++) {
      let s = strings[i];
      if (s === undefined || s === '' || s === 'loading') {
        cnt++;
        res = res + '\n- ' + names[i];
      }
    }

    let err = this.parseUrl();
    if (err) {
      cnt++;
      res = res + '\n\n' + err;
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
    let httpSubscr = this.datasetService.newDataset((this.collectionId ? this.collectionId! : ""), this.dataverseToken).subscribe({
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
    if (this.getUsernameFieldName() && (this.user === undefined || this.user === '')) {
      alert(this.getUsernameFieldName() + ' is missing');
      return;
    }
    if (this.getZoneFieldName() && (this.repoName === undefined || this.repoName === '')) {
      alert(this.getZoneFieldName() + ' is missing');
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
        this.branchItems = this.loadingItems;
        this.option = undefined;
      },
    });
  }

  setDoiItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    comp.doiItems = items;
    comp.datasetId = undefined;
  }

  setCollectionItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    comp.collectionItems = items;
    comp.collectionId = undefined;
  }

  getDoiOptions(): void {
    this.getDvObjectOptions("Dataset", this.doiItems, this.setDoiItems)
  }

  getCollectionOptions(): void {
    this.getDvObjectOptions("Dataverse", this.collectionItems, this.setCollectionItems)
  }

  getDvObjectOptions(objectType: string, dvItems: SelectItem<string>[], setter: (comp: ConnectComponent, items: SelectItem<string>[]) => void): void {
    if (this.dataverseToken === undefined || this.dataverseToken === '') {
      alert('Dataverse object lookup failed: Dataverse API token is missing');
      return;
    }
    if (dvItems.length !== 1 || dvItems[0] !== this.loadingItem) {
      return;
    }

    let httpSubscr = this.dvObjectLookupService.getItems((this.collectionId ? this.collectionId! : ""), objectType, this.dataverseToken).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items !== undefined && items.length > 0) {
          setter(this, items);
        } else {
          setter(this, []);
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("doi lookup failed: " + err.error);
        setter(this, this.loadingItems);
      },
    });
  }

  getRepoTypes(): SelectItem<string>[] {
    return this.pluginService.getRepoTypes();
  }

  getTokenFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).tokenFieldName;
  }

  getTokenPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).tokenFieldPlaceholder;
  }

  getOptionFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).optionFieldName;
  }

  getOptionPlaceholder(): string {
    return this.pluginService.getPlugin(this.repoType).optionFieldPlaceholder ? this.pluginService.getPlugin(this.repoType).optionFieldPlaceholder! : "";
  }

  getSourceUrlFieldName(): string {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldName;
  }

  getSourceUrlPlaceholder(): string {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldPlaceholder;
  }

  getUsernameFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).usernameFieldName;
  }

  getUsernamePlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).usernameFieldPlaceholder;
  }

  getZoneFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).zoneFieldName;
  }

  getZonePlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).zoneFieldPlaceholder;
  }

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  collectionOptionsHidden(): boolean {
    return this.pluginService.collectionOptionsHidden();
  }

  createNewDatasetEnabled(): boolean {
    return !this.creatingNewDataset && this.pluginService.createNewDatasetEnabled();
  }

  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  collectionFieldEditable(): boolean {
    return this.pluginService.collectionFieldEditable();
  }

  onUserChange() {
    this.doiItems = this.loadingItems;
    this.collectionItems = this.loadingItems;
    this.datasetId = undefined;
    this.collectionId = undefined;
  }

  onRepoChange() {
    this.branchItems = this.loadingItems;
    this.option = undefined;
    this.url = undefined;
    this.user = undefined;
    this.repoName = undefined;
  }
}
