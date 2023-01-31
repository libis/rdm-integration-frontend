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
import { ActivatedRoute } from '@angular/router';
import { Item, LoginState, TokenResponse } from '../models/oauth';
import { OauthService } from '../oauth.service';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  sourceUrl?: string;
  url?: string;
  repoName?: string;
  user?: string;
  token?: string;
  dataverseToken?: string;
  doiDropdownWidth: SafeStyle;

  repoType?: string;
  option?: string;
  collectionId?: string;
  datasetId?: string;

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
    private route: ActivatedRoute,
    private oauth: OauthService,
  ) {
    this.doiDropdownWidth = this.sanitizer.bypassSecurityTrustStyle("calc(100% - 12rem)");
  }

  ngOnInit(): void {
    let token = localStorage.getItem("dataverseToken");
    if (token !== null) {
      this.dataverseToken = token;
    }
    this.route.queryParams
      .subscribe(params => {
        let stateString = params['state'];
        if (stateString === undefined || stateString === null || stateString === '') {
          return;
        }
        let loginState: LoginState = JSON.parse(params['state']);
        if (this.getNounce() === loginState.nounce) {
          this.sourceUrl = loginState.sourceUrl;
          this.url = loginState.url;
          this.repoName = loginState.repoName;
          this.user = loginState.user;

          if (loginState.repoType !== undefined && loginState.repoType.value !== undefined) {
            if (this.repoTypes.length === 0) {
              this.repoTypes = [{ label: loginState.repoType.label, value: loginState.repoType.value! }];
            }
            this.repoType = loginState.repoType.value;
          }
          if (loginState.option !== undefined && loginState.option.value !== undefined) {
            this.branchItems = [{ label: loginState.option.label, value: loginState.option.value! }, this.loadingItem];
            this.option = loginState.option?.value;
          }
          if (loginState.datasetId !== undefined && loginState.datasetId.value !== undefined) {
            this.doiItems = [{ label: loginState.datasetId.label, value: loginState.datasetId.value! }, this.loadingItem];
            this.datasetId = loginState.datasetId?.value;
          }
          if (loginState.collectionId !== undefined && loginState.collectionId.value !== undefined) {
            this.collectionItems = [{ label: loginState.collectionId.label, value: loginState.collectionId.value! }, this.loadingItem];
            this.collectionId = loginState.collectionId?.value;
          }

          let code = params['code'];
          if (this.repoType !== undefined && code !== undefined) {
            var tokenSubscr = this.oauth.getToken(this.repoType, code, loginState.nounce).subscribe(x => {
              if (this.option === this.loadingItem.value) {
                this.option = undefined;
              }
              if (this.datasetId === this.loadingItem.value) {
                this.datasetId = undefined;
              }
              if (this.collectionId === this.loadingItem.value) {
                this.collectionId = undefined;
              }
              console.log(x)
              this.token = x.access_token;
              tokenSubscr.unsubscribe();
            });
          }
        }
      });
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
    this.sourceUrl = this.getSourceUrlValue();
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
      localStorage.setItem("dataverseToken", this.dataverseToken!);
    }
    let tokenName = this.pluginService.getPlugin(this.repoType).tokenName
    if (this.token && tokenName) localStorage.setItem(tokenName, this.token);
    let creds: Credentials = {
      pluginId: this.repoType,
      plugin: this.getPluginName(),
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
    let strings: (string | undefined)[] = [this.repoType, this.datasetId, this.dataverseToken];
    let names: string[] = ['Repository type', 'Dataset DOI', 'Dataverse token'];
    if (this.getSourceUrlFieldName()) {
      strings.push(this.sourceUrl);
      names.push(this.getSourceUrlFieldName()!);
    }
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
    if (this.branchItems.find(x => x === this.loadingItem) === undefined) {
      return;
    }

    let req = {
      pluginId: this.repoType,
      plugin: this.getPluginName(),
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
    if (dvItems.find(x => x === this.loadingItem) === undefined) {
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

  getRepoTypes() {
    this.repoTypes = this.pluginService.getRepoTypes();
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
    let v = this.pluginService.getPlugin(this.repoType).optionFieldPlaceholder;
    return v === undefined ? "" : v;
  }

  getSourceUrlFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldName;
  }

  getSourceUrlPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldPlaceholder;
  }

  getSourceUrlValue(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).sourceUrlFieldValue;
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

  getZonePlaceholder(): string {
    let v = this.pluginService.getPlugin(this.repoType).zoneFieldPlaceholder;
    return v === undefined ? "" : v;
  }

  zoneFieldEditable(): boolean {
    let v = this.pluginService.getPlugin(this.repoType).zoneFieldEditable;
    return v === undefined ? false : v;
  }

  getZones(): string[] {
    let v = this.pluginService.getPlugin(this.repoType).zoneFieldValues;
    return v === undefined ? [] : v;
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

  onCollectionChange() {
    this.doiItems = this.loadingItems;
    this.datasetId = undefined;
  }

  onRepoChange() {
    this.branchItems = this.loadingItems;
    this.option = undefined;
    this.url = undefined;
    this.user = undefined;
    this.repoName = undefined;
  }

  getPluginName(): string | undefined {
    return this.pluginService.getPlugin(this.repoType).plugin;;
  }

  showDVTokenGetter(): boolean {
    return this.pluginService.showDVTokenGetter();
  }

  getDataverseToken(): void {
    location.href = this.pluginService.getExternalURL() + '/dataverseuser.xhtml?selectTab=apiTokenTab';
  }

  showRepoTokenGetter(): boolean {
    return this.pluginService.getPlugin(this.repoType).showTokenGetter!;
  }

  getRepoToken() {
    if (this.repoType === undefined) {
      alert('Repository type is missing');
      return;
    }
    if (this.dataverseToken !== undefined) {
      localStorage.setItem("dataverseToken", this.dataverseToken!);
    }
    let tg = this.pluginService.getPlugin(this.repoType).tokenGetter!;
    let url = this.url + (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      let nounce = this.newNounce(44);
      let looginState: LoginState = {
        sourceUrl: this.sourceUrl,
        url: this.url,
        repoType: this.getItem(this.repoTypes, this.repoType),
        repoName: this.repoName,
        user: this.user,
        option: this.getItem(this.branchItems, this.option),
        datasetId: this.getItem(this.doiItems, this.datasetId),
        collectionId: this.getItem(this.collectionItems, this.collectionId),
        nounce: nounce,
      }
      url = url + '?client_id=' + tg.oauth_client_id +
        '&redirect_uri=' + this.pluginService.getRedirectUri() +
        '&response_type=code&state=' + JSON.stringify(looginState);
        // + '&code_challenge=' + nounce + '&code_challenge_method=S256';
    }
    location.href = url;
  }

  newNounce(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    localStorage.setItem("nounce", result);
    return result;
  }

  getNounce(): string | null {
    let result = localStorage.getItem("nounce");
    localStorage.removeItem("nounce");
    return result;
  }

  getItem(items: SelectItem<string>[], value?: string): Item | undefined {
    if (value === undefined) {
      return undefined;
    }
    let label = items.find(x => x.value === value)?.label
    return { label: label, value: value }
  }

  setToken(comp: ConnectComponent, tokenResp: TokenResponse): void {
    comp.token = tokenResp.access_token;
  }
}
